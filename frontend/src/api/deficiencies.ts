/** Deficiencies API — maps to /deficiencies/* */
import { api } from "./client";

export interface Deficiency {
  id: string;
  application_id: string;
  type: string;
  description: string;
  severity: string;
  status: string;
  deadline: string | null;
  required_action: string;
  [key: string]: unknown;
}

export function listDeficiencies(params?: Record<string, string | number | boolean | undefined>) {
  return api.get<Deficiency[]>("/deficiencies", { params });
}

export function getDeficiency(id: string) {
  return api.get<Deficiency>(`/deficiencies/${id}`);
}

export function respondToDeficiency(
  id: string,
  data: { response: string; supporting_documents?: Record<string, unknown> },
) {
  return api.post(`/deficiencies/${id}/respond`, data);
}

export function reviewDeficiency(id: string, data?: Record<string, unknown>) {
  return api.post(`/deficiencies/${id}/review`, data);
}

export function resolveDeficiency(id: string, data?: Record<string, unknown>) {
  return api.post(`/deficiencies/${id}/resolve`, data);
}

export function reopenDeficiency(id: string, data?: Record<string, unknown>) {
  return api.post(`/deficiencies/${id}/reopen`, data);
}
