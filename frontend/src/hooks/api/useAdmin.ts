import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import * as adminApi from "@/api/admin";

export function useCalendarsQuery() {
  return useQuery({
    queryKey: ["admin", "calendars"],
    queryFn: () => adminApi.listCalendars(),
  });
}

export function useHolidaysQuery() {
  return useQuery({
    queryKey: ["admin", "holidays"],
    queryFn: () => adminApi.listHolidays(),
  });
}

export function useCreateCalendarMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => adminApi.createCalendar(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "calendars"] });
    },
  });
}

export function useUpdateCalendarMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      adminApi.updateCalendar(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "calendars"] });
    },
  });
}

export function useCreateHolidayMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => adminApi.createHoliday(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "holidays"] });
    },
  });
}

export function useApprovalsQueueQuery(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.approvals.queue(),
    queryFn: () => adminApi.getApprovalsQueue(params),
  });
}

export function useNotificationTemplatesQuery() {
  return useQuery({
    queryKey: ["admin", "notification-templates"],
    queryFn: () => adminApi.listNotificationTemplates(),
  });
}

export function useCreateNotificationTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof adminApi.createNotificationTemplate>[0]) =>
      adminApi.createNotificationTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "notification-templates"] });
    },
  });
}
