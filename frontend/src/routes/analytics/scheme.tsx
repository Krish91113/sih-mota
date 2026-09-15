import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard } from "@/components/mota/bits";
import { useSchemeReportQuery } from "@/hooks/api/useReports";
import { useSchemesQuery } from "@/hooks/api/useSchemes";
import { FolderKanban, Timer, Users, DollarSign } from "lucide-react";
import * as React from "react";
export const Route = createFileRoute("/analytics/scheme")({
  head: () => ({ meta: [{ title: "Scheme Analytics | MoTA Scholarships" }] }),
  component: SchemeAnalytics,
});
function SchemeAnalytics() {
  const schemes = useSchemesQuery();
  const report = useSchemeReportQuery();
  const [schemeId, setSchemeId] = React.useState("");
  const data = (report.data ?? {}) as {
    applied?: number;
    verifiedOk?: number;
    recommended?: number;
    awarded?: number;
    avgScore?: number;
  };
  const selected = schemes.data?.find((s) => s.id === (schemeId || schemes.data?.[0]?.id));
  if (schemes.isLoading || report.isLoading)
    return <p className="text-sm text-muted-foreground">Loading scheme analytics…</p>;
  if (schemes.isError || report.isError)
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load scheme analytics.
      </p>
    );
  if (!schemes.data?.length)
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        No schemes are available.
      </p>
    );
  return (
    <div>
      <PageHeader
        title="Scheme analytics"
        desc="Cycle performance for one scheme — funnel, outcomes and average scores."
      />
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-card">
        <label className="text-sm font-medium" htmlFor="scheme-select">
          Scheme
        </label>
        <select
          id="scheme-select"
          value={selected?.id ?? ""}
          onChange={(e) => setSchemeId(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {schemes.data.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <KpiCard
          label="Applications"
          value={(data.applied ?? 0).toLocaleString()}
          icon={FolderKanban}
        />
        <KpiCard label="Verified" value={(data.verifiedOk ?? 0).toLocaleString()} icon={Users} />
        <KpiCard label="Awarded" value={(data.awarded ?? 0).toLocaleString()} icon={Timer} />
        <KpiCard label="Avg score" value={String(data.avgScore ?? "—")} icon={DollarSign} />
      </div>
      <Card className="shadow-card">
        <CardHeader className="border-b border-dashed pb-3">
          <CardTitle className="text-base">Scheme context — {selected?.code}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Description</dt>
              <dd>{selected?.description ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{selected?.active ? "Active" : "Inactive"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
