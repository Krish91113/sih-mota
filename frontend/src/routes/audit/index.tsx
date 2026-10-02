import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PageHeader,
  KpiCard,
  StatusBadge,
  ToneBadge,
  LoadingBlock,
  ErrorBlock,
} from "@/components/mota/bits";
import { useAuditEventsQuery, useAuditChainVerificationQuery } from "@/hooks/api/useReports";
import { formatDateTime, formatRelative } from "@/lib/format";
import { humanize } from "@/lib/status";
import {
  ArrowRight,
  Hash,
  ScrollText,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Link2Off,
} from "lucide-react";

export const Route = createFileRoute("/audit/")({
  head: () => ({ meta: [{ title: "Audit Dashboard | Audit Trail" }] }),
  component: AuditDashboard,
});

function AuditDashboard() {
  const events = useAuditEventsQuery();
  const chain = useAuditChainVerificationQuery();

  const rows = events.data ?? [];
  const corrections = rows.filter(
    (e) => Boolean(e.data?.["isCorrection"]) || Boolean(e.data?.["correction_of"]),
  ).length;

  const verification = chain.data;
  const hasRecords = (verification?.total_records ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="Audit dashboard"
        desc="Immutability, corrections and verification of the application activity ledger."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void chain.refetch()}
            disabled={chain.isFetching}
          >
            <RefreshCw className={`size-4 ${chain.isFetching ? "animate-spin" : ""}`} aria-hidden />
            Re-verify chain
          </Button>
        }
      />

      {/* Ledger integrity — the single most important signal on this page. */}
      <Card
        className={`mb-6 shadow-card ${
          verification && !verification.valid
            ? "border-destructive/40 bg-destructive/5"
            : "border-leaf/30 bg-leaf/5"
        }`}
      >
        <CardHeader className="border-b border-dashed pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {verification && !verification.valid ? (
              <ShieldAlert className="size-4 text-destructive" aria-hidden />
            ) : (
              <ShieldCheck className="size-4 text-leaf" aria-hidden />
            )}
            Ledger integrity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          {chain.isLoading ? (
            <LoadingBlock label="Verifying hash chain" />
          ) : chain.isError ? (
            <ErrorBlock
              label="Could not verify the hash chain"
              onRetry={() => void chain.refetch()}
            />
          ) : !hasRecords ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No audit records exist yet, so there is no chain to verify. The first recorded action
              will establish it.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                {verification!.valid ? (
                  <ToneBadge tone="success">
                    <ShieldCheck className="size-3.5" aria-hidden /> Chain intact
                  </ToneBadge>
                ) : (
                  <ToneBadge tone="danger">
                    <ShieldAlert className="size-3.5" aria-hidden /> Chain broken
                  </ToneBadge>
                )}
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {verification!.total_records.toLocaleString("en-IN")}
                  </span>{" "}
                  records checked, each linked to the hash of the one before it.
                </p>
              </div>

              {!verification!.valid ? (
                <div className="space-y-2 rounded-xl border border-destructive/30 bg-card p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <Link2Off className="size-4" aria-hidden />
                    History does not match the recorded chain
                  </p>
                  <p className="text-sm text-muted-foreground">{verification!.message}</p>
                  {verification!.broken_at_id ? (
                    <p className="text-sm">
                      First affected record:{" "}
                      <Link
                        to="/audit/events/$id"
                        params={{ id: verification!.broken_at_id }}
                        className="font-mono text-xs text-primary underline underline-offset-4"
                      >
                        {verification!.broken_at_id}
                      </Link>
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    A mismatch means a record was altered directly in the database, outside the
                    application. This is a control failure that should be reported to the audit
                    authority.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Every record&apos;s <code className="text-xs">previous_hash</code> matches the
                  preceding record&apos;s <code className="text-xs">event_hash</code>. No gaps or
                  edits detected.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Records in ledger" value={String(rows.length)} icon={ScrollText} />
        <KpiCard label="Corrected records" value={String(corrections)} icon={ShieldCheck} />
        <KpiCard
          label="Chain status"
          value={
            chain.isLoading ? "…" : hasRecords ? (verification!.valid ? "Intact" : "Broken") : "—"
          }
          hint={verification?.broken_at_id ? "See break point above" : undefined}
          icon={Hash}
          tone={hasRecords ? (verification!.valid ? "success" : "danger") : "neutral"}
        />
        <KpiCard
          label="Verified by backend"
          value={verification ? String(verification.total_records) : "—"}
          hint="Full-chain walk, not a sample"
          icon={ShieldCheck}
        />
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex-row items-center justify-between border-b border-dashed pb-3">
          <CardTitle className="text-base">Recent activity</CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-primary">
            <Link to="/audit/log">
              Open full log <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          {events.isLoading ? (
            <LoadingBlock label="Loading audit events" />
          ) : events.isError ? (
            <ErrorBlock label="Could not load audit events" onRetry={() => void events.refetch()} />
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No audit events have been recorded yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.slice(0, 5).map((e) => (
                <li key={e.id}>
                  <Link
                    to="/audit/events/$id"
                    params={{ id: e.id }}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4 text-sm transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {humanize(e.event_type)}
                        <StatusBadge status={e.entity_type} label={humanize(e.entity_type)} />
                      </p>
                      {e.reason ? (
                        <p className="mt-1 text-xs text-muted-foreground">{e.reason}</p>
                      ) : null}
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {e.entity_id ?? "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(e.created_at)}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70">
                        {formatRelative(e.created_at)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
