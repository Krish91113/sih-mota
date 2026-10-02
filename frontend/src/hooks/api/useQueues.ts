import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import * as queueApi from "@/api/queue";

export function useOfficerQueueQuery(enabled = true) {
  return useQuery({
    queryKey: ["officer", "queue"],
    queryFn: () => queueApi.getOfficerQueue(),
    enabled,
  });
}

export function useApprovalsQueueQuery(
  params?: Record<string, string | number | boolean | undefined>,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.approvals.queue(),
    queryFn: () => queueApi.getApprovalsQueue(params),
    enabled,
  });
}
