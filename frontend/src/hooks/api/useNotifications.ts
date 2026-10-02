/** TanStack Query hooks for Notifications */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import * as notifApi from "@/api/notifications";

export function useNotificationsQuery(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => notifApi.listNotifications(params),
    refetchInterval: 60 * 1000, // Poll every minute
  });
}

export function useSentNotificationsQuery(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.notifications.sent(params),
    queryFn: () => notifApi.listSentNotifications(params),
  });
}

export function useSendNotificationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => notifApi.createNotification(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkNotificationsReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notifApi.markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
