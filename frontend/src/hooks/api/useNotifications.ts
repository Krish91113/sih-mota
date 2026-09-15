/** TanStack Query hooks for Notifications */
import { useQuery } from "@tanstack/react-query";
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
