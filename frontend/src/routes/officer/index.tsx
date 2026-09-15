import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard, StatusBadge } from "@/components/mota/bits";
import { useApplicationsQuery } from "@/hooks/api/useApplications";
import { useDocumentsQuery } from "@/hooks/api/useDocuments";
import { useGrievancesQuery } from "@/hooks/api/useGrievances";
import { useNotificationsQuery } from "@/hooks/api/useNotifications";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Clock,
  LifeBuoy,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/officer/")({
  head: () => ({
    meta: [{ title: "Officer Dashboard | MoTA Scholarships" }],
  }),
  component: OfficerDashboard,
});

function OfficerDashboard() {
  const navigate = useNavigate();
  const {
    data: officerQueue2 = [],
    isLoading: queueLoading,
    isError: queueError,
  } = useApplicationsQuery();
  const { data: officerDeficiencies = [] } = useDocumentsQuery();
  const { data: officerGrievances = [] } = useGrievancesQuery();
  const { data: notifications = [] } = useNotificationsQuery();
  if (queueLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading officer dashboard…</p>;
  if (queueError)
    return <p className="py-8 text-sm text-destructive">We could not load the officer queue.</p>;
  const totalSla = 3 * 5;

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("");

  return (
    <div>
      <PageHeader
        title="Officer dashboard"
        desc="Scrutiny queue for the 2026-27 application cycle."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="In my queue" value="41" icon={ClipboardList} />
        <KpiCard
          label="Action required"
          value={String(officerDeficiencies.filter((d) => d.status === "Pending").length + 1)}
          icon={AlertTriangle}
        />
        <KpiCard label="Over SLA" value="7" icon={Clock} />
        <KpiCard label="Escalations received" value="3" icon={ShieldCheck} />
        <KpiCard label="Closed today" value="18" icon={TrendingUp} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader className="flex-row items-center justify-between border-b border-dashed pb-3">
            <CardTitle className="text-base">Priority work queue</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-primary">
              <Link to="/officer/queue">
                Open queue <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-3">
            <ul>
              {officerQueue2.map((q, i) => {
                const score = q.score;
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left hover:bg-muted/50"
                      onClick={() =>
                        navigate({ to: "/officer/applications/$id", params: { id: q.id } })
                      }
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                          {initials(q.applicant)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{q.applicant}</p>
                          <p className="text-xs text-muted-foreground">
                            {q.id} · {q.scheme} · {q.state}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          {q.stage}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${q.sla < 0 ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}
                        >
                          {q.sla < 0 ? `${Math.abs(q.sla)}d overdue` : `${q.sla}d left`}
                        </span>
                        <StatusBadge
                          status={
                            q.priority === "High"
                              ? "High Priority"
                              : q.priority === "Medium"
                                ? "Medium"
                                : "Cleared"
                          }
                        />
                        <span className="text-xs font-semibold text-primary">{score}</span>
                      </div>
                    </button>
                    {i < officerQueue2.length - 1 ? <hr className="mx-3 border-dashed" /> : null}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <LifeBuoy className="size-4 text-primary" aria-hidden /> Grievances to act on
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <ul>
                {officerGrievances
                  .filter((g) => g.status !== "Resolved")
                  .slice(0, 3)
                  .map((g, i) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left hover:bg-muted/50"
                        onClick={() =>
                          navigate({ to: "/officer/grievances/$id", params: { id: g.id } })
                        }
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{g.category}</p>
                          <p className="text-xs text-muted-foreground">
                            {g.id} · {g.applicant}
                          </p>
                        </div>
                        <StatusBadge status={g.status} />
                      </button>
                      {i < 2 ? <hr className="mx-3 border-dashed" /> : null}
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Recent notifications</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <ul>
                {notifications.slice(0, 2).map((n, i) => (
                  <li key={i} className="rounded-lg p-3">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.time}</p>
                    {i < 1 ? <hr className="mt-3 border-dashed" /> : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground shadow-card">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <TrendingUp className="size-4 text-primary" aria-hidden /> SLA outlook
            </p>
            <p className="mt-2 font-medium">
              {totalSla - 7} of {totalSla} applications are meeting service levels
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[79%] rounded-full bg-primary" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
