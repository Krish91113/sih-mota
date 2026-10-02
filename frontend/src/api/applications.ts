/** Applications API — maps to /applications/* */
import { api } from "./client";
import type { QueryParams } from "./types";

/**
 * The free-text answers captured by the dynamic form.
 *
 * The backend stores these as an open `Record<string, unknown>`; the keys below
 * are the ones the seeded flagship scheme actually populates and that the UI
 * displays. Any other key stays accessible via the index signature.
 */
export interface ApplicationAnswers {
  category?: string;
  programme?: string;
  institution?: string;
  annual_income?: number;
  [key: string]: unknown;
}

/**
 * `GET /applications` / `GET /applications/{id}` — verified against the live
 * backend. Note there is no `applicant`, `course`, `scheme` name, `due` or
 * `current_version` field: the API exposes ids plus `answers`. UI must derive
 * display labels from `answers` or resolve ids via the dedicated endpoints.
 */
export interface Application {
  id: string;
  applicant_id: string;
  scheme_id: string;
  scheme_version_id: string;
  cycle: string;
  status: string;
  /** Live field name is `version` (not `current_version`). */
  version: number;
  application_number?: string;
  answers?: ApplicationAnswers;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** Display label for an application, derived only from fields the API returns. */
export function applicationLabel(app: { application_number?: string; id: string }): string {
  return app.application_number || app.id;
}

/** Programme name, when the applicant answered the dynamic form. */
export function applicationProgramme(app: { answers?: ApplicationAnswers }): string | undefined {
  const value = app.answers?.programme;
  return typeof value === "string" && value ? value : undefined;
}

export interface ApplicationVersion {
  id: string;
  application_id: string;
  version_number: number;
  answers: Record<string, unknown>;
  created_at: string;
  [key: string]: unknown;
}

export interface ApplicationTimeline {
  id: string;
  status: string;
  timestamp: string;
  actor: string;
  note: string | null;
  [key: string]: unknown;
}

export interface WorkflowTransition {
  transition: string;
  label: string;
  requires_reason: boolean;
  [key: string]: unknown;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function listApplications(params?: QueryParams) {
  return api.get<Application[]>("/applications", { params });
}

export function getApplication(id: string) {
  return api.get<Application>(`/applications/${id}`);
}

export function createApplication(
  data: {
    scheme_id: string;
    scheme_version_id: string;
    cycle: string;
    answers?: Record<string, unknown>;
  },
  idempotencyKey?: string,
) {
  return api.post<Application>(
    "/applications",
    data,
    idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {},
  );
}

export function updateApplication(
  id: string,
  data: { answers?: Record<string, unknown>; reason?: string; expected_version?: number },
) {
  return api.patch<Application>(`/applications/${id}`, data);
}

export function deleteApplication(id: string) {
  return api.delete(`/applications/${id}`);
}

// ── Versions / Answers ───────────────────────────────────────────────────────

export function getApplicationVersions(id: string) {
  return api.get<ApplicationVersion[]>(`/applications/${id}/versions`);
}

export function getApplicationAnswers(id: string) {
  return api.get<Record<string, unknown>>(`/applications/${id}/answers`);
}

// ── Workflow ─────────────────────────────────────────────────────────────────

export function getApplicationStatus(id: string) {
  return api.get<{ status: string; [key: string]: unknown }>(`/applications/${id}/status`);
}

export function getApplicationTimeline(id: string) {
  return api.get<ApplicationTimeline[]>(`/applications/${id}/timeline`);
}

export function getAvailableTransitions(id: string) {
  return api.get<WorkflowTransition[]>(`/applications/${id}/available-transitions`);
}

export function getApplicationSla(id: string) {
  return api.get(`/applications/${id}/sla`);
}

// ── Validation / Submission ──────────────────────────────────────────────────

export function validateApplication(id: string) {
  return api.post(`/applications/${id}/validate`);
}

export function submitApplication(id: string, idempotencyKey: string) {
  return api.post(`/applications/${id}/submit`, undefined, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

// ── Assignment ───────────────────────────────────────────────────────────────

export function assignApplication(id: string, data: Record<string, unknown>) {
  return api.post(`/applications/${id}/assign`, data);
}

export function reassignApplication(id: string, data: Record<string, unknown>) {
  return api.post(`/applications/${id}/reassign`, data);
}

// ── Eligibility ──────────────────────────────────────────────────────────────

export function evaluateEligibility(id: string) {
  return api.post(`/eligibility/applications/${id}/evaluate`);
}

export function getLatestEligibility(id: string) {
  return api.get(`/eligibility/applications/${id}/latest`);
}

export function getEligibilityHistory(id: string) {
  return api.get(`/eligibility/applications/${id}/history`);
}

export function recalculateEligibility(id: string) {
  return api.post(`/applications/${id}/recalculate-eligibility`);
}

// ── Approval ─────────────────────────────────────────────────────────────────

export function getApprovalPacket(id: string) {
  return api.get(`/applications/${id}/approval-packet`);
}

export function getDecisionPacket(id: string) {
  return api.get(`/applications/${id}/decision-packet`);
}

export function approveApplication(id: string, data?: Record<string, unknown>) {
  return api.post(`/applications/${id}/approve`, data);
}

export function rejectApplication(id: string, data?: Record<string, unknown>) {
  return api.post(`/applications/${id}/reject`, data);
}

export function returnApplication(id: string, data?: Record<string, unknown>) {
  return api.post(`/applications/${id}/return`, data);
}

export function holdApproval(id: string, data?: Record<string, unknown>) {
  return api.post(`/applications/${id}/approval-hold`, data);
}

export function createAward(id: string, data?: Record<string, unknown>) {
  return api.post(`/applications/${id}/award`, data);
}

// ── Withdrawal / workflow transition ─────────────────────────────────────────

export function withdrawApplication(id: string, data?: { reason?: string }) {
  return api.post<Application>(`/applications/${id}/withdraw`, data ?? {});
}

/** Move the application to an explicit status. Backend validates the move. */
export function changeApplicationStatus(id: string, data: { status: string; reason?: string }) {
  return api.post<Application>(`/applications/${id}/status`, data);
}

/** Drive the configured workflow machine. Backend rejects illegal moves. */
export function transitionApplication(
  id: string,
  data: { to_status: string; reason?: string; metadata?: Record<string, unknown> },
) {
  return api.post<Application>(`/applications/${id}/transition`, data);
}

// ── Application-level deficiencies ───────────────────────────────────────────

export function listApplicationDeficiencies(id: string, params?: QueryParams) {
  return api.get<import("./types").Deficiency[]>(`/applications/${id}/deficiencies`, { params });
}

export function createApplicationDeficiency(id: string, data: Record<string, unknown>) {
  return api.post<import("./types").Deficiency>(`/applications/${id}/deficiencies`, data);
}

// ── Verification case shortcuts (full API in ./verification) ─────────────────

export function getApplicationVerificationCase(id: string, params?: QueryParams) {
  // The backend resolves the single case for an application and returns
  // `null` when none exists — this is one object, never a list.
  return api.get<import("./types").VerificationCase | null>(
    `/applications/${id}/verification-case`,
    {
      params,
    },
  );
}

// ── Approval delegation ──────────────────────────────────────────────────────

export function listApprovalDelegations(id: string, params?: QueryParams) {
  return api.get(`/applications/${id}/approval-delegation`, { params });
}

export function createApprovalDelegation(
  id: string,
  data: { to_user_id: string; reason: string; expires_at?: string },
) {
  return api.post(`/applications/${id}/approval-delegation`, data);
}

// ── Recorded approval decision ───────────────────────────────────────────────

/** The authoritative decision call used by the approval workspace. */
export function recordApprovalDecision(
  id: string,
  data: { decision: string; reason_code?: string; note?: string },
  idempotencyKey?: string,
) {
  return api.post(
    `/applications/${id}/approvals`,
    data,
    idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {},
  );
}

// ── Awards ───────────────────────────────────────────────────────────────────
//
// NOTE: the backend has no `GET /applications/{id}/awards`. An application
// holds at most one award, and it is returned inline on the application
// record (`award_id` / `award_status`). To create it, POST below; to inspect
// a created award use `getAward` / `listAwardInstallments` in `finance.ts`.

export function createApplicationAward(id: string, data: { amount: number; award_date?: string }) {
  return api.post(`/applications/${id}/awards`, data);
}
