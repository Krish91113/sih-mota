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
  return getApiBaseUrl();
}

/** Public base URL (includes the `/api/v1` prefix). Used for file/download hrefs. */
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

/**
 * Value types accepted in a query string. `null`/`undefined` are skipped when
 * serialising, so clearing a filter is just `{ status: null }`.
 */
export type ParamValue = string | number | boolean | null | undefined;
export type ParamMap = Record<string, ParamValue>;

type RequestOpts = {
  /** Additional headers */
  headers?: Record<string, string>;
  /** Query string params */
  params?: ParamMap | undefined;
  /** Abort signal */
  signal?: AbortSignal;
  /** Set to true to skip attaching the Authorization header */
  noAuth?: boolean;
  /** Internal guard: prevents an endless refresh-and-retry loop. */
  _retried?: boolean;
};

function buildUrl(path: string, params?: ParamMap): string {
  const base = baseUrl().replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  const url = new URL(`${base}/${cleanPath}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
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

  // --- Handle 401 — try token refresh exactly once ---
  if (res.status === 401 && !opts.noAuth && !opts._retried) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry the original request once with the new access token.
      return request<T>(method, path, body, { ...opts, _retried: true });
    }
    // Unrecoverable — clear tokens and route to the session-expired screen so
    // the user can sign in again without losing their current location.
    clearTokens();
    if (typeof window !== "undefined") {
      const returnUrl = window.location.pathname + window.location.search;
      window.location.href = `/session-expired?returnTo=${encodeURIComponent(returnUrl)}`;
    }
    throw await parseApiError(res);
  }

  if (!res.ok) {
    throw await parseApiError(res);
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
        data: { access_token: string; refresh_token?: string };
      };
      const data = json.data;
      if (json.success && data?.access_token) {
        storage()?.setItem(ACCESS_KEY, data.access_token);
        // The backend currently echoes the same refresh token, but it is
        // documented as part of the response. Persist whatever arrives so a
        // future rotating implementation works without another client change.
        if (data.refresh_token) storage()?.setItem(REFRESH_KEY, data.refresh_token);
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

/**
 * Authenticated binary download.
 *
 * `GET /documents/file/{file_path}` is bearer-protected and streams bytes, so
 * it cannot go through `request()` (which parses a JSON envelope) and cannot
 * be a plain `<a href>` (which would 401). Refresh-and-retry mirrors `request()`
 * so an expired token still works mid-download.
 */
async function fetchBlob(path: string, opts: RequestOpts = {}): Promise<Blob> {
  const url = buildUrl(path, opts.params);

  const send = () =>
    fetch(url, {
      method: "GET",
      headers: {
        Accept: "*/*",
        "X-Request-ID": crypto.randomUUID(),
        ...authHeaders(opts.noAuth),
        ...opts.headers,
      },
      credentials: "include",
      ...(opts.signal ? { signal: opts.signal } : {}),
    });

  const res = await send();

  if (res.status === 401 && !opts.noAuth && !opts._retried) {
    if (await tryRefresh()) return fetchBlob(path, { ...opts, _retried: true });
    clearTokens();
    if (typeof window !== "undefined") {
      const returnUrl = window.location.pathname + window.location.search;
      window.location.href = `/session-expired?returnTo=${encodeURIComponent(returnUrl)}`;
    }
    throw await parseApiError(res);
  }

  if (!res.ok) throw await parseApiError(res);
  return res.blob();
}

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
  /** Binary download with auth + refresh handling. */
  blob(path: string, opts?: RequestOpts) {
    return fetchBlob(path, opts);
  },
};
