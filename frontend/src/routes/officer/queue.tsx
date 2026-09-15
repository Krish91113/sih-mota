import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, StatusBadge, Priority, Sla, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { FilterBar, type FilterBarDef } from "@/components/mota/FilterBar";
import { useApplicationsQuery } from "@/hooks/api/useApplications";

type Row = Record<string, unknown>;
import { useState } from "react";
import { AlertTriangle, ClipboardList, Clock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/officer/queue")({
  head: () => ({
    meta: [{ title: "Work Queue | Officer Workspace" }],
  }),
  component: WorkQueue,
});

const filters: FilterBarDef<Row>[] = [
  {
    key: "scheme",
    label: "Scheme",
    placeholder: "All schemes",
    options: [
      { value: "NFST", label: "NFST" },
      { value: "NOS", label: "NOS" },
      { value: "TCE", label: "Top Class Education" },
      { value: "PMS", label: "PMS" },
    ],
  },
  {
    key: "stage",
    label: "Stage",
    placeholder: "All stages",
    options: [
      { value: "Documents", label: "Documents" },
      { value: "Institution", label: "Institution verification" },
      { value: "Committee", label: "Committee" },
      { value: "Approval", label: "Approval" },
    ],
  },
  {
    key: "priority",
    label: "Priority",
    placeholder: "All priorities",
    options: [
      { value: "High", label: "High" },
      { value: "Medium", label: "Medium" },
      { value: "Low", label: "Low" },
    ],
  },
];

const columns: Column<Row>[] = [
  {
    key: "priority",
    header: "Priority",
    sortValue: (r) => r.priority,
    cell: (r) => <Priority level={r.priority} />,
  },
  {
    key: "id",
    header: "Application",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{r.id}</span>,
  },
  {
    key: "applicant",
    header: "Applicant",
    sortValue: (r) => r.applicant,
    cell: (r) => <span className="font-medium">{r.applicant}</span>,
  },
  {
    key: "scheme",
    header: "Scheme",
    sortValue: (r) => r.scheme,
    cell: (r) => <span className="text-muted-foreground">{r.scheme}</span>,
    hideBelowMd: true,
  },
  {
    key: "stage",
    header: "Stage",
    sortValue: (r) => r.stage,
    cell: (r) => <StatusBadge status={r.stage} />,
  },
  {
    key: "score",
    header: "Score",
    sortValue: (r) => r.score,
    cell: (r) => <span className="font-semibold text-primary">{r.score}</span>,
    hideBelowLg: true,
  },
  {
    key: "sla",
    header: "SLA",
    sortValue: (r) => r.sla,
    cell: (r) => <Sla days={r.sla} />,
  },
];

function WorkQueue() {
  const navigate = useNavigate();
  const [filtersValue, setFiltersValue] = useState<Record<string, string>>({});
  const { data: officerQueue2 = [], isLoading, isError } = useApplicationsQuery();

  const filtered = (officerQueue2 as Row[]).filter((r) => {
    if (filtersValue.scheme && r.scheme !== filtersValue.scheme) return false;
    if (filtersValue.stage && r.stage !== filtersValue.stage) return false;
    if (filtersValue.priority && r.priority !== filtersValue.priority) return false;
    return true;
  });

  const total = 41;
  const actionRequired = 1;
  const overSla = 7;

  return (
    <div>
      <PageHeader
        title="Work queue"
        desc="Applications assigned to you, ordered by priority and settlement within SLA."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="In queue" value={String(total)} icon={ClipboardList} />
        <KpiCard label="Action required" value={String(actionRequired)} icon={AlertTriangle} />
        <KpiCard label="Over SLA" value={String(overSla)} icon={Clock} />
        <KpiCard label="Escalation eligible" value="7" icon={ShieldCheck} />
      </div>

      <div className="mb-4">
        <FilterBar
          definitions={filters}
          value={filtersValue}
          onChange={setFiltersValue}
          onClear={() => setFiltersValue({})}
        />
      </div>

      {isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading work queue…</p>
      ) : isError ? (
        <p className="py-8 text-sm text-destructive">We could not load the work queue.</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">
          No applications are currently in your queue.
        </p>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowKey={(r) => r.id}
          searchPlaceholder="Search application, applicant or scheme"
          searchKeys={(r) => `${r.id} ${r.applicant} ${r.scheme} ${r.state}`}
          onRowClick={(r) => navigate({ to: "/officer/applications/$id", params: { id: r.id } })}
        />
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Showing {filtered.length} items from your currently loaded queue. The remaining items load
        as you advance the page or adjust filters.
      </p>
    </div>
  );
}
