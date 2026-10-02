/** TanStack Query hooks for the trust & verification workspace. */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/queryKeys";
import * as vApi from "@/api/verification";
import type { QueryParams } from "@/api/types";
import { withoutUndefined } from "@/lib/utils";

// ── Verification cases ────────────────────────────────────────────────────────

export function useVerificationCasesQuery(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.verification.cases(params),
    queryFn: () => vApi.listVerificationCases(params),
  });
}

export function useVerificationCaseQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.verification.case(id),
    queryFn: () => vApi.getVerificationCase(id),
    enabled: !!id,
  });
}

function useInvalidateVerification() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.verification.all });
    void qc.invalidateQueries({ queryKey: queryKeys.applications.all });
  };
}

export function useCreateVerificationCaseMutation() {
  const invalidate = useInvalidateVerification();
  return useMutation({
    mutationFn: (vars: { applicationId: string; priority?: string; assigned_to?: string }) =>
      vApi.createVerificationCaseForApplication(
        vars.applicationId,
        withoutUndefined({ priority: vars.priority, assigned_to: vars.assigned_to }),
      ),
    onSuccess: invalidate,
  });
}

export function useAssignVerificationCaseMutation() {
  const invalidate = useInvalidateVerification();
  return useMutation({
    mutationFn: (vars: { id: string; assignee_id: string }) =>
      vApi.assignVerificationCase(vars.id, { assignee_id: vars.assignee_id }),
    onSuccess: invalidate,
  });
}

export function useCompleteVerificationCaseMutation() {
  const invalidate = useInvalidateVerification();
  return useMutation({
    // The endpoint takes no request body and `VerificationCase` has no summary
    // or note column — findings are recorded separately via createFinding.
    mutationFn: (vars: { id: string }) => vApi.completeVerificationCase(vars.id),
    onSuccess: invalidate,
  });
}

export function useReturnVerificationCaseMutation() {
  const invalidate = useInvalidateVerification();
  return useMutation({
    mutationFn: (vars: { id: string; reason?: string }) =>
      vApi.returnVerificationCase(vars.id, withoutUndefined({ reason: vars.reason })),
    onSuccess: invalidate,
  });
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export function useApplicationEvidenceQuery(applicationId: string, params?: QueryParams) {
  return useQuery({
    queryKey: [...queryKeys.verification.evidence(applicationId), params] as const,
    queryFn: () => vApi.listApplicationEvidence(applicationId, params),
    enabled: !!applicationId,
  });
}

export function useCreateEvidenceMutation() {
  const invalidate = useInvalidateVerification();
  return useMutation({
    mutationFn: (vars: Parameters<typeof vApi.createEvidence>[1] & { applicationId: string }) => {
      const { applicationId, ...body } = vars;
      return vApi.createEvidence(applicationId, body);
    },
    onSuccess: invalidate,
  });
}

export function useVerifyEvidenceMutation() {
  const invalidate = useInvalidateVerification();
  return useMutation({
    mutationFn: (vars: { id: string; notes?: string }) =>
      vApi.verifyEvidence(vars.id, withoutUndefined({ notes: vars.notes })),
    onSuccess: invalidate,
  });
}

// ── Findings ──────────────────────────────────────────────────────────────────

export function useApplicationFindingsQuery(applicationId: string, params?: QueryParams) {
  return useQuery({
    queryKey: [...queryKeys.verification.findings(applicationId), params] as const,
    queryFn: () => vApi.listApplicationFindings(applicationId, params),
    enabled: !!applicationId,
  });
}

export function useCreateFindingMutation() {
  const invalidate = useInvalidateVerification();
  return useMutation({
    mutationFn: (vars: Parameters<typeof vApi.createFinding>[1] & { applicationId: string }) => {
      const { applicationId, ...body } = vars;
      return vApi.createFinding(applicationId, body);
    },
    onSuccess: invalidate,
  });
}

export function useResolveFindingMutation() {
  const invalidate = useInvalidateVerification();
  return useMutation({
    mutationFn: (vars: { id: string; resolution?: string; resolution_notes?: string }) =>
      vApi.resolveFinding(
        vars.id,
        withoutUndefined({ resolution: vars.resolution, resolution_notes: vars.resolution_notes }),
      ),
    onSuccess: invalidate,
  });
}

// ── Decision traces ───────────────────────────────────────────────────────────

export function useDecisionTracesQuery(applicationId: string, params?: QueryParams) {
  return useQuery({
    queryKey: [...queryKeys.verification.decisionTraces(applicationId), params] as const,
    queryFn: () => vApi.listDecisionTraces(applicationId, params),
    enabled: !!applicationId,
  });
}

export function useCreateDecisionTraceMutation() {
  const invalidate = useInvalidateVerification();
  return useMutation({
    mutationFn: (
      vars: Parameters<typeof vApi.createDecisionTrace>[1] & { applicationId: string },
    ) => {
      const { applicationId, ...body } = vars;
      return vApi.createDecisionTrace(applicationId, body);
    },
    onSuccess: invalidate,
  });
}

// ── Duplicate checks ──────────────────────────────────────────────────────────

export function useDuplicateChecksQuery(applicationId: string, params?: QueryParams) {
  return useQuery({
    queryKey: [...queryKeys.verification.duplicateChecks(applicationId), params] as const,
    queryFn: () => vApi.getDuplicateChecks(applicationId, params),
    enabled: !!applicationId,
  });
}

export function useRunDuplicateCheckMutation() {
  const invalidate = useInvalidateVerification();
  return useMutation({
    mutationFn: (applicationId: string) => vApi.runDuplicateCheck(applicationId),
    onSuccess: invalidate,
  });
}

// ── Eligibility ───────────────────────────────────────────────────────────────

export function useEligibilityRunQuery(runId: string) {
  return useQuery({
    queryKey: queryKeys.verification.eligibilityRun(runId),
    queryFn: () => vApi.getEligibilityRun(runId),
    enabled: !!runId,
  });
}
