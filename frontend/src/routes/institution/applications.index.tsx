import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, StatusBadge } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useApplicationsQuery } from "@/hooks/api/useApplications";
import { applicationLabel, applicationProgramme, type Application } from "@/api/applications";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/institution/applications/")({
  head: () => ({
    meta: [{ title: "Assigned Applications | Institution Portal" }],
  }),
  component: InstitutionApplications,
});

const columns: Column<Application>[] = [
  {
    key: "application_number",
    header: "Application",
    sortValue: (r) => applicationLabel(r),
    cell: (r) => <span className="font-semibold">{applicationLabel(r)}</span>,
  },
  {
    // The applications endpoint returns `applicant_id` only — there is no
    // applicant-name endpoint for another party's record, so show the id
    // rather than rendering an empty cell behind a fake "Applicant" header.
    key: "applicant_id",
    header: "Applicant ID",
    sortValue: (r) => r.applicant_id,
    cell: (r) => <span className="font-mono text-xs">{r.applicant_id}</span>,
  },
  {
    key: "cycle",
    header: "Cycle",
    sortValue: (r) => r.cycle,
    cell: (r) => <span className="text-muted-foreground">{r.cycle}</span>,
    hideBelowMd: true,
  },
  {
    key: "programme",
    header: "Programme",
    sortValue: (r) => applicationProgramme(r) ?? "",
    cell: (r) => <span className="text-muted-foreground">{applicationProgramme(r) ?? "—"}</span>,
    hideBelowLg: true,
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: "updated_at",
    header: "Last updated",
    sortValue: (r) => r.updated_at,
    cell: (r) => (
      <span className="text-xs text-muted-foreground">{formatDateTime(r.updated_at)}</span>
    ),
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
          data={institutionApps}
          columns={columns}
          getRowKey={(r) => r.id}
          searchPlaceholder="Search application, applicant id or programme"
          searchKeys={(r) =>
            `${applicationLabel(r)} ${r.applicant_id} ${applicationProgramme(r) ?? ""} ${r.cycle}`
          }
          onRowClick={(r) =>
            navigate({ to: "/institution/applications/$id", params: { id: r.id } })
          }
        />
      )}
    </div>
  );
}
