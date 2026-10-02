/** TanStack Query hooks for Applications */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import * as appApi from "@/api/applications";

export function useApplicationsQuery(
  filters?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.applications.list(filters),
    queryFn: () => appApi.listApplications(filters),
  });
}

export function useApplicationQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.applications.detail(id),
    queryFn: () => appApi.getApplication(id),
    enabled: !!id,
  });
}

export function useApplicationTimelineQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.applications.timeline(id),
    queryFn: () => appApi.getApplicationTimeline(id),
    enabled: !!id,
  });
}

export function useApplicationStatusQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.applications.status(id),
    queryFn: () => appApi.getApplicationStatus(id),
    enabled: !!id,
  });
}

export function useAvailableTransitionsQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.applications.transitions(id),
    queryFn: () => appApi.getAvailableTransitions(id),
    enabled: !!id,
  });
}

export function useApplicationSlaQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.applications.sla(id),
    queryFn: () => appApi.getApplicationSla(id),
    enabled: !!id,
  });
}

export function useApplicationAnswersQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.applications.answers(id),
    queryFn: () => appApi.getApplicationAnswers(id),
    enabled: !!id,
  });
}

export function useEligibilityQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.applications.eligibility(id),
    queryFn: () => appApi.getLatestEligibility(id),
    enabled: !!id,
  });
}

export function useApprovalPacketQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.applications.approvalPacket(id),
    queryFn: () => appApi.getApprovalPacket(id),
    enabled: !!id,
  });
}

export function useDecisionPacketQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.applications.decisionPacket(id),
    queryFn: () => appApi.getDecisionPacket(id),
    enabled: !!id,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateApplicationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      data,
      idempotencyKey,
    }: {
      data: Parameters<typeof appApi.createApplication>[0];
      idempotencyKey: string;
    }) => appApi.createApplication(data, idempotencyKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.applications.all }),
  });
}

export function useSaveApplicationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof appApi.updateApplication>[1];
    }) => appApi.updateApplication(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.applications.detail(vars.id) });
    },
  });
}

export function useSubmitApplicationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey: string }) =>
      appApi.submitApplication(id, idempotencyKey),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.applications.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.applications.all });
    },
  });
}

export function useValidateApplicationMutation() {
  return useMutation({
    mutationFn: (id: string) => appApi.validateApplication(id),
  });
}

export function useApproveApplicationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) =>
      appApi.approveApplication(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.applications.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.approvals.queue() });
    },
  });
}

export function useRejectApplicationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) =>
      appApi.rejectApplication(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.applications.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.approvals.queue() });
    },
  });
}

export function useReturnApplicationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) =>
      appApi.returnApplication(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.applications.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.approvals.queue() });
    },
  });
}

export function useHoldApprovalMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) =>
      appApi.holdApproval(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.applications.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.approvals.queue() });
    },
  });
}

export function useCreateAwardMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) =>
      appApi.createAward(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.awards.all });
    },
  });
}
