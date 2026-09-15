import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard } from "@/components/mota/bits";
import { useAuditEventsQuery } from "@/hooks/api/useReports";
import { ArrowRight, Database, Hash, ScrollText, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/audit/")({
  head: () => ({ meta: [{ title: "Audit Dashboard | Audit Trail" }] }),
  component: AuditDashboard,
});

function AuditDashboard() {
  const query = useAuditEventsQuery();
  const events = query.data ?? [];
  const corrections = events.filter((e) =>
    Boolean(e.details?.isCorrection ?? e.details?.correction_of),
  ).length;

  return (
    <div>
      <PageHeader
        title="Audit dashboard"
        desc="Immutability, corrections and verification of the application activity ledger."
      />
      {query.isLoading ? (
        <p className="mb-6 text-sm text-muted-foreground">Loading audit events…</p>
      ) : null}
      {query.isError ? (
        <p className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Unable to load audit events.{" "}
          {query.error instanceof Error ? query.error.message : "Please try again later."}
        </p>
      ) : null}
      {!query.isLoading && !query.isError && events.length === 0 ? (
        <p className="mb-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No audit events have been recorded yet.
        </p>
      ) : null}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <KpiCard label="Events this cycle" value={String(events.length)} icon={ScrollText} />
        <KpiCard label="Corrected records" value={String(corrections)} icon={ShieldCheck} />
        <KpiCard label="Hash chain verified" value="—" icon={Hash} />
        <KpiCard label="Log retention" value="Backend" icon={Database} />
      </div>
      <Card className="mb-6 border-leaf/30 bg-leaf/5 shadow-card">
        <CardHeader className="border-b border-dashed pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-leaf" aria-hidden /> Ledger integrity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-6 text-sm">
          <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
            Hash-chain verification metadata is not included in the current audit API response.
          </p>
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardHeader className="flex-row items-center justify-between border-b border-dashed pb-3">
          <CardTitle className="text-base">Recent events</CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-primary">
            <Link to="/audit/log">
              Open full log <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-3">
            {events.slice(0, 3).map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4 text-sm"
              >
                <div>
                  <p className="font-medium">{e.action}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.resource_type} · {e.resource_id}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{e.timestamp}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
