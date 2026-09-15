import { api } from "./client";

export interface ApplicationNote {
  id: string;
  application_id: string;
  author_id: string;
  note: string;
  internal: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export function listApplicationNotes(applicationId: string) {
  return api.get<ApplicationNote[]>(`/applications/${applicationId}/notes`);
}

export function createApplicationNote(
  applicationId: string,
  data: { note: string; internal?: boolean },
) {
  return api.post<ApplicationNote>(`/applications/${applicationId}/notes`, data);
}

export function updateApplicationNote(id: string, data: { note?: string; internal?: boolean }) {
  return api.patch<ApplicationNote>(`/application-notes/${id}`, data);
}

export function deleteApplicationNote(id: string) {
  return api.delete(`/application-notes/${id}`);
}
