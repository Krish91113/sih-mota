import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { FilterBar, type FilterBarDef } from "@/components/mota/FilterBar";
import { listDeficiencies, type Deficiency } from "@/api/deficiencies";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/officer/deficiencies")({
  head: () => ({
    meta: [{ title: "Deficiencies | Officer Workspace" }],
  }),
  component: OfficerDeficiencies,
});

const columns: Column<Deficiency>[] = [
  {
    key: "id",
    header: "Ref",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{r.id}</span>,
  },
  {
    key: "application_id",
    header: "Application",
    sortValue: (r) => r.application_id,
    cell: (r) => (
      <span className="font-mono text-xs text-muted-foreground">{r.application_id}</span>
    ),
  },
  {
    key: "type",
    header: "Type",
    sortValue: (r) => r.type,
    cell: (r) => <span className="text-muted-foreground">{r.type}</span>,
    hideBelowMd: true,
  },
  {
    key: "description",
    header: "Issue",
    sortValue: (r) => r.description,
    cell: (r) => <span className="text-muted-foreground">{r.description}</span>,
  },
  {
    key: "severity",
    header: "Severity",
    sortValue: (r) => r.severity,
    cell: (r) => <span className="font-medium">{r.severity}</span>,
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => <span className="font-medium">{r.status}</span>,
  },
  {
    key: "deadline",
    header: "Deadline",
    sortValue: (r) => r.deadline ?? "",
    cell: (r) => (
      <span className="text-xs text-muted-foreground">
        {r.deadline ? new Date(r.deadline).toLocaleDateString() : "—"}
      </span>
    ),
    hideBelowLg: true,
  },
];

function OfficerDeficiencies() {
  const navigate = useNavigate();
  const [filtersValue, setFiltersValue] = useState<Record<string, string>>({});
  const {
    data: deficiencies = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["deficiencies", "officer"],
    queryFn: () => listDeficiencies(),
  });

  const severities = useMemo(
    () => Array.from(new Set(deficiencies.map((d) => d.severity).filter(Boolean))).sort(),
    [deficiencies],
  );
  const statuses = useMemo(
    () => Array.from(new Set(deficiencies.map((d) => d.status).filter(Boolean))).sort(),
    [deficiencies],
  );

  const filters: FilterBarDef<Deficiency>[] = [
    {
      key: "severity",
      label: "Severity",
      placeholder: "All severities",
      options: severities.map((s) => ({ value: s, label: s })),
    },
    {
      key: "status",
      label: "Status",
      placeholder: "All statuses",
      options: statuses.map((s) => ({ value: s, label: s })),
    },
  ];

  const filtered = deficiencies.filter((d) => {
    if (filtersValue["severity"] && d.severity !== filtersValue["severity"]) return false;
    if (filtersValue["status"] && d.status !== filtersValue["status"]) return false;
    return true;
  });

  if (isLoading) return <p className="py-8 text-sm text-muted-foreground">Loading deficiencies…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load deficiencies.</p>;

  return (
    <div>
      <PageHeader
        title="Deficiencies"
        desc="Deficiencies raised across applications, with their current response status."
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
        searchPlaceholder="Search reference, application or issue"
        searchKeys={(r) => `${r.id} ${r.application_id} ${r.description} ${r.type}`}
        onRowClick={(r) =>
          navigate({ to: "/officer/applications/$id", params: { id: r.application_id } })
        }
        emptyTitle="No deficiencies"
        emptyDesc="Deficiencies raised during scrutiny or verification appear here."
      />
    </div>
  );
}
