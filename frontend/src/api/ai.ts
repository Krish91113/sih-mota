/** AI API — maps to /ai/* */
import { api } from "./client";

/**
 * `GET /ai/config` — verified live against
 * `backend/app/api/router.py:350` (`def ai_config(): return ok({"enabled":False})`).
 *
 * The endpoint is a backend stub: it only ever returns `enabled`, with no
 * `provider` or `model_version`. Those fields are therefore optional here and
 * the UI must not invent them.
 */
export interface AiConfig {
  enabled: boolean;
  provider?: string;
  model_version?: string;
  [key: string]: unknown;
}

export function getAiConfig() {
  return api.get<AiConfig>("/ai/config");
}

/**
 * `PUT /ai/config` is also a stub (`return ok({"enabled":False})`) and ignores
 * the request body, so a successful call does not mean the setting persisted.
 */
export function updateAiConfig(data: Partial<AiConfig>) {
  return api.put<AiConfig>("/ai/config", data);
}

export function getApplicationSummary(appId: string) {
  return api.get(`/ai/applications/${appId}/summary`);
}

export function runConsistencyCheck(appId: string) {
  return api.post(`/ai/applications/${appId}/consistency-check`);
}

export function runDocumentAi(docId: string, action: string) {
  return api.post(`/ai/documents/${docId}/${action}`);
}

export function getAiJob(jobId: string) {
  return api.get(`/ai/jobs/${jobId}`);
}
