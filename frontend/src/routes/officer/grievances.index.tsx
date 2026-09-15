import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, StatusBadge, Priority, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useGrievancesQuery } from "@/hooks/api/useGrievances";

type Row = Record<string, unknown>;
import { CheckCircle2, LifeBuoy, Timer, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/officer/grievances/")({
  head: () => ({
    meta: [{ title: "Grievances | Officer Workspace" }],
  }),
  component: OfficerGrievances,
});

const columns: Column<Row>[] = [
  {
    key: "id",
    header: "Ref",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{r.id}</span>,
  },
  {
    key: "category",
    header: "Category",
    sortValue: (r) => r.category,
    cell: (r) => <span className="font-medium">{r.category}</span>,
  },
  {
    key: "applicant",
    header: "Raised by",
    sortValue: (r) => r.applicant,
    cell: (r) => <span className="text-muted-foreground">{r.applicant}</span>,
  },
  {
    key: "priority",
    header: "Priority",
    sortValue: (r) => r.priority,
    cell: (r) => <Priority level={r.priority} />,
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: "assignee",
    header: "Assigned to",
    sortValue: (r) => r.assignee,
    cell: (r) => <span className="text-xs text-muted-foreground">{r.assignee || "—"}</span>,
    hideBelowLg: true,
  },
];

function OfficerGrievances() {
  const { data: officerGrievances = [], isLoading, isError } = useGrievancesQuery();
  const navigate = useNavigate();
  const open = officerGrievances.filter((g) => g.status !== "Resolved").length;

  if (isLoading) return <p className="py-8 text-sm text-muted-foreground">Loading grievances…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load grievances.</p>;
  return (
    <div>
      <PageHeader
        title="Grievances"
        desc="Incoming grievance cases routed to the officer team and ministry grievance cell."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <KpiCard label="Open" value={String(open)} icon={LifeBuoy} />
        <KpiCard label="Assign to officer" value="1" icon={Timer} />
        <KpiCard label="Resolved" value="1" icon={CheckCircle2} />
        <KpiCard label="Resolution rate" value="78%" icon={TrendingUp} />
      </div>

      <DataTable
        data={officerGrievances}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search reference, category or applicant"
        searchKeys={(r) => `${r.id} ${r.category} ${r.applicant} ${r.status}`}
        onRowClick={(r) => navigate({ to: "/officer/grievances/$id", params: { id: r.id } })}
      />
    </div>
  );
}
