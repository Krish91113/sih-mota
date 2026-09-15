/** TanStack Query hooks for Finance & Awards */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import * as finApi from "@/api/finance";

export function useFinanceExceptionsQuery(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.finance.exceptions(params),
    queryFn: () => finApi.listExceptions(params),
  });
}

export function useFinanceReconciliationQuery(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.finance.reconciliation(params),
    queryFn: () => finApi.listReconciliation(params),
  });
}

export function useFinanceRecordsQuery() {
  return useQuery({
    queryKey: ["finance", "records"],
    queryFn: finApi.listFinanceRecords,
  });
}

export function useAwardsQuery(params?: Record<string, string | number | boolean | undefined>) {
  return useQuery({
    queryKey: queryKeys.awards.list(params),
    queryFn: () => finApi.listAwards(params),
  });
}

export function useAwardQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.awards.detail(id),
    queryFn: () => finApi.getAward(id),
    enabled: !!id,
  });
}

export function useAwardFinanceRecordsQuery(awardId: string) {
  return useQuery({
    queryKey: queryKeys.awards.financeRecords(awardId),
    queryFn: () => finApi.getFinanceRecords(awardId),
    enabled: !!awardId,
  });
}

export function useInstallmentsQuery(awardId: string) {
  return useQuery({
    queryKey: queryKeys.awards.installments(awardId),
    queryFn: () => finApi.getInstallments(awardId),
    enabled: !!awardId,
  });
}

export function useCreateSanctionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: finApi.createSanction,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.awards.all }),
  });
}

export function useCreateDisbursementMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: finApi.createDisbursement,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.awards.all }),
  });
}

export function useResolveExceptionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) =>
      finApi.resolveException(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.finance.exceptions() });
      qc.invalidateQueries({ queryKey: queryKeys.awards.all });
    },
  });
}

export function useReopenExceptionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) =>
      finApi.reopenException(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.finance.exceptions() });
      qc.invalidateQueries({ queryKey: queryKeys.awards.all });
    },
  });
}

export function useCreateReconciliationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => finApi.createReconciliation(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.finance.reconciliation() });
    },
  });
}

export function usePayInstallmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) =>
      finApi.payInstallment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.awards.all });
    },
  });
}
