import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { FilterBar, type FilterBarDef } from "@/components/mota/FilterBar";
import { useDocumentsQuery } from "@/hooks/api/useDocuments";

type Row = Record<string, unknown>;
import { useState } from "react";

export const Route = createFileRoute("/officer/deficiencies")({
  head: () => ({
    meta: [{ title: "Deficiencies | Officer Workspace" }],
  }),
  component: OfficerDeficiencies,
});

const filters: FilterBarDef<Row>[] = [
  {
    key: "severity",
    label: "Severity",
    placeholder: "All severities",
    options: [
      { value: "High", label: "High" },
      { value: "Medium", label: "Medium" },
      { value: "Low", label: "Low" },
    ],
  },
  {
    key: "status",
    label: "Status",
    placeholder: "All statuses",
    options: [
      { value: "Pending", label: "Pending" },
      { value: "Responded", label: "Responded" },
      { value: "Closed", label: "Closed" },
    ],
  },
];

const columns: Column<Row>[] = [
  {
    key: "id",
    header: "Ref",
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
    key: "applicant",
    header: "Applicant",
    sortValue: (r) => r.applicant,
    cell: (r) => <span className="font-medium">{r.applicant}</span>,
  },
  {
    key: "issue",
    header: "Issue",
    sortValue: (r) => r.issue,
    cell: (r) => <span className="text-muted-foreground">{r.issue}</span>,
  },
  {
    key: "severity",
    header: "Severity",
    sortValue: (r) => r.severity,
    cell: (r) => (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.severity === "High" ? "bg-destructive text-destructive-foreground" : "bg-amber-100 text-amber-700"}`}
      >
        {r.severity}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.status === "Responded" ? "bg-leaf/10 text-leaf" : "bg-accent text-accent-foreground"}`}
      >
        {r.status}
      </span>
    ),
    hideBelowMd: true,
  },
  {
    key: "deadline",
    header: "Deadline",
    sortValue: (r) => r.deadline,
    cell: (r) => <span className="text-xs text-muted-foreground">{r.deadline}</span>,
    hideBelowLg: true,
  },
];

function OfficerDeficiencies() {
  const { data: officerDeficiencies = [], isLoading, isError } = useDocumentsQuery();
  const navigate = useNavigate();
  const [filtersValue, setFiltersValue] = useState<Record<string, string>>({});

  const filtered = officerDeficiencies.filter((r) => {
    if (filtersValue.severity && r.severity !== filtersValue.severity) return false;
    if (filtersValue.status && r.status !== filtersValue.status) return false;
    return true;
  });

  if (isLoading) return <p className="py-8 text-sm text-muted-foreground">Loading deficiencies…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load deficiencies.</p>;
  return (
    <div>
      <PageHeader
        title="Deficiencies"
        desc="Deficiencies raised in your name and their response status."
      />
      <div className="mb-4">
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
        searchPlaceholder="Search reference, application or applicant"
        searchKeys={(r) => `${r.id} ${r.application} ${r.applicant} ${r.issue}`}
        onRowClick={(r) =>
          navigate({ to: "/officer/applications/$id", params: { id: r.application } })
        }
      />
    </div>
  );
}
