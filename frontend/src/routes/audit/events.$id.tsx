import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Field, StatusBadge } from "@/components/mota/bits";
import { useAuditEventQuery } from "@/hooks/api/useReports";
import { humanize } from "@/lib/status";
import { formatDateTime, formatJson, formatRelative } from "@/lib/format";
import { ArrowRight, Link2, ShieldCheck, Hash } from "lucide-react";

export const Route = createFileRoute("/audit/events/$id")({
  head: () => ({ meta: [{ title: "Audit Event | Audit Trail" }] }),
  component: AuditEventDetail,
});

/** Renders a short, truncated hash with the full value available on hover. */
function HashValue({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span title={value} className="font-mono text-[11px] break-all">
      {value.slice(0, 16)}…
    </span>
  );
}

function AuditEventDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const query = useAuditEventQuery(id);
  const event = query.data;

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading audit event…</p>;
  if (query.isError)
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load this audit event.
      </p>
    );
  if (!event)
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        This audit event was not found.
      </p>
    );

  const correctionOf = event.data?.["correction_of"];

  return (
    <div>
      <PageHeader
        title={humanize(event.event_type)}
        desc={`${humanize(event.entity_type)} record, recorded ${formatRelative(event.created_at)}`}
        action={<StatusBadge status={event.entity_type} label={humanize(event.entity_type)} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Event metadata</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Recorded at" value={formatDateTime(event.created_at)} />
                <Field label="Action" value={humanize(event.event_type)} />
                <Field label="Entity type" value={humanize(event.entity_type)} />
                <Field
                  label="Entity ID"
                  value={<span className="font-mono text-xs">{event.entity_id ?? "—"}</span>}
                />
                <Field
                  label="Actor"
                  value={<span className="font-mono text-xs">{event.actor_id ?? "System"}</span>}
                />
                <Field
                  label="Request ID"
                  value={<span className="font-mono text-xs">{event.request_id ?? "—"}</span>}
                />
                <Field label="IP address" value={event.ip_address ?? "—"} />
                <Field
                  label="Reason"
                  value={
                    event.reason ?? <span className="text-muted-foreground">Not recorded</span>
                  }
                />
              </dl>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="size-4 text-primary" aria-hidden /> Chain linkage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <dl className="grid gap-5 sm:grid-cols-2">
                <Field label="Event hash" value={<HashValue value={event.event_hash} />} />
                <Field label="Previous hash" value={<HashValue value={event.previous_hash} />} />
              </dl>
              {event.previous_hash ? (
                <p className="text-xs text-muted-foreground">
                  This record&apos;s <code>previous_hash</code> must equal the preceding
                  record&apos;s <code>event_hash</code>. Any direct database edit breaks the link
                  and is reported by{" "}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-4"
                    onClick={() => navigate({ to: "/audit" })}
                  >
                    ledger integrity check
                  </button>
                  .
                </p>
              ) : null}
              {correctionOf ? (
                <p className="text-xs text-muted-foreground">
                  This entry corrects{" "}
                  <span className="font-mono text-[11px]">{String(correctionOf)}</span>.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {event.before_state || event.after_state || Object.keys(event.data ?? {}).length ? (
            <Card className="shadow-card">
              <CardHeader className="border-b border-dashed pb-3">
                <CardTitle className="text-base">Payload</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {event.data && Object.keys(event.data).length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Data
                    </p>
                    <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
                      {formatJson(event.data)}
                    </pre>
                  </div>
                ) : null}
                {event.before_state ? (
                  <div>
                    <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      State before
                    </p>
                    <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
                      {formatJson(event.before_state)}
                    </pre>
                  </div>
                ) : null}
                {event.after_state ? (
                  <div>
                    <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      State after
                    </p>
                    <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
                      {formatJson(event.after_state)}
                    </pre>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside>
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" aria-hidden /> Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-[#2E7D32]">
                <ShieldCheck className="size-4" aria-hidden /> Immutable audit record
              </p>
              <p className="text-xs text-muted-foreground">
                Written to the system ledger at {formatDateTime(event.created_at)}.
              </p>
              <div className="flex items-start gap-2 rounded-lg bg-muted p-3">
                <Hash className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <p className="text-[11px] text-muted-foreground">
                  Records are never updated or deleted. A correction is appended as a new,
                  hash-chained entry that references the original.
                </p>
              </div>
            </CardContent>
          </Card>
          <Button
            variant="ghost"
            className="mt-4 w-full justify-start text-muted-foreground"
            onClick={() => navigate({ to: "/audit/log" })}
          >
            <ArrowRight className="size-4 rotate-180" aria-hidden /> Back to audit log
          </Button>
        </aside>
      </div>
    </div>
  );
}
