/** Schemes API — maps to /schemes/* and /scheme-versions/* */
import { api } from "./client";

export interface Scheme {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface SchemeVersion {
  id: string;
  scheme_id: string;
  version: string;
  status: string;
  configuration: Record<string, unknown>;
  created_at: string;
  [key: string]: unknown;
}

export interface SchemeRule {
  id: string;
  rule_id: string;
  name: string;
  field: string;
  operator: string;
  value: unknown;
  source_reference: string;
  [key: string]: unknown;
}

export interface FormDefinition {
  fields: Record<string, unknown>[];
  sections: Record<string, unknown>[];
  conditional_rules: Record<string, unknown>[];
  [key: string]: unknown;
}

// ── Schemes ──────────────────────────────────────────────────────────────────

export function listSchemes() {
  return api.get<Scheme[]>("/schemes");
}

export function getScheme(id: string) {
  return api.get<Scheme>(`/schemes/${id}`);
}

export function createScheme(data: { name: string; code?: string; description?: string }) {
  return api.post<Scheme>("/schemes", data);
}

export function updateScheme(id: string, data: Partial<Scheme>) {
  return api.patch<Scheme>(`/schemes/${id}`, data);
}

export function deleteScheme(id: string) {
  return api.delete(`/schemes/${id}`);
}

// ── Scheme Versions ──────────────────────────────────────────────────────────

export function listSchemeVersions(schemeId: string) {
  return api.get<SchemeVersion[]>(`/schemes/${schemeId}/versions`);
}

export function createSchemeVersion(
  schemeId: string,
  data: { version: string; configuration?: Record<string, unknown> },
) {
  return api.post<SchemeVersion>(`/schemes/${schemeId}/versions`, data);
}

export function getSchemeVersion(versionId: string) {
  return api.get<SchemeVersion>(`/scheme-versions/${versionId}`);
}

export function updateSchemeVersion(versionId: string, data: Partial<SchemeVersion>) {
  return api.patch<SchemeVersion>(`/scheme-versions/${versionId}`, data);
}

export function submitVersionForReview(versionId: string) {
  return api.post(`/scheme-versions/${versionId}/submit-review`);
}

export function approveVersion(versionId: string) {
  return api.post(`/scheme-versions/${versionId}/approve`);
}

export function publishVersion(versionId: string) {
  return api.post(`/scheme-versions/${versionId}/publish`);
}

export function archiveVersion(versionId: string) {
  return api.post(`/scheme-versions/${versionId}/archive`);
}

export function cloneVersion(versionId: string) {
  return api.post<SchemeVersion>(`/scheme-versions/${versionId}/clone`);
}

// ── Form Definitions ─────────────────────────────────────────────────────────

export function getFormDefinition(versionId: string) {
  return api.get<FormDefinition>(`/scheme-versions/${versionId}/form-definition`);
}

export function putFormDefinition(versionId: string, data: FormDefinition) {
  return api.put(`/scheme-versions/${versionId}/form-definition`, data);
}

export function previewForm(versionId: string) {
  return api.post(`/scheme-versions/${versionId}/form-definition/preview`);
}

export function validateForm(versionId: string) {
  return api.post(`/scheme-versions/${versionId}/form-definition/validate`);
}

// ── Scheme Rules ─────────────────────────────────────────────────────────────

export function listRules(versionId: string) {
  return api.get<SchemeRule[]>(`/scheme-versions/${versionId}/rules`);
}

export function createRule(versionId: string, data: Omit<SchemeRule, "id">) {
  return api.post<SchemeRule>(`/scheme-versions/${versionId}/rules`, data);
}

export function getRule(ruleId: string) {
  return api.get<SchemeRule>(`/scheme-rules/${ruleId}`);
}

export function updateRule(ruleId: string, data: Partial<SchemeRule>) {
  return api.patch<SchemeRule>(`/scheme-rules/${ruleId}`, data);
}

export function deleteRule(ruleId: string) {
  return api.delete(`/scheme-rules/${ruleId}`);
}

export function testRules(versionId: string) {
  return api.post(`/scheme-versions/${versionId}/rules/test`);
}

export function validateRules(versionId: string) {
  return api.post(`/scheme-versions/${versionId}/rules/validate`);
}
