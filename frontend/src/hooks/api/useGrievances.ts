/** TanStack Query hooks for Grievances */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import * as gApi from "@/api/grievances";

export function useGrievancesQuery(params?: Record<string, string | number | boolean | undefined>) {
  return useQuery({
    queryKey: queryKeys.grievances.list(params),
    queryFn: () => gApi.listGrievances(params),
  });
}

export function useGrievanceQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.grievances.detail(id),
    queryFn: () => gApi.getGrievance(id),
    enabled: !!id,
  });
}

export function useCreateGrievanceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: gApi.createGrievance,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.grievances.all }),
  });
}

export function useAddGrievanceMessageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { message: string } }) =>
      gApi.addGrievanceMessage(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.grievances.detail(vars.id) });
    },
  });
}

export function useTransitionGrievanceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      gApi.transitionGrievance(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.grievances.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.grievances.all });
    },
  });
}
