/** Audit API — maps to /audit */
import { api } from "./client";

export interface AuditEvent {
  id: string;
  action: string;
  actor_id: string;
  resource_type: string;
  resource_id: string;
  timestamp: string;
  details: Record<string, unknown>;
  [key: string]: unknown;
}

export function listAuditEvents(params?: Record<string, string | number | boolean | undefined>) {
  return api.get<AuditEvent[]>("/audit", { params });
}
