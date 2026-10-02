/** Reports API — maps to /reports/* */
import { api } from "./client";

export function getReportSummary(params?: Record<string, string | number | boolean | undefined>) {
  return api.get("/reports/summary", { params });
}

export function getExecutiveReport(params?: Record<string, string | number | boolean | undefined>) {
  return api.get("/reports/executive", { params });
}

export function getOperationalReport(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return api.get("/reports/operational", { params });
}

export function getSchemeReport(params?: Record<string, string | number | boolean | undefined>) {
  return api.get("/reports/scheme", { params });
}

export function getProcessingTimeReport(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return api.get("/reports/processing-time", { params });
}

export function getSelectionReport(params?: Record<string, string | number | boolean | undefined>) {
  return api.get("/reports/selection", { params });
}

export function getGrievanceReport(params?: Record<string, string | number | boolean | undefined>) {
  return api.get("/reports/grievances", { params });
}

export function exportReport(params?: Record<string, string | number | boolean | undefined>) {
  return api.get("/reports/summary/export", { params });
}
