/** Applicant consent API — maps to /consent/*. Surfaced as a small settings section. */
import { api } from "./client";
import type { QueryParams } from "./types";

/**
 * A consent row as served by `backend/app/consent_api.py`: `granted`,
 * `revoked_at`, `granted_at`, `scope`, `policy_version`, `purpose`,
 * `consent_type` and an `evidence` object.
 */
export interface ConsentRecord {
  id: string;
  user_id?: string;
  actor_id?: string | null;
  consent_type: string;
  purpose?: string;
  policy_version?: string | null;
  scope?: string | null;
  granted?: boolean;
  application_id?: string | null;
  evidence?: Record<string, unknown> | null;
  granted_at?: string | null;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  version?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

/** A consent is live while `granted` is true and it has not been revoked. */
export function isConsentActive(c: ConsentRecord): boolean {
  return c.granted === true && !c.revoked_at;
}

/**
 * `GET /consent/current` returns an **array** of the caller's active consents
 * (verified live), filtered by `consent_type` / `application_id`.
 */
export function getCurrentConsent(params?: QueryParams) {
  return api.get<ConsentRecord[]>("/consent/current", { params });
}

/** `GET /consent/history` returns every consent ever recorded for the caller. */
export function listConsentHistory(params?: QueryParams) {
  return api.get<ConsentRecord[]>("/consent/history", { params });
}

export function getConsent(id: string) {
  return api.get<ConsentRecord>(`/consent/${id}`);
}

export function createConsent(data: {
  consent_type: string;
  purpose: string;
  policy_version?: string;
  scope?: string;
  granted?: boolean;
  application_id?: string;
  evidence?: Record<string, unknown>;
}) {
  return api.post<ConsentRecord>("/consent", data);
}

export function revokeConsent(id: string, data?: { reason?: string }) {
  return api.post<ConsentRecord>(`/consent/${id}/revoke`, data ?? {});
}
