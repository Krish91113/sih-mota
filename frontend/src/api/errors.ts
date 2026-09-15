/**
 * Structured API error extracted from backend error responses.
 *
 * Backend error envelope:
 * ```json
 * { "success": false, "error": { "code": "...", "message": "...", "details": {} }, "request_id": "..." }
 * ```
 */
export class ApiError extends Error {
  /** HTTP status code */
  readonly status: number;
  /** Backend error code (e.g. "CONFLICT", "UNAUTHORIZED") */
  readonly code: string;
  /** Human-readable error detail from the backend */
  readonly detail: string;
  /** Arbitrary structured details from the backend */
  readonly details: Record<string, unknown>;
  /** Request correlation ID */
  readonly requestId: string | null;

  constructor(opts: {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string | null;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.detail = opts.message;
    this.details = opts.details ?? {};
    this.requestId = opts.requestId ?? null;
  }

  /** True when the user's session is invalid / expired */
  get isUnauthorized() {
    return this.status === 401;
  }

  /** True when the user lacks permissions */
  get isForbidden() {
    return this.status === 403;
  }

  /** True for business / concurrency conflicts */
  get isConflict() {
    return this.status === 409;
  }

  /** True for validation errors */
  get isValidation() {
    return this.status === 422;
  }
}

/**
 * Parse a non-OK `Response` into an `ApiError`.
 * Falls back to a generic message when the body isn't the expected envelope.
 */
export async function parseApiError(res: Response): Promise<ApiError> {
  let body: Record<string, unknown> | null = null;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON response */
  }

  if (body && typeof body === "object" && "error" in body) {
    const err = body["error"] as Record<string, unknown>;
    return new ApiError({
      status: res.status,
      code: (err["code"] as string) ?? "UNKNOWN",
      message: (err["message"] as string) ?? res.statusText,
      details: (err["details"] as Record<string, unknown>) ?? {},
      requestId: (body["request_id"] as string) ?? null,
    });
  }

  return new ApiError({
    status: res.status,
    code: "UNKNOWN",
    message: body?.["message"]
      ? String(body["message"])
      : `Request failed with status ${res.status}`,
    requestId: null,
  });
}
