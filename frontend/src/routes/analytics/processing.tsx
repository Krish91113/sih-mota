import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard } from "@/components/mota/bits";
import { useProcessingTimeReportQuery } from "@/hooks/api/useReports";
import { Gauge, Timer, TrendingUp, Zap } from "lucide-react";
type Report = {
  stages?: {
    stage: string;
    avg: string | number;
    p50: number;
    p90: number;
    p95: number;
    slaPct: number;
  }[];
  medianTotal?: string;
  p90Total?: string;
  slaCompliance?: string;
  fastestStage?: string;
};
export const Route = createFileRoute("/analytics/processing")({
  head: () => ({ meta: [{ title: "Processing Time Analytics | MoTA Scholarships" }] }),
  component: ProcessingAnalytics,
});
function ProcessingAnalytics() {
  const query = useProcessingTimeReportQuery();
  const data = (query.data ?? {}) as Report;
  const stages = data.stages ?? [];
  if (query.isLoading)
    return <p className="text-sm text-muted-foreground">Loading processing report…</p>;
  if (query.isError)
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load processing analytics.
      </p>
    );
  return (
    <div>
      <PageHeader
        title="Processing time analytics"
        desc="Percentile time-in-stage and SLA compliance per workflow stage."
      />
      {!stages.length ? (
        <p className="mb-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No processing-time data is available.
        </p>
      ) : null}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <KpiCard label="Median total time" value={data.medianTotal ?? "—"} icon={Timer} />
        <KpiCard label="p90 total time" value={data.p90Total ?? "—"} icon={Gauge} />
        <KpiCard label="SLA compliance" value={data.slaCompliance ?? "—"} icon={TrendingUp} />
        <KpiCard label="Fastest stage" value={data.fastestStage ?? "—"} icon={Zap} />
      </div>
      <Card className="shadow-card">
        <CardHeader className="border-b border-dashed pb-3">
          <CardTitle className="text-base">Time in stage</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3">Stage</th>
                  <th className="px-5 py-3">Average</th>
                  <th className="px-5 py-3">p50</th>
                  <th className="px-5 py-3">p90</th>
                  <th className="px-5 py-3">SLA</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <tr key={s.stage} className="border-b">
                    <td className="px-5 py-3 font-medium">{s.stage}</td>
                    <td className="px-5 py-3">{s.avg}</td>
                    <td className="px-5 py-3">{s.p50} d</td>
                    <td className="px-5 py-3">{s.p90} d</td>
                    <td className="px-5 py-3">{s.slaPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
