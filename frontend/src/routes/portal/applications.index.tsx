import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge, KpiCard } from "@/components/mota/bits";
import { Progress } from "@/components/ui/progress";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useApplicationsQuery } from "@/hooks/api/useApplications";
import type { Application } from "@/api/applications";
import { FilePlus2, FolderCheck, Timer, UploadCloud } from "lucide-react";

export const Route = createFileRoute("/portal/applications/")({
  head: () => ({
    meta: [{ title: "My Applications | Applicant Portal" }],
  }),
  component: MyApplications,
});

type ApplicationRow = Application & {
  scheme: string;
  progress: number;
  submitted: string;
  updated: string;
};

const columns: Column<ApplicationRow>[] = [
  {
    key: "id",
    header: "Application",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{r.id}</span>,
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
    key: "progress",
    header: "Progress",
    sortValue: (r) => r.progress,
    cell: (r) => (
      <div className="flex items-center gap-2">
        <Progress value={r.progress} className="h-1.5 w-24" aria-label={`${r.progress}%`} />
        <span className="text-xs text-muted-foreground">{r.progress}%</span>
      </div>
    ),
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
  const applications: ApplicationRow[] = (applicationsQuery.data ?? []).map((application) => ({
    ...application,
    scheme: String(application.scheme_name ?? application.scheme_id),
    progress: Number(application.progress ?? (application.status === "Draft" ? 25 : 100)),
    submitted: application.created_at ? new Date(application.created_at).toLocaleDateString() : "—",
    updated: application.updated_at ? new Date(application.updated_at).toLocaleDateString() : "—",
  }));
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

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total" value={String(applications.length)} icon={FolderCheck} />
        <KpiCard
          label="Under processing"
          value={String(applications.filter((a) => a.status === "Scrutiny").length)}
          icon={Timer}
        />
        <KpiCard label="Documents pending" value="2" icon={UploadCloud} />
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
