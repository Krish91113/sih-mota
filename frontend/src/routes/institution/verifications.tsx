import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, StatusBadge, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { FilterBar, type FilterBarDef } from "@/components/mota/FilterBar";
import { useApplicationsQuery } from "@/hooks/api/useApplications";
import type { Application } from "@/api/applications";
import { useMemo, useState } from "react";
import { Clock, ListChecks, TimerReset } from "lucide-react";

export const Route = createFileRoute("/institution/verifications")({
  head: () => ({
    meta: [{ title: "Verification Queue | Institution Portal" }],
  }),
  component: VerificationQueue,
});

const columns: Column<Application>[] = [
  {
    key: "application_number",
    header: "Application",
    sortValue: (r) => r.application_number ?? r.id,
    cell: (r) => <span className="font-semibold">{r.application_number ?? r.id.slice(0, 8)}</span>,
  },
  {
    key: "cycle",
    header: "Cycle",
    sortValue: (r) => r.cycle,
    cell: (r) => <span className="text-muted-foreground">{r.cycle}</span>,
  },
  {
    key: "current_version",
    header: "Version",
    sortValue: (r) => r.current_version,
    cell: (r) => <span className="text-muted-foreground">v{r.current_version}</span>,
    hideBelowMd: true,
  },
  {
    key: "created_at",
    header: "Submitted",
    sortValue: (r) => r.created_at,
    cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>,
    hideBelowLg: true,
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => <StatusBadge status={r.status} />,
  },
];

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function daysSince(value: string) {
  if (!value) return 0;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
}

function VerificationQueue() {
  const navigate = useNavigate();
  const {
    data: applications = [],
    isLoading,
    isError,
  } = useApplicationsQuery({
    stage: "institution",
  });
  const [filtersValue, setFiltersValue] = useState<Record<string, string>>({});

  const statuses = useMemo(
    () => Array.from(new Set(applications.map((a) => a.status).filter(Boolean))).sort(),
    [applications],
  );
  const filters: FilterBarDef<Application>[] = [
    {
      key: "status",
      label: "Status",
      placeholder: "All statuses",
      options: statuses.map((s) => ({ value: s, label: s })),
    },
  ];

  const filtered = applications.filter(
    (a) => !filtersValue["status"] || a.status === filtersValue["status"],
  );
  const clearedCount = applications.filter((a) => a.status === "INSTITUTION_VERIFIED").length;
  const pendingCount = applications.length - clearedCount;
  const overdueCount = applications.filter(
    (a) => a.status !== "INSTITUTION_VERIFIED" && daysSince(a.created_at) >= 7,
  ).length;

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading verification queue…</p>;
  if (isError)
    return (
      <p className="py-8 text-sm text-destructive">We could not load the verification queue.</p>
    );

  return (
    <div>
      <PageHeader
        title="Verification queue"
        desc="Applications from your institution awaiting verification."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Pending" value={String(pendingCount)} icon={Clock} />
        <KpiCard label="Cleared" value={String(clearedCount)} icon={ListChecks} />
        <KpiCard label="Overdue (7+ days)" value={String(overdueCount)} icon={TimerReset} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          definitions={filters}
          value={filtersValue}
          onChange={setFiltersValue}
          onClear={() => setFiltersValue({})}
        />
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search application or cycle"
        searchKeys={(r) => `${r.application_number ?? r.id} ${r.cycle} ${r.status}`}
        onRowClick={(r) => navigate({ to: "/institution/applications/$id", params: { id: r.id } })}
        emptyTitle="Verification queue is clear"
        emptyDesc="Applications assigned to your institution will appear here."
      />

      {filtered.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing {filtered.length} of {applications.length} applications.
        </p>
      ) : null}
    </div>
  );
}
