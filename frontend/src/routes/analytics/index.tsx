import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard } from "@/components/mota/bits";
import { useExecutiveReportQuery } from "@/hooks/api/useReports";
import { Award, FileClock, FolderCheck, Users } from "lucide-react";

type Report = {
  monthly?: { m: string; received: number; processed: number; awarded: number }[];
  stageSplit?: { name: string; value: number }[];
};
export const Route = createFileRoute("/analytics/")({
  head: () => ({ meta: [{ title: "Executive Analytics | MoTA Scholarships" }] }),
  component: ExecutiveAnalytics,
});
function ExecutiveAnalytics() {
  const query = useExecutiveReportQuery();
  const data = (query.data ?? {}) as Report;
  const monthly = data.monthly ?? [];
  const stages = data.stageSplit ?? [];
  const total = monthly.reduce((s, x) => s + x.received, 0);
  const processed = monthly.reduce((s, x) => s + x.processed, 0);
  const awarded = monthly.reduce((s, x) => s + x.awarded, 0);
  const pipeline = stages.reduce((s, x) => s + x.value, 0);
  if (query.isLoading)
    return <p className="text-sm text-muted-foreground">Loading executive report…</p>;
  if (query.isError)
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load executive analytics.
      </p>
    );
  return (
    <div>
      <PageHeader
        title="Executive analytics"
        desc="Cycle-wide application intake, processing and award trends."
      />
      {!monthly.length && !stages.length ? (
        <p className="mb-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No executive report data is available for this cycle.
        </p>
      ) : null}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Applications" value={total.toLocaleString()} icon={Users} />
        <KpiCard label="Processed" value={processed.toLocaleString()} icon={FileClock} />
        <KpiCard label="Awards made" value={awarded.toLocaleString()} icon={Award} />
        <KpiCard label="In pipeline now" value={pipeline.toLocaleString()} icon={FolderCheck} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Monthly intake vs processed vs awarded</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {monthly.map((m) => (
                <div key={m.m} className="grid grid-cols-4 gap-2 text-sm">
                  <span className="font-medium">{m.m}</span>
                  <span>Received {m.received.toLocaleString()}</span>
                  <span>Processed {m.processed.toLocaleString()}</span>
                  <span>Awarded {m.awarded.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Stage split</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {stages.map((s) => (
              <div key={s.name}>
                <div className="flex justify-between text-sm">
                  <span>{s.name}</span>
                  <span className="font-medium">{s.value.toLocaleString()}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${pipeline ? (s.value / pipeline) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
