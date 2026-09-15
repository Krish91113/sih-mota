import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard, Priority, StatusBadge } from "@/components/mota/bits";
import { useApplicationsQuery } from "@/hooks/api/useApplications";
import { ArrowRight, CheckCircle2, Clock, Landmark, Scale } from "lucide-react";

export const Route = createFileRoute("/approval/")({
  head: () => ({
    meta: [{ title: "Approval Dashboard | Sanctioning Authority" }],
  }),
  component: ApprovalDashboard,
});

function ApprovalDashboard() {
  const navigate = useNavigate();
  const {
    data: approvalsQueue = [],
    isLoading,
    isError,
  } = useApplicationsQuery({ status: "approval" });

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading approval dashboard…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load approval data.</p>;
  if (approvalsQueue.length === 0)
    return (
      <div>
        <PageHeader
          title="Sanctioning authority"
          desc="Approve, return or reject applications that reached final clearance."
        />
        <p className="py-8 text-sm text-muted-foreground">
          No applications are awaiting a decision.
        </p>
      </div>
    );
  return (
    <div>
      <PageHeader
        title="Sanctioning authority"
        desc="Approve, return or reject applications that reached final clearance."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Awaiting decision" value="28" icon={Scale} />
        <KpiCard label="Due this week" value="9" icon={Clock} />
        <KpiCard label="Approved this month" value="126" icon={CheckCircle2} />
        <KpiCard label="Value approved" value="₹18.4 Cr" icon={Landmark} />
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex-row items-center justify-between border-b border-dashed pb-3">
          <CardTitle className="text-base">Queue</CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-primary">
            <Link to="/approval/queue">
              Open queue <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-3">
          <ul>
            {approvalsQueue.map((a, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left hover:bg-muted/50"
                  onClick={() =>
                    navigate({ to: "/approval/applications/$id", params: { id: a.id } })
                  }
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.applicant}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.id} · {a.scheme} · {a.amount}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-sm font-semibold text-primary md:block">
                      {a.score}
                    </span>
                    <Priority level={a.priority} />
                    <span className="hidden text-xs text-muted-foreground lg:block">{a.due}</span>
                    <StatusBadge
                      status={a.priority === "High" ? "High Priority" : "Medium Priority"}
                    />
                  </div>
                </button>
                {i < approvalsQueue.length - 1 ? <hr className="mx-3 border-dashed" /> : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {(
          [
            { label: "Scrutiny", get: (a: (typeof approvalsQueue)[number]) => a.scrutiny },
            { label: "Committee", get: (a: (typeof approvalsQueue)[number]) => a.committee },
            { label: "Institution", get: (a: (typeof approvalsQueue)[number]) => a.institution },
          ] as const
        ).map((check) => {
          const okCount = approvalsQueue.filter(
            (a) => check.get(a) === "Cleared" || check.get(a) === "Verified",
          ).length;
          return (
            <Card key={check.label} className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{check.label} clearance</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <p className="font-display text-3xl text-primary">
                  {okCount}{" "}
                  <span className="text-base text-muted-foreground">/ {approvalsQueue.length}</span>
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-leaf"
                    style={{ width: `${(okCount / approvalsQueue.length) * 100}%` }}
                    aria-hidden
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Applications with all three checks green are ready for sanction.
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
