import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/mota/bits";
import {
  useFinanceExceptionsQuery,
  useResolveExceptionMutation,
  useReopenExceptionMutation,
} from "@/hooks/api/useFinance";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/finance/exceptions")({
  head: () => ({
    meta: [{ title: "Exceptions | Finance & Disbursement" }],
  }),
  component: FinanceExceptions,
});

function FinanceExceptions() {
  const exceptionsQuery = useFinanceExceptionsQuery();
  const resolveMutation = useResolveExceptionMutation();
  const reopenMutation = useReopenExceptionMutation();

  const exceptions = exceptionsQuery.data ?? [];
  const openCount = exceptions.filter((e) => e.status !== "RESOLVED").length;
  const resolvedCount = exceptions.filter((e) => e.status === "RESOLVED").length;

  const handleResolve = async (id: string) => {
    try {
      await resolveMutation.mutateAsync({ id });
      toast.success(`Exception ${id} marked resolved`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : `Could not resolve exception ${id}`;
      toast.error(errorMsg);
    }
  };

  const handleReopen = async (id: string) => {
    try {
      await reopenMutation.mutateAsync({ id });
      toast.success(`Exception ${id} reopened`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : `Could not reopen exception ${id}`;
      toast.error(errorMsg);
    }
  };

  if (exceptionsQuery.isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading exceptions…</p>;
  if (exceptionsQuery.isError)
    return (
      <p className="py-8 text-sm text-destructive">We could not load finance exceptions data.</p>
    );

  return (
    <div>
      <PageHeader
        title="Exceptions desk"
        desc="Payment failures, discrepancy alerts, and blocks that need manual intervention."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="border-destructive/30 bg-destructive/[0.02] shadow-card">
          <CardContent className="p-4 text-center">
            <p className="font-display text-2xl text-destructive">{openCount}</p>
            <p className="text-xs text-muted-foreground">Open exceptions</p>
          </CardContent>
        </Card>
        <Card className="border-leaf/30 bg-leaf/5 shadow-card">
          <CardContent className="p-4 text-center">
            <p className="font-display text-2xl text-leaf">{resolvedCount}</p>
            <p className="text-xs text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4 text-center">
            <p className="font-display text-2xl">{exceptions.length}</p>
            <p className="text-xs text-muted-foreground">Total records</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {exceptions.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">
            No exceptions currently require attention.
          </p>
        ) : (
          exceptions.map((e) => {
            const isResolved = e.status === "RESOLVED";
            return (
              <Card
                key={e.id}
                className={`shadow-card ${!isResolved ? "border-destructive/40 bg-destructive/[0.01]" : "border-leaf/30"}`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {isResolved ? (
                        <CheckCircle2 className="size-4 text-leaf" aria-hidden />
                      ) : (
                        <AlertTriangle className="size-4 text-amber-500" aria-hidden />
                      )}
                      <span className="font-semibold">{e.id}</span>
                      <span className="text-xs text-muted-foreground">
                        Ref: {e.finance_record_id ?? e.award_id ?? "—"}
                      </span>
                    </div>
                    <StatusBadge status={e.status} />
                  </div>
                  <p className="mt-2 text-sm font-medium">{e.reason}</p>

                  {(e.expected_amount != null || e.actual_amount != null) && (
                    <div className="mt-3 flex flex-wrap gap-4 text-xs">
                      {e.expected_amount != null && (
                        <span>
                          Expected: <strong>₹{Number(e.expected_amount).toLocaleString()}</strong>
                        </span>
                      )}
                      {e.actual_amount != null && (
                        <span>
                          Actual: <strong>₹{Number(e.actual_amount).toLocaleString()}</strong>
                        </span>
                      )}
                      {e.difference != null && (
                        <span
                          className={
                            e.difference < 0
                              ? "text-destructive font-semibold"
                              : "text-muted-foreground"
                          }
                        >
                          Difference: ₹{Number(e.difference).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
                    <div>
                      {e.resolved_at && (
                        <span>Resolved at: {new Date(e.resolved_at).toLocaleString()}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isResolved ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reopenMutation.isPending}
                          onClick={() => handleReopen(e.id)}
                        >
                          <RefreshCw className="mr-1.5 size-3.5" />
                          Reopen
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={resolveMutation.isPending}
                          onClick={() => handleResolve(e.id)}
                        >
                          <CheckCircle2 className="mr-1.5 size-3.5" />
                          {resolveMutation.isPending ? "Resolving…" : "Mark resolved"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
