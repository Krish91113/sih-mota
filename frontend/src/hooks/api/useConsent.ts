/** TanStack Query hooks for applicant consent. */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/queryKeys";
import * as consentApi from "@/api/consent";
import type { QueryParams } from "@/api/types";
import { withoutUndefined } from "@/lib/utils";

export function useCurrentConsentQuery(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.consent.current(params),
    queryFn: () => consentApi.getCurrentConsent(params),
  });
}

export function useConsentHistoryQuery(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.consent.history(params),
    queryFn: () => consentApi.listConsentHistory(params),
  });
}

function useInvalidateConsent() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.consent.all });
    void qc.invalidateQueries({ queryKey: queryKeys.applications.all });
  };
}

export function useCreateConsentMutation() {
  const invalidate = useInvalidateConsent();
  return useMutation({
    mutationFn: (data: Parameters<typeof consentApi.createConsent>[0]) =>
      consentApi.createConsent(data),
    onSuccess: invalidate,
  });
}

export function useRevokeConsentMutation() {
  const invalidate = useInvalidateConsent();
  return useMutation({
    mutationFn: (vars: { id: string; reason?: string }) =>
      consentApi.revokeConsent(vars.id, withoutUndefined({ reason: vars.reason })),
    onSuccess: invalidate,
  });
}
