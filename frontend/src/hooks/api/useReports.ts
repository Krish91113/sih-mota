/** TanStack Query hooks for Reports & Audit */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import * as reportApi from "@/api/reports";
import * as auditApi from "@/api/audit";

export function useReportSummaryQuery(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.reports.summary(params),
    queryFn: () => reportApi.getReportSummary(params),
  });
}

export function useExecutiveReportQuery(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.reports.executive(params),
    queryFn: () => reportApi.getExecutiveReport(params),
  });
}

export function useOperationalReportQuery(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.reports.operational(params),
    queryFn: () => reportApi.getOperationalReport(params),
  });
}

export function useSchemeReportQuery(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.reports.scheme(params),
    queryFn: () => reportApi.getSchemeReport(params),
  });
}

export function useProcessingTimeReportQuery(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.reports.processing(params),
    queryFn: () => reportApi.getProcessingTimeReport(params),
  });
}

export function useSelectionReportQuery(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.reports.selection(params),
    queryFn: () => reportApi.getSelectionReport(params),
  });
}

export function useAuditEventsQuery(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.audit.list(params),
    queryFn: () => auditApi.listAuditEvents(params),
  });
}
