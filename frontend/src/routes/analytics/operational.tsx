import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard, StatusBadge } from "@/components/mota/bits";
import { useOperationalReportQuery } from "@/hooks/api/useReports";
import { AlarmClock, AlertTriangle, Building2, LayoutGrid } from "lucide-react";
type Report = {
  stageSplit?: { name: string; value: number }[];
  queue?: { id: string; applicant: string; stage: string; sla: number; priority: string }[];
};
export const Route = createFileRoute("/analytics/operational")({
  head: () => ({ meta: [{ title: "Operational Analytics | MoTA Scholarships" }] }),
  component: OperationalAnalytics,
});
function OperationalAnalytics() {
  const query = useOperationalReportQuery();
  const data = (query.data ?? {}) as Report;
  const stages = data.stageSplit ?? [];
  const queue = data.queue ?? [];
  const total = stages.reduce((s, x) => s + x.value, 0);
  if (query.isLoading)
    return <p className="text-sm text-muted-foreground">Loading operational report…</p>;
  if (query.isError)
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load operational analytics.
      </p>
    );
  return (
    <div>
      <PageHeader
        title="Operational analytics"
        desc="Live queue health, SLA compliance and workload by stage."
      />
      {!stages.length && !queue.length ? (
        <p className="mb-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No operational report data is available.
        </p>
      ) : null}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total in queues" value={total.toLocaleString()} icon={LayoutGrid} />
        <KpiCard
          label="Institution pending"
          value={(
            stages.find((x) => x.name.toLowerCase().includes("institution"))?.value ?? 0
          ).toLocaleString()}
          icon={Building2}
        />
        <KpiCard label="Accepted within SLA" value="—" icon={AlarmClock} />
        <KpiCard label="Overdue reviews" value="—" icon={AlertTriangle} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Queue size by stage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {stages.map((s) => (
              <div key={s.name} className="flex justify-between text-sm">
                <span>{s.name}</span>
                <span className="font-medium">{s.value.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Current officer workload</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {queue.map((q) => (
                    <tr key={q.id} className="border-b">
                      <td className="px-4 py-3 font-medium">{q.applicant}</td>
                      <td className="px-4 py-3 text-muted-foreground">{q.stage}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={q.priority} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
