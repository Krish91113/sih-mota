import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard, Priority, StatusBadge } from "@/components/mota/bits";
import { useOfficerQueueQuery } from "@/hooks/api/useQueues";
import { listDeficiencies } from "@/api/deficiencies";
import { useGrievancesQuery } from "@/hooks/api/useGrievances";
import { useNotificationsQuery } from "@/hooks/api/useNotifications";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Clock,
  LifeBuoy,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/officer/")({
  head: () => ({
    meta: [{ title: "Officer Dashboard | MoTA Scholarships" }],
  }),
  component: OfficerDashboard,
});

const SLA_TARGET_DAYS = 14;

function OfficerDashboard() {
  const navigate = useNavigate();
  const { data: queue = [], isLoading, isError } = useOfficerQueueQuery();
  const { data: deficiencies = [] } = useQuery({
    queryKey: ["deficiencies", "officer"],
    queryFn: () => listDeficiencies(),
  });
  const { data: grievances = [] } = useGrievancesQuery();
  const { data: notifications = [] } = useNotificationsQuery();

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading officer dashboard…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load the officer queue.</p>;

  const openDeficiencies = deficiencies.filter((d) => d.status !== "RESOLVED").length;
  const overSla = queue.filter((q) => (q.sla_days ?? 0) >= SLA_TARGET_DAYS).length;
  const withinSla = queue.length - overSla;
  const openGrievances = grievances.filter((g) => g.status !== "Resolved" && g.status !== "CLOSED");
  const slaPct = queue.length > 0 ? Math.round((withinSla / queue.length) * 100) : 0;

  const initials = (name: string | null) =>
    (name ?? "—")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("");

  return (
    <div>
      <PageHeader title="Officer dashboard" desc="Your assigned scrutiny and verification work." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="In my queue" value={String(queue.length)} icon={ClipboardList} />
        <KpiCard label="Action required" value={String(openDeficiencies)} icon={AlertTriangle} />
        <KpiCard label="Over SLA" value={String(overSla)} icon={Clock} />
        <KpiCard label="Open grievances" value={String(openGrievances.length)} icon={LifeBuoy} />
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
            {queue.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No applications are assigned to you right now.
              </p>
            ) : (
              <ul>
                {queue.slice(0, 6).map((q, i) => (
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
                          <p className="truncate text-sm font-medium">
                            {q.applicant ?? "Applicant"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {q.application_number ?? q.id}
                            {q.scheme ? ` · ${q.scheme}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          {q.sla_days} days
                        </span>
                        <Priority level={q.priority} />
                        <StatusBadge status={q.stage} />
                        {q.score != null ? (
                          <span className="text-xs font-semibold text-primary">{q.score}</span>
                        ) : null}
                      </div>
                    </button>
                    {i < Math.min(queue.length, 6) - 1 ? (
                      <hr className="mx-3 border-dashed" />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
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
              {openGrievances.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No open grievances.</p>
              ) : (
                <ul>
                  {openGrievances.slice(0, 3).map((g, i) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left hover:bg-muted/50"
                        onClick={() =>
                          navigate({ to: "/officer/grievances/$id", params: { id: g.id } })
                        }
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{g.subject}</p>
                          <p className="text-xs text-muted-foreground">{g.id}</p>
                        </div>
                        <StatusBadge status={g.status} />
                      </button>
                      {i < Math.min(openGrievances.length, 3) - 1 ? (
                        <hr className="mx-3 border-dashed" />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Recent notifications</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {notifications.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No notifications.</p>
              ) : (
                <ul>
                  {notifications.slice(0, 2).map((n, i) => (
                    <li key={n.id} className="rounded-lg p-3">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                      </p>
                      {i < 1 ? <hr className="mt-3 border-dashed" /> : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground shadow-card">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <TrendingUp className="size-4 text-primary" aria-hidden /> SLA outlook
            </p>
            <p className="mt-2 font-medium">
              {withinSla} of {queue.length} applications are within the {SLA_TARGET_DAYS}-day target
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${slaPct}%` }}
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
