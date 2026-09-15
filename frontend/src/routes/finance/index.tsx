import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard, StatusBadge } from "@/components/mota/bits";
import {
  useAwardsQuery,
  useFinanceExceptionsQuery,
  useFinanceReconciliationQuery,
} from "@/hooks/api/useFinance";
import { ArrowRight, Banknote, Landmark, ShieldAlert, Wallet, CheckCircle2 } from "lucide-react";

interface AwardSummaryItem {
  id: string;
  scheme?: string;
  scheme_name?: string;
  amount?: number | string;
  status?: string;
  external_reference?: string;
  batch?: string;
  applicant_name?: string;
  applicant?: string;
  created_at?: string;
}

interface FinanceExceptionSummaryItem {
  id: string;
  status?: string;
}

interface ReconciliationSummaryItem {
  id: string;
  provider?: string;
  amount?: number | string;
}

export const Route = createFileRoute("/finance/")({
  head: () => ({
    meta: [{ title: "Finance Dashboard | Finance & Disbursement" }],
  }),
  component: FinanceDashboard,
});

function FinanceDashboard() {
  const awardsQuery = useAwardsQuery();
  const exceptionsQuery = useFinanceExceptionsQuery();
  const reconciliationQuery = useFinanceReconciliationQuery();

  const isLoading =
    awardsQuery.isLoading || exceptionsQuery.isLoading || reconciliationQuery.isLoading;
  const isError = awardsQuery.isError && exceptionsQuery.isError;

  const rawAwards: AwardSummaryItem[] =
    (awardsQuery.data as { data?: AwardSummaryItem[] })?.data ||
    (Array.isArray(awardsQuery.data) ? (awardsQuery.data as AwardSummaryItem[]) : []) ||
    [];
  const rawExceptions: FinanceExceptionSummaryItem[] =
    (exceptionsQuery.data as { data?: FinanceExceptionSummaryItem[] })?.data ||
    (Array.isArray(exceptionsQuery.data)
      ? (exceptionsQuery.data as FinanceExceptionSummaryItem[])
      : []) ||
    [];
  const rawReconciliation: ReconciliationSummaryItem[] =
    (reconciliationQuery.data as { data?: ReconciliationSummaryItem[] })?.data ||
    (Array.isArray(reconciliationQuery.data)
      ? (reconciliationQuery.data as ReconciliationSummaryItem[])
      : []) ||
    [];

  const openExceptions = rawExceptions.filter(
    (e: FinanceExceptionSummaryItem) => e.status !== "RESOLVED",
  ).length;
  const totalSanctions = rawAwards.length;
  const totalAmount = rawAwards.reduce((sum: number, a: AwardSummaryItem) => {
    const val =
      typeof a.amount === "number"
        ? a.amount
        : parseFloat(String(a.amount).replace(/[^0-9.-]+/g, "")) || 0;
    return sum + val;
  }, 0);

  const recentDisbursement = rawAwards[0]
    ? {
        id: String(rawAwards[0].id),
        batch: String(rawAwards[0].external_reference || rawAwards[0].batch || "Batch-1"),
        applicant: String(rawAwards[0].applicant_name || rawAwards[0].applicant || "Beneficiary"),
        amount: rawAwards[0].amount ? `₹${Number(rawAwards[0].amount).toLocaleString()}` : "—",
        date: rawAwards[0].created_at
          ? new Date(rawAwards[0].created_at).toLocaleDateString()
          : "Recent",
      }
    : null;

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading finance dashboard…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load finance data.</p>;

  return (
    <div>
      <PageHeader
        title="Finance dashboard"
        desc="Sanctions, disbursement batches and reconciliation for financial year 2026-27."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Sanctions count" value={String(totalSanctions)} icon={Landmark} />
        <KpiCard
          label="Total sanction value"
          value={totalAmount > 0 ? `₹${totalAmount.toLocaleString()}` : "—"}
          icon={Banknote}
        />
        <KpiCard
          label="Reconciliation records"
          value={String(rawReconciliation.length)}
          icon={Wallet}
        />
        <KpiCard label="Open exceptions" value={String(openExceptions)} icon={ShieldAlert} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader className="flex-row items-center justify-between border-b border-dashed pb-3">
            <CardTitle className="text-base">Active sanctions & awards</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-primary">
              <Link to="/finance/sanctions">
                All sanctions <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Sanction ref</th>
                    <th className="px-4 py-3 font-semibold">Scheme</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rawAwards.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-sm text-muted-foreground text-center"
                      >
                        No active awards found.
                      </td>
                    </tr>
                  ) : null}
                  {rawAwards.slice(0, 5).map((s: AwardSummaryItem) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-semibold">{s.id}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.scheme || s.scheme_name || "Scheme"}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        ₹{Number(s.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status || "Sanctioned"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Latest award</CardTitle>
            </CardHeader>
            <CardContent className="p-5 text-sm">
              {recentDisbursement ? (
                <dl className="space-y-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Ref</dt>
                    <dd className="font-medium">{recentDisbursement.id}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Beneficiary</dt>
                    <dd className="font-medium">{recentDisbursement.applicant}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd className="font-medium">{recentDisbursement.amount}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Date</dt>
                    <dd className="text-muted-foreground">{recentDisbursement.date}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-xs text-muted-foreground">No recent disbursements.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/30 bg-destructive/2 shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="size-4 text-destructive" aria-hidden /> Exceptions to clear
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-3xl font-display text-destructive">{openExceptions}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Payment exceptions awaiting resolution
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link to="/finance/exceptions">
                  Open exceptions desk <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6 shadow-card">
        <CardHeader className="flex-row items-center justify-between border-b border-dashed pb-3">
          <CardTitle className="text-base">Reconciliation status</CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-primary">
            <Link to="/finance/reconciliation">
              All reconciliation <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          {rawReconciliation.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reconciliation entries recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {rawReconciliation.slice(0, 3).map((r: ReconciliationSummaryItem) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-leaf" />
                    <span>{r.id}</span>
                    <span className="text-xs text-muted-foreground">
                      Provider: {r.provider || "PFMS"}
                    </span>
                  </div>
                  <span className="font-semibold text-primary">
                    ₹{Number(r.amount || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
