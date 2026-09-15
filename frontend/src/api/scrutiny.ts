/** Scrutiny API — maps to /scrutiny/* */
import { api } from "./client";

export function getScrutinyQueue() {
  return api.get("/scrutiny/queue");
}

export function getScrutinyApplication(appId: string) {
  return api.get(`/scrutiny/applications/${appId}`);
}

export function startScrutiny(appId: string) {
  return api.post(`/scrutiny/applications/${appId}/start`);
}

export function addScrutinyNote(appId: string, note: string) {
  return api.post(`/scrutiny/applications/${appId}/notes`, { note });
}

export function completeScrutiny(appId: string, data?: Record<string, unknown>) {
  return api.post(`/scrutiny/applications/${appId}/complete`, data);
}

export function returnScrutiny(appId: string, data?: Record<string, unknown>) {
  return api.post(`/scrutiny/applications/${appId}/return`, data);
}
