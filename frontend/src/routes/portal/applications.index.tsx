import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useApplicationsQuery } from "@/hooks/api/useApplications";
import { useDocumentsQuery } from "@/hooks/api/useDocuments";
import { applicationLabel } from "@/api/applications";
import type { Application } from "@/api/applications";
import { formatDate } from "@/lib/format";
import { CheckCircle2, FilePlus2, FolderCheck, Timer, UploadCloud } from "lucide-react";

export const Route = createFileRoute("/portal/applications/")({
  head: () => ({
    meta: [{ title: "My Applications | Applicant Portal" }],
  }),
  component: MyApplications,
});

type ApplicationRow = Application & {
  scheme: string;
  submitted: string;
  updated: string;
};

const columns: Column<ApplicationRow>[] = [
  {
    key: "id",
    header: "Application",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{applicationLabel(r)}</span>,
  },
  {
    key: "scheme",
    header: "Scheme",
    sortValue: (r) => r.scheme,
    cell: (r) => <span className="font-medium">{r.scheme}</span>,
    hideBelowMd: true,
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: "version",
    header: "Version",
    sortValue: (r) => r.version,
    cell: (r) => <span className="text-muted-foreground">v{r.version}</span>,
  },
  {
    key: "submitted",
    header: "Submitted",
    sortValue: (r) => r.submitted,
    cell: (r) => <span className="text-muted-foreground">{r.submitted}</span>,
    hideBelowLg: true,
  },
  {
    key: "updated",
    header: "Updated",
    sortValue: (r) => r.updated,
    cell: (r) => <span className="text-muted-foreground">{r.updated}</span>,
    hideBelowLg: true,
  },
];

function MyApplications() {
  const navigate = useNavigate();
  const applicationsQuery = useApplicationsQuery();
  /**
   * `Application` has no `scheme_name` or `progress`. The list renders the real
   * identifiers (`application_number`, `scheme_id`, `version`, `cycle`) and the
   * real timestamps.
   */
  const applications: ApplicationRow[] = (applicationsQuery.data ?? []).map((application) => ({
    ...application,
    scheme: String(application.scheme_id),
    submitted: formatDate(application.created_at),
    updated: formatDate(application.updated_at),
  }));
  /** Every KPI below is derived from the loaded rows and the real statuses. */
  const FINAL_STATUSES = new Set(["APPROVED", "REJECTED", "AWARDED", "CLOSED", "WITHDRAWN"]);
  const inProgress = applications.filter((a) => !FINAL_STATUSES.has(a.status.toUpperCase())).length;
  const decided = applications.length - inProgress;
  const documentsQuery = useDocumentsQuery();

  return (
    <div>
      <PageHeader
        title="My applications"
        desc="Every draft, submission and its current stage. Click a row to open the tracking timeline."
        action={
          <Button asChild>
            <Link to="/portal/applications/new">
              <FilePlus2 className="size-4" aria-hidden /> New application
            </Link>
          </Button>
        }
      />

      {applicationsQuery.isLoading ? (
        <p className="mb-6 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Loading applications…
        </p>
      ) : null}
      {applicationsQuery.isError ? (
        <p className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          We could not load your applications.
        </p>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <KpiCard label="Total" value={String(applications.length)} icon={FolderCheck} />
        <KpiCard
          label="In progress"
          value={String(inProgress)}
          icon={Timer}
          hint="Not yet finally decided"
        />
        <KpiCard label="Decided" value={String(decided)} icon={CheckCircle2} />
        <KpiCard
          label="Documents"
          value={String((documentsQuery.data ?? []).length)}
          icon={UploadCloud}
          hint={
            (documentsQuery.data ?? []).filter((d) => d.status !== "VERIFIED").length
              ? `${(documentsQuery.data ?? []).filter((d) => d.status !== "VERIFIED").length} awaiting verification`
              : "All verified"
          }
        />
      </div>

      <DataTable
        data={applications}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search by application number or scheme"
        searchKeys={(r) => `${r.id} ${r.scheme} ${r.status}`}
        onRowClick={(r) => navigate({ to: "/portal/applications/$id", params: { id: r.id } })}
      />
    </div>
  );
}
