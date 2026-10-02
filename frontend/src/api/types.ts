/**
 * Shared response shapes for backend resources that are consumed by more than
 * one dashboard module. Derived from the live `/openapi.json` contract.
 *
 * Every backend row is returned through the `{ success, data }` envelope and
 * unwrapped by `api/client.ts`, so these interfaces describe the *unwrapped*
 * `data` payload.
 */

/** Generic row envelope — the backend serialises most entities with these. */
export interface BaseRow {
  id: string;
  created_at?: string;
  updated_at?: string;
  data?: Record<string, unknown> | null;
  status?: string | null;
  [key: string]: unknown;
}

export type ParamValue = string | number | boolean | undefined | null;

export type QueryParams = Record<string, ParamValue>;

/** Audit row — returned by /timeline, /audit and embedded in packets. */
export interface AuditEvent extends BaseRow {
  event_type: string;
  entity_type: string;
  entity_id?: string | null;
  actor_id?: string | null;
  request_id?: string | null;
  before_state?: string | null;
  after_state?: string | null;
  reason?: string | null;
  ip_address?: string | null;
  event_hash?: string;
  previous_hash?: string;
}

/** Workflow / SLA assignment from /applications/{id}/sla. */
export interface WorkflowAssignment extends BaseRow {
  application_id: string;
  stage: string;
  assignee_id?: string | null;
  assigned_by?: string | null;
  status?: string | null;
  assigned_at?: string | null;
  completed_at?: string | null;
  due_at?: string | null;
  paused_at?: string | null;
  resumed_at?: string | null;
  escalated_at?: string | null;
  sla_status?: string | null;
  events?: {
    id: string;
    assignment_id: string;
    event_type: string;
    at: string;
    reason?: string | null;
  }[];
}

export interface EligibilityRuleResult {
  rule_id?: string;
  rule_code?: string;
  description?: string;
  passed?: boolean;
  result?: string;
  observed_value?: unknown;
  expected_value?: unknown;
  source?: string | null;
  [key: string]: unknown;
}

export interface EligibilityRun extends BaseRow {
  application_id: string;
  scheme_version_id?: string;
  result: "ELIGIBLE" | "INELIGIBLE" | string;
  engine_version?: string | null;
  input_snapshot?: Record<string, unknown>;
  rules?: EligibilityRuleResult[];
  run_id?: string;
}

export interface Deficiency extends BaseRow {
  application_id: string;
  raised_by?: string | null;
  type: string;
  description: string;
  document_id?: string | null;
  severity?: string | null;
  deadline?: string | null;
  required_action?: string | null;
  rule_id?: string | null;
  evidence_id?: string | null;
  resolution_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
}

export interface Evidence extends BaseRow {
  application_id: string;
  document_id?: string | null;
  evidence_type: string;
  field_name: string;
  observed_value?: unknown;
  normalized_value?: unknown;
  source?: string | null;
  confidence?: number | null;
  verified?: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
}

export interface Finding extends BaseRow {
  application_id: string;
  category: string;
  severity?: string | null;
  description: string;
  evidence_id?: string | null;
  expected_value?: unknown;
  observed_value?: unknown;
  resolution?: string | null;
  resolved_at?: string | null;
}

export interface VerificationCase extends BaseRow {
  application_id: string;
  assigned_to?: string | null;
  priority?: string | null;
  opened_at?: string | null;
  completed_at?: string | null;
}

export interface DecisionTrace extends BaseRow {
  application_id: string;
  decision_type: string;
  decision_status: string;
  scheme_version_id?: string | null;
  policy_version?: string | null;
  input_snapshot?: Record<string, unknown>;
  reason?: string | null;
  actor_id?: string | null;
  steps?: DecisionStep[];
}

export interface DecisionStep {
  id?: string;
  step_type?: string;
  description?: string;
  result?: string;
  evidence_id?: string | null;
  rule_result_id?: string | null;
  actor_id?: string | null;
  [key: string]: unknown;
}

/** Document metadata row — /documents and /documents/{id}. */
export interface DocumentMeta extends BaseRow {
  application_id?: string | null;
  document_type: string;
  file_name?: string;
  mime_type?: string;
  size_bytes?: number;
  version?: number;
  verified?: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  storage_path?: string;
}

/** /applications/{id}/approval-packet — the official decision workspace payload. */
export interface ApprovalPacket {
  application: BaseRow & {
    application_number?: string;
    status?: string;
    cycle?: string;
    answers?: Record<string, unknown>;
  };
  applicant_profile?: { id: string; user_id?: string; profile?: Record<string, unknown> } | null;
  scheme?: (BaseRow & { code?: string; name?: string }) | null;
  scheme_version?: (BaseRow & { version?: string }) | null;
  candidate?: BaseRow | null;
  round?: BaseRow | null;
  scores?: BaseRow[];
  reviews?: BaseRow[];
  committee_decisions?: BaseRow[];
  recommendations?: BaseRow[];
  approvals?: BaseRow[];
  documents?: DocumentMeta[];
  verified_documents?: DocumentMeta[];
  evidence?: Evidence[];
  deficiencies?: Deficiency[];
  decision_traces?: DecisionTrace[];
  audit_references?: { id: string; type: string; status: string; created_at?: string }[];
  eligibility?: EligibilityRun | null;
  rule_results?: EligibilityRuleResult[];
  verification_case?: VerificationCase | null;
  summary_reason?: string;
  /** Named gating checks the backend enforces before APPROVED is allowed. */
  prerequisites?: Record<string, boolean>;
  ready?: boolean;
  [key: string]: unknown;
}

/** Duplicate-check result row — never a fraud score, only matched facts. */
export interface DuplicateCheck extends BaseRow {
  application_id?: string;
  matched_field?: string;
  matched_value?: string;
  related_application_id?: string | null;
  related_application_number?: string | null;
  reason?: string | null;
  total_flags?: number;
  flags?: unknown[];
}

// NOTE: `Grievance` / `GrievanceMessage` intentionally live in
// `api/grievances.ts`, which mirrors the `grievances` and
// `grievance_messages` tables. A looser duplicate used to sit here and
// conflicted with it; the api module is the single source of truth.
export type { Grievance, GrievanceMessage } from "./grievances";
