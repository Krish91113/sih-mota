/** Queue API — maps to officer and approval work queues. */
import { api } from "./client";

export interface QueueRow {
  id: string;
  application_number: string | null;
  applicant: string | null;
  applicant_id: string | null;
  scheme: string | null;
  scheme_code: string | null;
  stage: string;
  status: string;
  priority: "High" | "Medium" | "Low";
  sla_days: number;
  score?: number | null;
  committee?: string | null;
  scrutiny?: string | null;
  institution?: string | null;
  created_at: string | null;
}

export function getOfficerQueue() {
  return api.get<QueueRow[]>("/officer/queue");
}

export function getApprovalsQueue(params?: Record<string, string | number | boolean | undefined>) {
  return api.get<QueueRow[]>("/approvals/queue", { params });
}
