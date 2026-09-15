import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as institutionApi from "@/api/institutions";
import { queryKeys } from "@/lib/query/queryKeys";

export function useInstitutionsQuery() {
  return useQuery({
    queryKey: queryKeys.institutions.all,
    queryFn: institutionApi.listInstitutions,
  });
}

export function useInstitutionQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.institutions.detail(id),
    queryFn: () => institutionApi.getInstitution(id),
    enabled: !!id,
  });
}

export function useInstitutionUsersQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.institutions.users(id),
    queryFn: () => institutionApi.getInstitutionUsers(id),
    enabled: !!id,
  });
}

export function useVerifyInstitutionApplicationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      data,
    }: {
      applicationId: string;
      data: { result: string; fields?: Record<string, unknown>; note?: string };
    }) => institutionApi.verifyInstitutionApplication(applicationId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.detail(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.timeline(variables.applicationId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
    },
  });
}

export function useRequestClarificationMutation() {
  return useMutation({
    mutationFn: ({
      applicationId,
      data,
    }: {
      applicationId: string;
      data?: Record<string, unknown>;
    }) => institutionApi.requestClarification(applicationId, data),
  });
}
