import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, StatusBadge } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useApplicationsQuery } from "@/hooks/api/useApplications";

type Row = Record<string, unknown>;

export const Route = createFileRoute("/institution/applications/")({
  head: () => ({
    meta: [{ title: "Assigned Applications | Institution Portal" }],
  }),
  component: InstitutionApplications,
});

const columns: Column<Row>[] = [
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

function InstitutionApplications() {
  const navigate = useNavigate();
  const { data: institutionApps = [], isLoading, isError } = useApplicationsQuery();
  return (
    <div>
      <PageHeader
        title="Assigned applications"
        desc="Applications routed to your institution for enrolment and admission verification."
      />
      {isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading applications…</p>
      ) : isError ? (
        <p className="py-8 text-sm text-destructive">We could not load applications.</p>
      ) : institutionApps.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">
          No applications are currently assigned.
        </p>
      ) : (
        <DataTable
          data={institutionApps as Row[]}
          columns={columns}
          getRowKey={(r) => r.id}
          searchPlaceholder="Search applicant, application or course"
          searchKeys={(r) => `${r.id} ${r.applicant} ${r.course} ${r.scheme}`}
          onRowClick={(r) =>
            navigate({ to: "/institution/applications/$id", params: { id: r.id } })
          }
        />
      )}
    </div>
  );
}
