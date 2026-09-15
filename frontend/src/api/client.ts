/**
 * Central API client for MoTA backend.
 *
 * Every backend call goes through `api.*` so that auth headers, error
 * handling, and response unwrapping are handled in one place.
 */

import { ApiError, parseApiError } from "./errors";

// ---------------------------------------------------------------------------
// Token storage helpers (simple localStorage)
// ---------------------------------------------------------------------------

const ACCESS_KEY = "mota_access_token";
const REFRESH_KEY = "mota_refresh_token";

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getAccessToken(): string | null {
  return storage()?.getItem(ACCESS_KEY) ?? null;
}

export function getRefreshToken(): string | null {
  return storage()?.getItem(REFRESH_KEY) ?? null;
}

export function setTokens(access: string, refresh: string) {
  storage()?.setItem(ACCESS_KEY, access);
  storage()?.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  storage()?.removeItem(ACCESS_KEY);
  storage()?.removeItem(REFRESH_KEY);
}

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

function baseUrl(): string {
  return (
    (typeof import.meta !== "undefined" &&
      (import.meta as unknown as { env?: Record<string, string> })["env"]?.["VITE_API_BASE_URL"]) ||
    "http://localhost:8000/api/v1"
  );
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

type RequestOpts = {
  /** Additional headers */
  headers?: Record<string, string>;
  /** Query string params */
  params?: Record<string, string | number | boolean | undefined> | undefined;
  /** Abort signal */
  signal?: AbortSignal;
  /** Set to true to skip attaching the Authorization header */
  noAuth?: boolean;
};

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const base = baseUrl().replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  const url = new URL(`${base}/${cleanPath}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function authHeaders(noAuth?: boolean): Record<string, string> {
  if (noAuth) return {};
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------------------
// Core request function
// ---------------------------------------------------------------------------

/**
 * Low-level fetch wrapper. Returns the **unwrapped** `data` field from the
 * backend response envelope `{ success, data, request_id }`.
 *
 * Throws `ApiError` on non-2xx.
 */
async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOpts = {},
): Promise<T> {
  const url = buildUrl(path, opts.params);

  const requestId = crypto.randomUUID();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Request-ID": requestId,
    ...authHeaders(opts.noAuth),
    ...opts.headers,
  };

  let fetchBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      fetchBody = body;
      // Don't set Content-Type — the browser sets the boundary automatically
    } else {
      headers["Content-Type"] = "application/json";
      fetchBody = JSON.stringify(body);
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: fetchBody ?? null,
    ...(opts.signal ? { signal: opts.signal } : {}),
    credentials: "include",
  });

  // --- Handle 401 — try token refresh once ---
  if (res.status === 401 && !opts.noAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry the original request with the new token
      return request<T>(method, path, body, { ...opts, noAuth: false });
    }
    // Unrecoverable 401 — clear and redirect
    clearTokens();
    if (typeof window !== "undefined") {
      const returnUrl = window.location.pathname + window.location.search;
      window.location.href = `/login?returnTo=${encodeURIComponent(returnUrl)}`;
    }
    throw await parseApiError(res);
  }

  if (!res.ok) {
    const error = await parseApiError(res);
    if (error.status === 403 && typeof window !== "undefined") {
      window.location.href = "/forbidden";
    }
    throw error;
  }

  // Some endpoints return 204 No Content
  if (res.status === 204) return undefined as T;

  const json = (await res.json()) as { success: boolean; data: T; request_id?: string };
  return json.data;
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as {
        success: boolean;
        data: { access_token: string };
      };
      if (json.success && json.data.access_token) {
        storage()?.setItem(ACCESS_KEY, json.data.access_token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const api = {
  get<T = unknown>(path: string, opts?: RequestOpts) {
    return request<T>("GET", path, undefined, opts);
  },
  post<T = unknown>(path: string, body?: unknown, opts?: RequestOpts) {
    return request<T>("POST", path, body, opts);
  },
  put<T = unknown>(path: string, body?: unknown, opts?: RequestOpts) {
    return request<T>("PUT", path, body, opts);
  },
  patch<T = unknown>(path: string, body?: unknown, opts?: RequestOpts) {
    return request<T>("PATCH", path, body, opts);
  },
  delete<T = unknown>(path: string, opts?: RequestOpts) {
    return request<T>("DELETE", path, undefined, opts);
  },
};
