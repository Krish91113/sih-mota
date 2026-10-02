/** Dashboard KPI API — maps to /dashboard/kpis and /reports/dashboard-kpis. */
import { api } from "./client";
import type { QueryParams } from "./types";

/**
 * Shape returned by `GET /dashboard/kpis`.
 * Every group is present for every caller; figures are scoped by the
 * backend to what the authenticated role is allowed to see.
 */
export interface DashboardKpis {
  generated_at: string;

  application_kpis: {
    total_applications: number;
    draft: number;
    submitted: number;
    under_review: number;
    deficiency: number;
    eligible: number;
    rejected: number;
    awarded: number;
    completed: number;
  };

  processing_kpis: {
    average_processing_time_days: number;
    pending_applications: number;
    sla_breaches: number;
    applications_by_stage: Record<string, number>;
  };

  selection_kpis: {
    candidates_reviewed: number;
    selected: number;
    rejected: number;
    selection_completion_rate: number;
    total_rounds: number;
    finalized_rounds: number;
  };

  finance_kpis: {
    sanctioned_amount: number;
    disbursed_amount: number;
    pending_payments: number;
    successful_payments: number;
    failed_payments: number;
    returned_payments: number;
    reconciled_payments: number;
  };

  grievance_kpis: {
    open: number;
    in_progress: number;
    resolved: number;
    overdue: number;
  };
}

export function getDashboardKpis(params?: QueryParams) {
  return api.get<DashboardKpis>("/dashboard/kpis", { params });
}

/** Reporting mirror of the same KPI set — used by the analytics console. */
export function getReportDashboardKpis(params?: QueryParams) {
  return api.get<DashboardKpis>("/reports/dashboard-kpis", { params });
}
