import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/mota/bits";
import { useGrievancesQuery } from "@/hooks/api/useGrievances";
import { formatDate, humanizeField } from "@/lib/format";
import { Lightbulb, MessageSquareText } from "lucide-react";

export const Route = createFileRoute("/officer/clarifications")({
  head: () => ({
    meta: [{ title: "Clarifications | Officer Workspace" }],
  }),
  component: OfficerClarifications,
});

/**
 * Clarifications are grievances: they carry `subject`, `category`,
 * `description`, `priority`, `status`, `assigned_to` and `created_at`. There is
 * no `application`, `to` or `on` column on a grievance, and no
 * "Awaiting response" status, so those are not fabricated here.
 */
const AWAITING_STATUSES = new Set(["OPEN", "IN_PROGRESS", "PENDING", "ESCALATED"]);

function OfficerClarifications() {
  const { data: clarifications = [], isLoading, isError } = useGrievancesQuery();

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading clarifications…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load clarifications.</p>;

  return (
    <div>
      <PageHeader
        title="Clarifications desk"
        desc="Questions you have sent to institutions and their responses."
      />

      {clarifications.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          <Lightbulb className="mx-auto mb-2 size-6 text-muted-foreground/50" aria-hidden />
          No clarifications have been raised yet.
        </p>
      ) : (
        <div className="space-y-4">
          {clarifications.map((c) => {
            const awaiting = Boolean(c.status && AWAITING_STATUSES.has(c.status));
            return (
              <Card key={c.id} className="shadow-card">
                <CardHeader className="flex-row items-center justify-between gap-3 border-b border-dashed pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="size-4 text-primary" aria-hidden /> {c.subject}
                  </CardTitle>
                  <StatusBadge status={c.status} />
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{c.id}</span>
                    <span>{humanizeField(c.category)}</span>
                    <span>Priority {humanizeField(c.priority)}</span>
                    <span>Raised {formatDate(c.created_at)}</span>
                    {c.assigned_to ? <span>Assigned to {c.assigned_to}</span> : null}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{c.description}</p>
                  {awaiting ? (
                    <div className="mt-4 rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
                      <p className="flex items-center gap-2 font-medium text-foreground">
                        <MessageSquareText className="size-4 text-primary" aria-hidden /> Awaiting
                        response
                      </p>
                      <p className="mt-2">
                        Institutions respond to clarifications from their own desk. Once submitted,
                        the case resumes automatically — you do not need to act here.
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
