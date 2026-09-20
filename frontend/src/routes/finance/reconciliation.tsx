import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatusBadge, KpiCard } from "@/components/mota/bits";
import { Card, CardContent } from "@/components/ui/card";
import { useFinanceReconciliationQuery } from "@/hooks/api/useFinance";
import { ArrowLeftRight, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/finance/reconciliation")({
  head: () => ({
    meta: [{ title: "Reconciliation | Finance & Disbursement" }],
  }),
  component: FinanceReconciliation,
});

function FinanceReconciliation() {
  const { data: reconciliation = [], isLoading, isError } = useFinanceReconciliationQuery();

  const matched = reconciliation.filter(
    (r) => r.status === "MATCHED" || r.status === "RECORDED",
  ).length;
  const open = reconciliation.filter(
    (r) => r.status !== "MATCHED" && r.status !== "RECORDED",
  ).length;

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading reconciliation…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load reconciliation data.</p>;

  return (
    <div>
      <PageHeader
        title="Reconciliation"
        desc="Match system records against bank statements and PFMS for every disbursement batch."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Matched batches" value={String(matched)} icon={CheckCircle2} />
        <KpiCard label="Needs attention" value={String(open)} icon={Clock} />
        <KpiCard
          label="Total batches"
          value={String(reconciliation.length)}
          icon={ArrowLeftRight}
        />
      </div>

      <div className="space-y-4">
        {reconciliation.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">
            No reconciliation records recorded yet.
          </p>
        ) : (
          reconciliation.map((rec) => (
            <Card key={rec.id} className="shadow-card">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="size-4 text-primary" aria-hidden />
                    <span className="font-semibold">{rec.id}</span>
                    <span className="text-xs text-muted-foreground">Award: {rec.award_id}</span>
                  </div>
                  <StatusBadge status={rec.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-t pt-3 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-4">
                    <span>
                      Provider: <strong className="text-foreground">{rec.provider ?? "—"}</strong>
                    </span>
                    <span>
                      Ref:{" "}
                      <strong className="text-foreground">{rec.external_reference ?? "—"}</strong>
                    </span>
                    <span>
                      Amount:{" "}
                      <strong className="text-primary font-semibold">
                        {typeof rec.amount === "number" ? `₹${rec.amount.toLocaleString()}` : "—"}
                      </strong>
                    </span>
                  </div>
                  {rec.created_at && <span>{new Date(rec.created_at).toLocaleDateString()}</span>}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
