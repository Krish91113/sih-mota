import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import * as queueApi from "@/api/queue";

export function useOfficerQueueQuery() {
  return useQuery({
    queryKey: ["officer", "queue"],
    queryFn: () => queueApi.getOfficerQueue(),
  });
}

export function useApprovalsQueueQuery(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.approvals.queue(),
    queryFn: () => queueApi.getApprovalsQueue(params),
  });
}
