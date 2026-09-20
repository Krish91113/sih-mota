import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Field } from "@/components/mota/bits";
import { useAuditEventsQuery } from "@/hooks/api/useReports";
import { ArrowRight, Link2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/audit/events/$id")({
  head: () => ({ meta: [{ title: "Audit Event | Audit Trail" }] }),
  component: AuditEventDetail,
});

function AuditEventDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const query = useAuditEventsQuery();
  const event = query.data?.find((x) => x.id === id);
  const previous = query.data?.find((x) => x.id === event?.details?.["correction_of"]);
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
  return (
    <div>
      <PageHeader title={event.id} desc={event.action} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Event metadata</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Timestamp" value={event.timestamp} />
                <Field label="Action" value={event.action} />
                <Field label="Resource" value={event.resource_type} />
                <Field label="Resource ID" value={event.resource_id} />
                <Field label="Actor" value={event.actor_id} />
                <Field label="Request ID" value={String(event.details?.["request_id"] ?? "—")} />
              </dl>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="size-4 text-primary" aria-hidden /> Chain linkage
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground">
                {previous
                  ? `Correction references ${previous.id}.`
                  : "No correction linkage is present in the API response."}
              </p>
            </CardContent>
          </Card>
        </div>
        <aside>
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" aria-hidden /> Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 text-sm">
              <p className="text-leaf font-medium flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-leaf" /> Immutable audit record
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Recorded in system ledger at{" "}
                {event.timestamp ? new Date(event.timestamp).toLocaleString() : "event creation"}.
              </p>
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
