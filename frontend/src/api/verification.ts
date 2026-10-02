/**
 * Trust & verification API — the deterministic verification workspace.
 *
 * Covers verification cases, evidence, findings, decision traces, duplicate
 * checks and eligibility runs. This is rule-based backend verification: no
 * model confidence or fraud score is surfaced anywhere in this module.
 */
import { api } from "./client";
import type {
  DecisionTrace,
  DuplicateCheck,
  EligibilityRun,
  Evidence,
  Finding,
  QueryParams,
  VerificationCase,
} from "./types";

export type { DecisionTrace, DuplicateCheck, EligibilityRun, Evidence, Finding, VerificationCase };

// ── Verification cases ────────────────────────────────────────────────────────

export function listVerificationCases(params?: QueryParams) {
  return api.get<VerificationCase[]>("/verification-cases", { params });
}

export function getVerificationCase(id: string) {
  return api.get<VerificationCase>(`/verification-cases/${id}`);
}

/** Open a case for an application. Backend picks priority/assignee defaults. */
export function createVerificationCase(
  applicationId: string,
  data?: { application_id?: string; priority?: string; assigned_to?: string },
) {
  return api.post<VerificationCase>(
    `/applications/${applicationId}/verification-cases`,
    data ?? {},
  );
}

/**
 * CaseCreateIn — used by both `POST /verification-cases` and
 * `POST /applications/{id}/verification-case`. `application_id` is inferred
 * from the path on the nested route and must be omitted there.
 */
export interface CreateVerificationCaseInput {
  application_id?: string;
  /** HIGH | MEDIUM | LOW — backend default is MEDIUM. */
  priority?: string;
  assigned_to?: string;
}

/** Standalone case creation (no application in the path). */
export function createVerificationCaseRoot(data: CreateVerificationCaseInput) {
  return api.post<VerificationCase>("/verification-cases", data);
}

/** Create the case directly against an application, mirroring the nested path. */
export function createVerificationCaseForApplication(
  applicationId: string,
  data?: Omit<CreateVerificationCaseInput, "application_id">,
) {
  return api.post<VerificationCase>(`/applications/${applicationId}/verification-case`, data ?? {});
}

export function assignVerificationCase(id: string, data: { assignee_id: string }) {
  return api.post<VerificationCase>(`/verification-cases/${id}/assign`, data);
}

export function completeVerificationCase(
  id: string,
  data?: { findings_summary?: string; note?: string },
) {
  return api.post<VerificationCase>(`/verification-cases/${id}/complete`, data ?? {});
}

export function returnVerificationCase(id: string, data?: { reason?: string }) {
  return api.post<VerificationCase>(`/verification-cases/${id}/return`, data ?? {});
}

// ── Evidence ─────────────────────────────────────────────────────────────────

export function listApplicationEvidence(applicationId: string, params?: QueryParams) {
  return api.get<Evidence[]>(`/applications/${applicationId}/evidence`, { params });
}

export function createEvidence(
  applicationId: string,
  data: {
    evidence_type: string;
    field_name: string;
    observed_value?: unknown;
    normalized_value?: unknown;
    source?: string;
    confidence?: number;
    document_id?: string;
  },
) {
  return api.post<Evidence>(`/applications/${applicationId}/evidence`, data);
}

export function getEvidence(id: string) {
  return api.get<Evidence>(`/evidence/${id}`);
}

export function verifyEvidence(id: string, data?: { notes?: string }) {
  return api.post<Evidence>(`/evidence/${id}/verify`, data ?? {});
}

// ── Findings ─────────────────────────────────────────────────────────────────

export function listApplicationFindings(applicationId: string, params?: QueryParams) {
  return api.get<Finding[]>(`/applications/${applicationId}/findings`, { params });
}

export function createFinding(
  applicationId: string,
  data: {
    category: string;
    description: string;
    severity?: string;
    evidence_id?: string;
    expected_value?: unknown;
    observed_value?: unknown;
  },
) {
  return api.post<Finding>(`/applications/${applicationId}/findings`, data);
}

export function getFinding(id: string) {
  return api.get<Finding>(`/findings/${id}`);
}

export function resolveFinding(
  id: string,
  data?: { resolution?: string; resolution_notes?: string },
) {
  return api.post<Finding>(`/findings/${id}/resolve`, data ?? {});
}

// ── Decision traces ──────────────────────────────────────────────────────────

export function listDecisionTraces(applicationId: string, params?: QueryParams) {
  return api.get<DecisionTrace[]>(`/applications/${applicationId}/decision-traces`, { params });
}

export function createDecisionTrace(
  applicationId: string,
  data: {
    decision_type: string;
    decision_status: string;
    scheme_version_id?: string;
    policy_version?: string;
    input_snapshot?: Record<string, unknown>;
    reason?: string;
    steps?: Record<string, unknown>[];
  },
) {
  return api.post<DecisionTrace>(`/applications/${applicationId}/decision-traces`, data);
}

export function getDecisionTrace(id: string) {
  return api.get<DecisionTrace>(`/decision-traces/${id}`);
}

/** Record a trace not scoped to a single application (system-level decision). */
export function createStandaloneDecisionTrace(data: Parameters<typeof createDecisionTrace>[1]) {
  return api.post<DecisionTrace>("/decision-traces", data);
}

// ── Duplicate checks ─────────────────────────────────────────────────────────

export function runDuplicateCheck(applicationId: string) {
  return api.post<DuplicateCheck>(`/applications/${applicationId}/check-duplicates`);
}

export function getDuplicateChecks(applicationId: string, params?: QueryParams) {
  return api.get<DuplicateCheck[]>(`/applications/${applicationId}/duplicate-checks`, { params });
}

// ── Eligibility runs ─────────────────────────────────────────────────────────

export function getEligibilityRun(runId: string) {
  return api.get<EligibilityRun>(`/eligibility/runs/${runId}`);
}
