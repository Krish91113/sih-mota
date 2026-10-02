/** Documents API — maps to /documents/* and /document-verification/* */
import { api } from "./client";
import type { QueryParams } from "./types";
import { withoutUndefined } from "@/lib/utils";

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

export function listDocuments(params?: QueryParams) {
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
    // The backend proxies the file to Cloudinary (or local fallback). Surface the
    // real cause of 503-style storage failures instead of a generic message.
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      (err as { status: number }).status === 503
    ) {
      const wrapped = new Error(
        "Cloud document storage (Cloudinary) is temporarily unavailable. Your file was not uploaded — please try again shortly.",
      );
      (wrapped as { status?: number }).status = 503;
      throw wrapped;
    }
    throw err;
  });
}

/**
 * `POST /documents` is multipart-only (it requires a `file` part), so documents
 * can only be created through `uploadDocumentFile` above.
 */
export function replaceDocument(id: string, formData: FormData, idempotencyKey?: string) {
  return api.post<DocumentMeta>(
    `/documents/${id}/replace`,
    formData,
    idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined,
  );
}

// ── Verification ─────────────────────────────────────────────────────────────

export function getVerificationQueue() {
  return api.get("/document-verification/queue");
}

/** Verify a queued document. The endpoint takes no decision body; `note` is audited. */
export function verifyDocument(docId: string, data?: { note?: string }) {
  return api.post(
    `/document-verification/${docId}/verify`,
    data ? withoutUndefined(data) : undefined,
  );
}

export function rejectDocument(docId: string, data?: Record<string, unknown>) {
  return api.post(`/document-verification/${docId}/reject`, data);
}

/** Ask the applicant for a corrected document. The reason is fixed server-side. */
export function requestResubmission(docId: string) {
  return api.post(`/documents/${docId}/request-resubmission`);
}

// ── Direct document decisions (document-scoped, not queue-scoped) ────────────

/**
 * Verify a document record directly.
 *
 * This endpoint unconditionally marks the document VERIFIED - use
 * `rejectDocumentRecord` for a rejection. `note` is recorded in the audit log.
 */
export function verifyDocumentRecord(id: string, data?: { note?: string }) {
  return api.post(`/documents/${id}/verify`, data ? withoutUndefined(data) : undefined);
}

export function rejectDocumentRecord(id: string, data: { result: string; note?: string }) {
  return api.post(`/documents/${id}/reject`, data);
}

/** Who opened this document and when — shown in the document detail drawer. */
export function getDocumentAccessLog(id: string, params?: QueryParams) {
  return api.get<Record<string, unknown>[]>(`/documents/${id}/access-log`, { params });
}

/**
 * Fetch the stored file as a blob.
 *
 * The endpoint is bearer-protected, so this must go through the authenticated
 * client (with token refresh) rather than a plain link. Callers should revoke
 * the object URL they create from this blob once the download starts.
 */
export function fetchDocumentFile(filePath: string, opts?: { signal?: AbortSignal }) {
  return api.blob(`/documents/file/${filePath.replace(/^\/+/, "")}`, opts);
}

/**
 * Download a document file and hand it to the browser as a download.
 * Returns false if the object URL could not be created.
 */
export async function downloadDocumentFile(filePath: string, filename?: string): Promise<boolean> {
  const blob = await fetchDocumentFile(filePath);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || filePath.split("/").pop() || "document";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
