import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard } from "@/components/mota/bits";
import { useSelectionReportQuery } from "@/hooks/api/useReports";
import { Award, BadgeCheck, Scale, XCircle } from "lucide-react";
type Report = {
  statusSplit?: { name: string; value: number }[];
  scoreDistribution?: { range: string; count: number }[];
};
export const Route = createFileRoute("/analytics/selection")({
  head: () => ({ meta: [{ title: "Selection Analytics | MoTA Scholarships" }] }),
  component: SelectionAnalytics,
});
function SelectionAnalytics() {
  const query = useSelectionReportQuery();
  const data = (query.data ?? {}) as Report;
  const statuses = data.statusSplit ?? [];
  const scores = data.scoreDistribution ?? [];
  const total = statuses.reduce((s, x) => s + x.value, 0);
  const recommended = statuses.find((x) => x.name.toLowerCase() === "recommended")?.value ?? 0;
  const notRec = statuses.find((x) => x.name.toLowerCase().includes("not recommended"))?.value ?? 0;
  if (query.isLoading)
    return <p className="text-sm text-muted-foreground">Loading selection report…</p>;
  if (query.isError)
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load selection analytics.
      </p>
    );
  return (
    <div>
      <PageHeader
        title="Selection analytics"
        desc="Committee outcomes and score distribution for the current selection round."
      />
      {!statuses.length && !scores.length ? (
        <p className="mb-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No selection report data is available.
        </p>
      ) : null}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <KpiCard label="Candidates reviewed" value={total.toLocaleString()} icon={Scale} />
        <KpiCard label="Recommended" value={recommended.toLocaleString()} icon={BadgeCheck} />
        <KpiCard label="Not recommended" value={notRec.toLocaleString()} icon={XCircle} />
        <KpiCard
          label="Recommendation rate"
          value={total ? `${((recommended / total) * 100).toFixed(1)}%` : "—"}
          icon={Award}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Committee outcome split</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            {statuses.map((s) => (
              <div key={s.name} className="flex justify-between text-sm">
                <span>{s.name}</span>
                <span className="font-medium">{s.value.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Score distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {scores.map((s) => (
              <div key={s.range} className="flex justify-between text-sm">
                <span>{s.range}</span>
                <span className="font-medium">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
