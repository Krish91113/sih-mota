import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, StatusBadge, Priority, Sla, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { FilterBar, type FilterBarDef } from "@/components/mota/FilterBar";
import { useOfficerQueueQuery } from "@/hooks/api/useQueues";
import type { QueueRow } from "@/api/queue";
import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, Clock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/officer/queue")({
  head: () => ({
    meta: [{ title: "Work Queue | Officer Workspace" }],
  }),
  component: WorkQueue,
});

const ACTION_STATUSES = new Set([
  "SUBMITTED",
  "INSTITUTION_VERIFIED",
  "RESUBMITTED",
  "DEFICIENCY_RAISED",
  "APPROVAL_HOLD",
]);

const OVER_SLA_DAYS = 14;
const ESCALATION_DAYS = 21;

const columns: Column<QueueRow>[] = [
  {
    key: "priority",
    header: "Priority",
    sortValue: (r) => r.priority,
    cell: (r) => <Priority level={r.priority} />,
  },
  {
    key: "application_number",
    header: "Application",
    sortValue: (r) => r.application_number ?? r.id,
    cell: (r) => <span className="font-semibold">{r.application_number ?? r.id}</span>,
  },
  {
    key: "applicant",
    header: "Applicant",
    sortValue: (r) => r.applicant ?? "",
    cell: (r) => <span className="font-medium">{r.applicant ?? "—"}</span>,
  },
  {
    key: "scheme",
    header: "Scheme",
    sortValue: (r) => r.scheme_code ?? r.scheme ?? "",
    cell: (r) => <span className="text-muted-foreground">{r.scheme ?? "—"}</span>,
    hideBelowMd: true,
  },
  {
    key: "stage",
    header: "Stage",
    sortValue: (r) => r.stage,
    cell: (r) => <StatusBadge status={r.stage} />,
  },
  {
    key: "sla_days",
    header: "SLA",
    sortValue: (r) => r.sla_days,
    cell: (r) => <Sla days={r.sla_days} />,
  },
];

function WorkQueue() {
  const navigate = useNavigate();
  const [filtersValue, setFiltersValue] = useState<Record<string, string>>({});
  const { data: queue = [], isLoading, isError } = useOfficerQueueQuery();

  const schemeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of queue) {
      const value = row.scheme_code ?? row.scheme;
      if (value && !seen.has(value)) seen.set(value, row.scheme ?? value);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [queue]);

  const stageOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const row of queue) seen.add(row.stage);
    return [...seen].map((value) => ({ value, label: value.replaceAll("_", " ") }));
  }, [queue]);

  const filters: FilterBarDef<QueueRow>[] = [
    { key: "scheme", label: "Scheme", placeholder: "All schemes", options: schemeOptions },
    { key: "stage", label: "Stage", placeholder: "All stages", options: stageOptions },
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

  const filtered = queue.filter((r) => {
    if (filtersValue["scheme"] && (r.scheme_code ?? r.scheme) !== filtersValue["scheme"])
      return false;
    if (filtersValue["stage"] && r.stage !== filtersValue["stage"]) return false;
    if (filtersValue["priority"] && r.priority !== filtersValue["priority"]) return false;
    return true;
  });

  const total = queue.length;
  const actionRequired = queue.filter((r) => ACTION_STATUSES.has(r.status)).length;
  const overSla = queue.filter((r) => r.sla_days > OVER_SLA_DAYS).length;
  const escalation = queue.filter((r) => r.sla_days >= ESCALATION_DAYS).length;

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
        <KpiCard label="Escalation eligible" value={String(escalation)} icon={ShieldCheck} />
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
          searchKeys={(r) =>
            `${r.application_number ?? ""} ${r.applicant ?? ""} ${r.scheme ?? ""} ${r.stage}`
          }
          onRowClick={(r) => navigate({ to: "/officer/applications/$id", params: { id: r.id } })}
        />
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Showing {filtered.length} of {total} applications in your queue.
      </p>
    </div>
  );
}
