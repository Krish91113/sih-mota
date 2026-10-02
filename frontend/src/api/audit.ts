/**
 * Audit API — maps to /audit.
 *
 * The backend keeps an append-only, hash-chained ledger: each row stores the
 * hash of the row before it plus its own `event_hash`, so any edit to history
 * breaks the chain. `GET /audit/verify` walks that chain and reports the first
 * record where it no longer holds.
 *
 * Field names come straight from the live `/audit` response — note they are
 * `event_type` / `entity_type` / `entity_id` / `created_at` / `data`, not the
 * `action` / `resource_*` / `timestamp` / `details` naming used elsewhere.
 */
import { api } from "./client";
import type { QueryParams } from "./types";

export interface AuditEvent {
  id: string;
  /** LOGIN, CREATE, UPDATE, DELETE, APPROVE, … */
  event_type: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  /** Free-text justification supplied on the action, when required. */
  reason: string | null;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  /** Payload specific to the event type. */
  data: Record<string, unknown>;
  /** This row's hash, and the `event_hash` of the row before it. */
  event_hash: string;
  previous_hash: string;
  created_at: string;
  [key: string]: unknown;
}

export function listAuditEvents(params?: QueryParams) {
  return api.get<AuditEvent[]>("/audit", { params });
}

/**
 * NOTE: the backend exposes only `GET /audit` and `GET /audit/verify` — there
 * is no `GET /audit/{id}`. Look an event up in the list instead; the ledger is
 * small enough that this is cheap and keeps the client honest about the
 * contract. `useAuditEventQuery` in `hooks/api/useReports` wraps this.
 */
export async function getAuditEvent(id: string): Promise<AuditEvent> {
  const events = await listAuditEvents();
  const found = events.find((e) => e.id === id);
  if (!found) throw new Error(`Audit event ${id} was not found in the ledger.`);
  return found;
}

export interface AuditChainVerification {
  /** True when every record's previous_hash matches the prior event_hash. */
  valid: boolean;
  total_records: number;
  /** First record whose link to its predecessor does not hold. */
  broken_at_id: string | null;
  /** Human-readable explanation, including the expected/found hashes. */
  message: string;
}

/**
 * Walks the whole hash chain. `valid: false` means history has been altered
 * outside the application and the break point is identified by `broken_at_id`.
 */
export function verifyAuditChain() {
  return api.get<AuditChainVerification>("/audit/verify");
}
