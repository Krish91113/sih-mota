/** Grievances API — maps to /grievances/* */
import { api } from "./client";

export interface GrievanceMessage {
  id: string;
  grievance_id: string;
  author_id: string;
  message: string;
  internal: boolean;
  created_at: string;
  [key: string]: unknown;
}

/**
 * `grievances` table — verified against
 * `backend/app/domain/relational_models.py`.
 *
 * NOTE: there is no `applicant` name, no `sla`/`due` column and no
 * `last_updated`; the table stores ids only. `category` and `priority` are
 * non-null, `applicant_id` / `assigned_to` are nullable.
 */
export interface Grievance {
  id: string;
  applicant_id: string | null;
  created_by: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  assigned_to: string | null;
  /** Inherited from `SimpleRecord`; nullable. */
  status: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  messages?: GrievanceMessage[];
  [key: string]: unknown;
}

export function listGrievances(params?: Record<string, string | number | boolean | undefined>) {
  return api.get<Grievance[]>("/grievances", { params });
}

export function getGrievance(id: string) {
  return api.get<Grievance>(`/grievances/${id}`);
}

export function createGrievance(data: {
  subject: string;
  description: string;
  [key: string]: unknown;
}) {
  return api.post<Grievance>("/grievances", data);
}

export function assignGrievance(id: string, data: Record<string, unknown>) {
  return api.post(`/grievances/${id}/assign`, data);
}

export function addGrievanceMessage(id: string, data: { message: string; [key: string]: unknown }) {
  return api.post(`/grievances/${id}/messages`, data);
}

export function transitionGrievance(id: string, data: Record<string, unknown>) {
  return api.post(`/grievances/${id}/transition`, data);
}
