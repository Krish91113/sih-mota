import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useGrievancesQuery } from "@/hooks/api/useGrievances";
import type { Grievance } from "@/api/grievances";
import { MessageSquarePlus } from "lucide-react";

export const Route = createFileRoute("/portal/grievances/")({
  head: () => ({
    meta: [{ title: "My Grievances | Applicant Portal" }],
  }),
  component: MyGrievances,
});

type GrievanceRow = Grievance & { scheme: string; raised: string };

const columns: Column<GrievanceRow>[] = [
  {
    key: "id",
    header: "Reference",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{r.id}</span>,
  },
  {
    key: "subject",
    header: "Subject",
    sortValue: (r) => r.subject,
    cell: (r) => <span className="font-medium">{r.subject}</span>,
  },
  {
    key: "scheme",
    header: "Scheme",
    sortValue: (r) => r.scheme,
    cell: (r) => <span className="text-muted-foreground">{r.scheme}</span>,
    hideBelowMd: true,
  },
  {
    key: "raised",
    header: "Raised on",
    sortValue: (r) => r.raised,
    cell: (r) => <span className="text-muted-foreground">{r.raised}</span>,
    hideBelowLg: true,
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.status === "Resolved" ? "bg-leaf/10 text-leaf" : "bg-accent text-accent-foreground"}`}
      >
        {r.status}
      </span>
    ),
  },
];

function MyGrievances() {
  const navigate = useNavigate();
  const query = useGrievancesQuery();
  const grievances: GrievanceRow[] = (query.data ?? []).map((grievance) => ({
    ...grievance,
    scheme: String(grievance.scheme_name ?? "—"),
    raised: grievance.created_at ? new Date(grievance.created_at).toLocaleDateString() : "—",
  }));
  return (
    <div>
      <PageHeader
        title="My grievances"
        desc="Track issues you have raised about your applications, payments or portal access."
        action={
          <Button asChild>
            <Link to="/portal/grievances/new">
              <MessageSquarePlus className="size-4" aria-hidden /> Raise a grievance
            </Link>
          </Button>
        }
      />
      {query.isLoading ? (
        <p className="mb-4 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Loading grievances…
        </p>
      ) : null}
      {query.isError ? (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          We could not load grievances.
        </p>
      ) : null}
      <DataTable
        data={grievances}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search by reference or subject"
        searchKeys={(r) => `${r.id} ${r.subject} ${r.scheme}`}
        onRowClick={(r) => navigate({ to: "/portal/grievances/$id", params: { id: r.id } })}
      />
    </div>
  );
}
