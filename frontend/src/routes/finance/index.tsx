import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard, StatusBadge } from "@/components/mota/bits";
import {
  useAwardsQuery,
  useFinanceExceptionsQuery,
  useFinanceReconciliationQuery,
} from "@/hooks/api/useFinance";
import { ArrowRight, Banknote, Landmark, ShieldAlert, Wallet } from "lucide-react";

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
  const isError = awardsQuery.isError || exceptionsQuery.isError || reconciliationQuery.isError;

  const awards = awardsQuery.data ?? [];
  const exceptions = exceptionsQuery.data ?? [];
  const reconciliation = reconciliationQuery.data ?? [];

  const openExceptions = exceptions.filter((e) => e.status !== "RESOLVED").length;
  const totalAmount = awards.reduce((sum, a) => sum + (a.amount ?? 0), 0);

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading finance dashboard…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load finance data.</p>;

  return (
    <div>
      <PageHeader
        title="Finance dashboard"
        desc="Sanctions, disbursement batches and reconciliation across all schemes."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Awards" value={String(awards.length)} icon={Landmark} />
        <KpiCard
          label="Total award value"
          value={totalAmount > 0 ? `₹${totalAmount.toLocaleString()}` : "—"}
          icon={Banknote}
        />
        <KpiCard
          label="Reconciliation records"
          value={String(reconciliation.length)}
          icon={Wallet}
        />
        <KpiCard label="Open exceptions" value={String(openExceptions)} icon={ShieldAlert} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader className="flex-row items-center justify-between border-b border-dashed pb-3">
            <CardTitle className="text-base">Active sanctions & awards</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-primary">
              <Link to="/finance/awards">
                All awards <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Award ref</th>
                    <th className="px-4 py-3 font-semibold">Application</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {awards.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-sm text-muted-foreground text-center"
                      >
                        No active awards found.
                      </td>
                    </tr>
                  ) : null}
                  {awards.slice(0, 5).map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-semibold">{a.id}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {a.application_id}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {typeof a.amount === "number" ? `₹${a.amount.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} />
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
              {awards[0] ? (
                <dl className="space-y-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Ref</dt>
                    <dd className="font-medium">{awards[0].id}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Application</dt>
                    <dd className="font-mono text-xs">{awards[0].application_id}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd className="font-medium">
                      {typeof awards[0].amount === "number"
                        ? `₹${awards[0].amount.toLocaleString()}`
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Date</dt>
                    <dd className="text-muted-foreground">
                      {awards[0].award_date
                        ? new Date(String(awards[0].award_date)).toLocaleDateString()
                        : "—"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-xs text-muted-foreground">No awards recorded yet.</p>
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
          {reconciliation.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reconciliation entries recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {reconciliation.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span>{r.id}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <span className="font-semibold text-primary">
                    {typeof r.actual_amount === "number"
                      ? `₹${r.actual_amount.toLocaleString()}`
                      : "—"}
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
