/** Applications API — maps to /applications/* */
import { api } from "./client";

export interface Application {
  id: string;
  applicant_id: string;
  scheme_id: string;
  scheme_version_id: string;
  cycle: string;
  status: string;
  current_version: number;
  application_number?: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
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

export function listApplications(params?: Record<string, string | number | boolean | undefined>) {
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
