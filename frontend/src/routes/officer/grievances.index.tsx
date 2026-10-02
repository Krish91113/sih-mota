import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, StatusBadge, Priority, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useGrievancesQuery } from "@/hooks/api/useGrievances";
import type { Grievance } from "@/api/grievances";
import { CheckCircle2, LifeBuoy, Timer, TrendingUp } from "lucide-react";
import { formatPercent, humanizeField } from "@/lib/format";

export const Route = createFileRoute("/officer/grievances/")({
  head: () => ({
    meta: [{ title: "Grievances | Officer Workspace" }],
  }),
  component: OfficerGrievances,
});

const columns: Column<Grievance>[] = [
  {
    key: "id",
    header: "Ref",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-mono text-xs font-semibold">{r.id}</span>,
  },
  {
    key: "subject",
    header: "Subject",
    sortValue: (r) => r.subject,
    cell: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{r.subject}</p>
        <p className="truncate text-xs text-muted-foreground">{humanizeField(r.category)}</p>
      </div>
    ),
  },
  {
    // The grievances table stores `applicant_id` only — no endpoint exposes an
    // applicant name for another party's ticket, so show the id.
    key: "applicant_id",
    header: "Raised by",
    sortValue: (r) => r.applicant_id ?? "",
    cell: (r) => (
      <span className="font-mono text-xs text-muted-foreground">{r.applicant_id ?? "Staff"}</span>
    ),
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
    sortValue: (r) => r.status ?? "",
    cell: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: "created_at",
    header: "Raised",
    sortValue: (r) => r.created_at,
    cell: (r) => <span className="text-xs text-muted-foreground">{humanizeField(r.priority)}</span>,
    hideBelowLg: true,
  },
];

function OfficerGrievances() {
  const { data: officerGrievances = [], isLoading, isError } = useGrievancesQuery();
  const navigate = useNavigate();

  // Every tile is derived from the loaded rows — no hardcoded figures.
  const resolved = officerGrievances.filter((g) => g.status === "RESOLVED").length;
  const open = officerGrievances.filter((g) => g.status !== "RESOLVED").length;
  const unassigned = officerGrievances.filter((g) => !g.assigned_to).length;
  const resolutionRate = officerGrievances.length ? (resolved / officerGrievances.length) * 100 : 0;

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
        <KpiCard label="Unassigned" value={String(unassigned)} icon={Timer} />
        <KpiCard label="Resolved" value={String(resolved)} icon={CheckCircle2} />
        <KpiCard label="Resolution rate" value={formatPercent(resolutionRate)} icon={TrendingUp} />
      </div>

      <DataTable
        data={officerGrievances}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search reference, subject or category"
        searchKeys={(r) => `${r.id} ${r.subject} ${r.category} ${r.status ?? ""}`}
        onRowClick={(r) => navigate({ to: "/officer/grievances/$id", params: { id: r.id } })}
      />
    </div>
  );
}
