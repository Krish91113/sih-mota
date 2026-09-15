/** AI API — maps to /ai/* */
import { api } from "./client";

export function getAiConfig() {
  return api.get("/ai/config");
}

export function updateAiConfig(data: Record<string, unknown>) {
  return api.put("/ai/config", data);
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
