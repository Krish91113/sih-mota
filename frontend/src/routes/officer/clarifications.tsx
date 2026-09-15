import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/mota/bits";
import { useGrievancesQuery } from "@/hooks/api/useGrievances";
import { useApplicationsQuery } from "@/hooks/api/useApplications";

type Row = Record<string, unknown>;

import { Lightbulb, MessageSquareText } from "lucide-react";

export const Route = createFileRoute("/officer/clarifications")({
  head: () => ({
    meta: [{ title: "Clarifications | Officer Workspace" }],
  }),
  component: OfficerClarifications,
});

const CLARIFICATIONS = [
  {
    id: "CLR-1144",
    application: "APP-2026-004752",
    subject: "Course duration differs from fee structure",
    to: "Institution nodal officer",
    on: "09 Sep 2026",
    status: "Awaiting response",
  },
  {
    id: "CLR-1138",
    application: "APP-2026-004881",
    subject: "Confirm research supervisor details",
    to: "Institution nodal officer",
    on: "03 Sep 2026",
    status: "Resolved",
  },
];

function OfficerClarifications() {
  const { data: applications = [], isLoading, isError } = useApplicationsQuery();

  if (isLoading) return <p className="py-8 text-sm text-muted-foreground">Loading applications…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load applications.</p>;
  return (
    <div>
      <PageHeader
        title="Clarifications desk"
        desc="Questions you have sent to institutions and their responses."
      />

      <div className="space-y-4">
        {CLARIFICATIONS.map((c) => {
          const app = applications.find((a) => a.id === c.application);
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
                  <span>
                    {c.application} · {app?.scheme ?? "Scheme"}
                  </span>
                  <span>Sent to {c.to}</span>
                  <span>On {c.on}</span>
                </div>
                {c.status === "Awaiting response" ? (
                  <div className="mt-4 rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <MessageSquareText className="size-4 text-primary" aria-hidden /> Awaiting
                      institution response
                    </p>
                    <p className="mt-2">
                      Institutions respond to clarifications from their own desk. Once submitted,
                      the application resumes automatically — you do not need to act here.
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
