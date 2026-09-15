/** Workflow API — maps to /workflows/*, /workflow-assignments/* */
import { api } from "./client";

export function getWorkflow(id: string) {
  return api.get(`/workflows/${id}`);
}

export function updateWorkflow(
  id: string,
  data: { name: string; version?: number; definition?: Record<string, unknown> },
) {
  return api.put(`/workflows/${id}`, data);
}

export function validateWorkflow(id: string) {
  return api.post(`/workflows/${id}/validate`);
}

// ── Assignments ──────────────────────────────────────────────────────────────

export function pauseAssignment(assignmentId: string) {
  return api.post(`/workflow-assignments/${assignmentId}/pause`);
}

export function resumeAssignment(assignmentId: string) {
  return api.post(`/workflow-assignments/${assignmentId}/resume`);
}

export function breachAssignment(assignmentId: string) {
  return api.post(`/workflow-assignments/${assignmentId}/breach`);
}

export function escalateAssignment(assignmentId: string) {
  return api.post(`/workflow-assignments/${assignmentId}/escalate`);
}

export function completeAssignment(assignmentId: string) {
  return api.post(`/workflow-assignments/${assignmentId}/complete`);
}
