/** Finance API — maps to /awards/*, /finance/*, /payment-exceptions/* */
import { api } from "./client";

export interface Award {
  id: string;
  application_id: string;
  status: string;
  amount: number | null;
  scheme_version_id?: string | null;
  awarded_by?: string | null;
  award_date?: string | null;
  [key: string]: unknown;
}

export function listAwards(params?: Record<string, string | number | boolean | undefined>) {
  return api.get<Award[]>("/awards", { params });
}

export function getAward(awardId: string) {
  return api.get<Award>(`/awards/${awardId}`);
}

export interface FinanceRecord {
  id: string;
  award_id: string;
  record_type: string;
  amount: number | null;
  status: string;
  provider?: string | null;
  external_reference?: string | null;
  [key: string]: unknown;
}

export function listFinanceRecords() {
  return api.get<FinanceRecord[]>("/finance/records");
}

export function getFinanceRecords(awardId: string) {
  return api.get<FinanceRecord[]>(`/awards/${awardId}/finance-records`);
}

export function createFinanceRecord(awardId: string, data: Record<string, unknown>) {
  return api.post(`/awards/${awardId}/finance-records`, data);
}

export function getInstallments(awardId: string) {
  return api.get(`/awards/${awardId}/installments`);
}

export function createInstallment(awardId: string, data: Record<string, unknown>) {
  return api.post(`/awards/${awardId}/installments`, data);
}

export function createSanction(data: Record<string, unknown>) {
  return api.post("/finance/sanctions", data);
}

export function createDisbursement(data: Record<string, unknown>) {
  return api.post("/finance/disbursements", data);
}

export function payInstallment(installmentId: string, data?: Record<string, unknown>) {
  return api.post(`/finance/installments/${installmentId}/pay`, data);
}

export function reconcile(data: Record<string, unknown>) {
  return api.post("/finance/reconciliation", data);
}

export interface FinanceException {
  id: string;
  status: string;
  reason: string;
  finance_record_id?: string | null;
  award_id?: string | null;
  expected_amount?: number | null;
  amount?: number | null;
  actual_amount?: number | null;
  difference?: number | null;
  resolved_at?: string | null;
  [key: string]: unknown;
}

export interface ReconciliationRecord {
  id: string;
  award_id: string;
  record_type: string;
  amount: number | null;
  status: string;
  provider?: string | null;
  external_reference?: string | null;
  expected_amount?: number | null;
  actual_amount?: number | null;
  difference?: number | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export function listExceptions(params?: Record<string, string | number | boolean | undefined>) {
  return api.get<FinanceException[]>("/finance/exceptions", { params });
}

export function getException(id: string) {
  return api.get<FinanceException>(`/finance/exceptions/${id}`);
}

export function createException(data: Record<string, unknown>) {
  return api.post<FinanceException>("/finance/exceptions", data);
}

export function resolveException(exceptionId: string, data?: Record<string, unknown>) {
  return api.post<FinanceException>(`/finance/exceptions/${exceptionId}/resolve`, data);
}

export function reopenException(exceptionId: string, data?: Record<string, unknown>) {
  return api.post<FinanceException>(`/finance/exceptions/${exceptionId}/reopen`, data);
}

export function listReconciliation(params?: Record<string, string | number | boolean | undefined>) {
  return api.get<ReconciliationRecord[]>("/finance/reconciliation", { params });
}

export function createReconciliation(data: Record<string, unknown>) {
  return api.post<ReconciliationRecord>("/finance/reconciliation", data);
}

export function getReconciliation(id: string) {
  return api.get<ReconciliationRecord>(`/finance/reconciliation/${id}`);
}
