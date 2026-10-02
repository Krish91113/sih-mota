/** Institutions API — maps to /institutions/* */
import { api } from "./client";

export interface Institution {
  id: string;
  code: string;
  name: string;
  institution_type: string | null;
  state: string | null;
  district: string | null;
  [key: string]: unknown;
}

export function listInstitutions() {
  return api.get<Institution[]>("/institutions");
}

export function createInstitution(data: {
  code: string;
  name: string;
  institution_type?: string;
  state?: string;
  district?: string;
}) {
  return api.post<Institution>("/institutions", data);
}

export function getInstitution(id: string) {
  return api.get<Institution>(`/institutions/${id}`);
}

export function updateInstitution(id: string, data: Partial<Institution>) {
  return api.patch<Institution>(`/institutions/${id}`, data);
}

export function getInstitutionUsers(id: string) {
  return api.get(`/institutions/${id}/users`);
}

export function verifyInstitutionApplication(
  applicationId: string,
  data: { result: string; fields?: Record<string, unknown>; note?: string },
) {
  return api.post(`/institutions/applications/${applicationId}/verify`, data);
}

export function requestClarification(applicationId: string, data?: Record<string, unknown>) {
  return api.post(`/institutions/applications/${applicationId}/request-clarification`, data);
}
