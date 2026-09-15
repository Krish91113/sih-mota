import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, StatusBadge, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { FilterBar, type FilterBarDef } from "@/components/mota/FilterBar";
import { useApplicationsQuery } from "@/hooks/api/useApplications";

type Row = Record<string, unknown>;
import { useState } from "react";
import { Clock, ListChecks, ShieldCheck, TimerReset } from "lucide-react";

export const Route = createFileRoute("/institution/verifications")({
  head: () => ({
    meta: [{ title: "Verification Queue | Institution Portal" }],
  }),
  component: VerificationQueue,
});

const filters: FilterBarDef<Row>[] = [
  {
    key: "type",
    label: "Verification type",
    placeholder: "All types",
    options: [
      { value: "Admission", label: "Admission" },
      { value: "Enrollment", label: "Enrollment" },
      { value: "Programme", label: "Programme" },
      { value: "Research", label: "Research" },
    ],
  },
  {
    key: "status",
    label: "Status",
    placeholder: "All statuses",
    options: [
      { value: "Pending", label: "Pending" },
      { value: "Cleared", label: "Cleared" },
      { value: "Need Clarification", label: "Need clarification" },
    ],
  },
];

const columns: Column<Row>[] = [
  {
    key: "id",
    header: "Ref ID",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{r.id}</span>,
  },
  {
    key: "application",
    header: "Application",
    sortValue: (r) => r.application,
    cell: (r) => <span>{r.application}</span>,
  },
  {
    key: "student",
    header: "Student",
    sortValue: (r) => r.student,
    cell: (r) => <span className="font-medium">{r.student}</span>,
  },
  {
    key: "type",
    header: "Type",
    sortValue: (r) => r.type,
    cell: (r) => <span className="text-muted-foreground">{r.type}</span>,
  },
  {
    key: "course",
    header: "Course",
    sortValue: (r) => r.course,
    cell: (r) => <span className="text-muted-foreground">{r.course}</span>,
    hideBelowLg: true,
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: "due",
    header: "Due",
    sortValue: (r) => r.due,
    cell: (r) => <span className="text-xs text-muted-foreground">{r.due}</span>,
    hideBelowLg: true,
  },
];

function VerificationQueue() {
  const navigate = useNavigate();
  const {
    data: institutionVerifications = [],
    isLoading,
    isError,
  } = useApplicationsQuery({ stage: "institution" });
  const [filtersValue, setFiltersValue] = useState<Record<string, string>>({});
  const applied = (Object.keys(filtersValue) as (keyof typeof filtersValue)[]).some(
    (k) => !!filtersValue[k],
  );

  const filtered = institutionVerifications.filter((r) => {
    if (filtersValue.type && r.type !== filtersValue.type) return false;
    if (filtersValue.status && r.status !== filtersValue.status) return false;
    return true;
  });

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
        desc="Verification records requested against your institution's applicants."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Pending" value="3" icon={Clock} />
        <KpiCard label="Cleared" value="1" icon={ListChecks} />
        <KpiCard label="Overdue" value="0" icon={TimerReset} />
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
        searchPlaceholder="Search student, application or type"
        searchKeys={(r) => `${r.id} ${r.application} ${r.student} ${r.type}`}
        onRowClick={(r) =>
          navigate({ to: "/institution/applications/$id", params: { id: r.application } })
        }
      />

      {!applied && filtered.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing {filtered.length} of {institutionVerifications.length} verification records.
        </p>
      ) : null}
    </div>
  );
}
