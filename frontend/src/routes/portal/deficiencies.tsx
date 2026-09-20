import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useQuery } from "@tanstack/react-query";
import { listDeficiencies } from "@/api/deficiencies";
import { AlertTriangle, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/portal/deficiencies")({
  head: () => ({
    meta: [{ title: "Deficiencies | Applicant Portal" }],
  }),
  component: MyDeficiencies,
});

type DeficiencyRow = Awaited<ReturnType<typeof listDeficiencies>>[number] & {
  application: string;
  issue: string;
};

const columns: Column<DeficiencyRow>[] = [
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
    key: "issue",
    header: "Issue",
    sortValue: (r) => r.issue,
    cell: (r) => <span className="font-medium">{r.issue}</span>,
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
    key: "deadline",
    header: "Deadline",
    sortValue: (r) => r.deadline,
    cell: (r) => <span className="text-muted-foreground">{r.deadline}</span>,
    hideBelowLg: true,
  },
];

function MyDeficiencies() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["deficiencies", "portal"],
    queryFn: () => listDeficiencies(),
  });
  const deficiencies: DeficiencyRow[] = (query.data ?? []).map((d) => ({
    ...d,
    application: d.application_id,
    issue: d.description,
  }));
  return (
    <div>
      <PageHeader
        title="Deficiencies"
        desc="Open issues raised on your applications. Respond before the deadline to keep your application moving."
      />
      {query.isLoading ? (
        <p className="mb-4 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Loading deficiencies…
        </p>
      ) : null}
      {query.isError ? (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          We could not load deficiencies.
        </p>
      ) : null}
      <DataTable
        data={deficiencies}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search by reference, application or issue"
        searchKeys={(r) => `${r.id} ${r.application} ${r.issue}`}
        onRowClick={(r) =>
          navigate({ to: "/portal/applications/$id/deficiency", params: { id: r.application } })
        }
        action={
          deficiencies[0]?.application ? (
            <Button asChild className="whitespace-nowrap">
              <Link
                to="/portal/applications/$id/deficiency"
                params={{ id: deficiencies[0].application }}
              >
                Resolve issues <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          ) : undefined
        }
      />
      <p className="mt-4 flex items-start gap-2 rounded-xl border border-dashed bg-card p-4 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
        Deficiency responses are reviewed in FIFO order. You will be notified once the officer
        closes each issue.
      </p>
    </div>
  );
}
