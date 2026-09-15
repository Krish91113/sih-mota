/** Documents API — maps to /documents/* and /document-verification/* */
import { api } from "./client";

export interface DocumentMeta {
  id: string;
  application_id: string;
  document_type: string;
  filename: string;
  status: string;
  created_at: string;
  [key: string]: unknown;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function listDocuments(params?: Record<string, string | number | boolean | undefined>) {
  return api.get<DocumentMeta[]>("/documents", { params });
}

export function getDocument(id: string) {
  return api.get<DocumentMeta>(`/documents/${id}`);
}

export function getDownloadUrl(id: string) {
  return api.get<{ url: string }>(`/documents/${id}/download-url`);
}

export function getDocumentVersions(id: string) {
  return api.get(`/documents/${id}/versions`);
}

export function presignUpload(data: Record<string, unknown>) {
  return api.post<{ upload_url: string; storage: string; expires_in: number }>(
    "/documents/presign",
    data,
  );
}

export function uploadDocumentFile(formData: FormData, params?: Record<string, string>) {
  return api.post<DocumentMeta>("/documents", formData, { params }).catch((err) => {
    // The backend proxies the file to ImageKit (or local fallback). Surface the
    // real cause of 503-style storage failures instead of a generic message.
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      (err as { status: number }).status === 503
    ) {
      const wrapped = new Error(
        "Cloud document storage (ImageKit) is temporarily unavailable. Your file was not uploaded — please try again shortly.",
      );
      (wrapped as { status?: number }).status = 503;
      throw wrapped;
    }
    throw err;
  });
}

export function createDocument(data: Record<string, unknown>) {
  return api.post<DocumentMeta>("/documents", data);
}

export function replaceDocument(id: string, data: Record<string, unknown>) {
  return api.post(`/documents/${id}/replace`, data);
}

// ── Verification ─────────────────────────────────────────────────────────────

export function getVerificationQueue() {
  return api.get("/document-verification/queue");
}

export function verifyDocument(docId: string, data?: Record<string, unknown>) {
  return api.post(`/document-verification/${docId}/verify`, data);
}

export function rejectDocument(docId: string, data?: Record<string, unknown>) {
  return api.post(`/document-verification/${docId}/reject`, data);
}

export function requestResubmission(docId: string, data?: Record<string, unknown>) {
  return api.post(`/documents/${docId}/request-resubmission`, data);
}
