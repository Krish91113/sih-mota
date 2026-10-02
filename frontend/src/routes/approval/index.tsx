import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard, Priority, StatusBadge } from "@/components/mota/bits";
import { useApprovalsQueueQuery } from "@/hooks/api/useQueues";
import { ArrowRight, CheckCircle2, Clock, Scale } from "lucide-react";

export const Route = createFileRoute("/approval/")({
  head: () => ({
    meta: [{ title: "Approval Dashboard | Sanctioning Authority" }],
  }),
  component: ApprovalDashboard,
});

function ApprovalDashboard() {
  const navigate = useNavigate();
  const { data: queue = [], isLoading, isError } = useApprovalsQueueQuery();

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading approval dashboard…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load approval data.</p>;

  const highPriority = queue.filter((a) => a.priority === "High").length;
  const recommended = queue.filter((a) => a.committee === "Recommended").length;
  const avgAge =
    queue.length > 0
      ? Math.round(queue.reduce((sum, a) => sum + (a.sla_days ?? 0), 0) / queue.length)
      : 0;

  return (
    <div>
      <PageHeader
        title="Sanctioning authority"
        desc="Approve, return or reject applications that reached final clearance."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Awaiting decision" value={String(queue.length)} icon={Scale} />
        <KpiCard label="High priority" value={String(highPriority)} icon={Clock} />
        <KpiCard label="Recommended by committee" value={String(recommended)} icon={CheckCircle2} />
        <KpiCard label="Average age" value={`${avgAge} days`} icon={Clock} />
      </div>

      {queue.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">
          No applications are awaiting a decision.
        </p>
      ) : (
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
              {queue.map((a, i) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left hover:bg-muted/50"
                    onClick={() =>
                      navigate({ to: "/approval/applications/$id", params: { id: a.id } })
                    }
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.applicant ?? "Applicant"}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.application_number ?? a.id}
                        {a.scheme ? ` · ${a.scheme}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {a.score != null ? (
                        <span className="hidden text-sm font-semibold text-primary md:block">
                          {a.score}
                        </span>
                      ) : null}
                      <Priority level={a.priority} />
                      <span className="hidden text-xs text-muted-foreground lg:block">
                        {a.sla_days} days in queue
                      </span>
                      <StatusBadge status={a.priority === "High" ? "High Priority" : "In review"} />
                    </div>
                  </button>
                  {i < queue.length - 1 ? <hr className="mx-3 border-dashed" /> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {queue.length > 0 ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {(
            [
              {
                label: "Scrutiny",
                ok: (a: (typeof queue)[number]) => a.scrutiny === "Completed",
              },
              {
                label: "Committee",
                ok: (a: (typeof queue)[number]) => a.committee === "Recommended",
              },
              {
                label: "Institution",
                ok: (a: (typeof queue)[number]) => a.institution === "Verified",
              },
            ] as const
          ).map((check) => {
            const okCount = queue.filter(check.ok).length;
            return (
              <Card key={check.label} className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{check.label} clearance</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <p className="font-display text-3xl text-primary">
                    {okCount}{" "}
                    <span className="text-base text-muted-foreground">/ {queue.length}</span>
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-leaf"
                      style={{ width: `${(okCount / queue.length) * 100}%` }}
                      aria-hidden
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Applications with all checks complete are ready for sanction.
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
