import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, Priority, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useCommitteeCandidatesQuery } from "@/hooks/api/useSelection";
import { useApplicationsQuery } from "@/hooks/api/useApplications";
import { BadgeCheck, Scale, Users, XCircle } from "lucide-react";

type CandidateRow = {
  id: string;
  applicant: string;
  tribe: string;
  scheme: string;
  score: string | number;
  priority: "High" | "Medium" | "Low";
  status: string;
};

export const Route = createFileRoute("/committee/candidates")({
  head: () => ({
    meta: [{ title: "Candidates | Selection Committee" }],
  }),
  component: CommitteeCandidates,
});

const columns: Column<CandidateRow>[] = [
  {
    key: "applicant",
    header: "Candidate",
    sortValue: (r) => r.applicant,
    cell: (r) => <span className="font-medium">{r.applicant}</span>,
  },
  {
    key: "tribe",
    header: "Tribe",
    sortValue: (r) => r.tribe,
    cell: (r) => <span className="text-muted-foreground">{r.tribe}</span>,
  },
  {
    key: "scheme",
    header: "Scheme",
    sortValue: (r) => r.scheme,
    cell: (r) => <span className="text-muted-foreground">{r.scheme}</span>,
    hideBelowMd: true,
  },
  {
    key: "score",
    header: "Score",
    sortValue: (r) => r.score,
    cell: (r) => <span className="font-semibold text-primary">{r.score}</span>,
  },
  {
    key: "priority",
    header: "Priority",
    sortValue: (r) => r.priority,
    cell: (r) => <Priority level={r.priority} />,
    hideBelowLg: true,
  },
  {
    key: "status",
    header: "My decision",
    sortValue: (r) => r.status,
    cell: (r) => (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          r.status === "Recommending" || r.status === "APPROVE"
            ? "bg-leaf/10 text-leaf"
            : r.status === "Not recommending" || r.status === "REJECT"
              ? "bg-destructive/10 text-destructive"
              : "bg-accent text-accent-foreground"
        }`}
      >
        {r.status}
      </span>
    ),
  },
];

function CommitteeCandidates() {
  const navigate = useNavigate();
  const committeeQuery = useCommitteeCandidatesQuery();
  const fallbackAppsQuery = useApplicationsQuery({ stage: "committee" });

  const isLoading = committeeQuery.isLoading && fallbackAppsQuery.isLoading;
  const isError = committeeQuery.isError && fallbackAppsQuery.isError;

  const rawList: Array<Record<string, unknown>> =
    (committeeQuery.data as { data?: Array<Record<string, unknown>> })?.data ||
    (Array.isArray(committeeQuery.data)
      ? (committeeQuery.data as Array<Record<string, unknown>>)
      : null) ||
    (fallbackAppsQuery.data as Array<Record<string, unknown>>) ||
    [];

  const candidates: CandidateRow[] = rawList.map((item: Record<string, unknown>) => {
    if (item.candidate && item.application) {
      const c = item.candidate as Record<string, unknown>;
      const app = item.application as Record<string, unknown>;
      const myDec = item.my_decision as Record<string, unknown> | undefined;
      const dec = (myDec?.decision as string) || (item.my_conflict ? "Conflict" : "Pending review");
      return {
        id: String(c.id || app.id),
        applicant: String(app.applicant_name || app.applicant || app.full_name || "Applicant"),
        tribe: String(app.tribe || app.category || "ST"),
        scheme: String(app.scheme_name || app.scheme || "Scheme"),
        score: (c.total_score ?? app.score ?? "—") as string | number,
        priority: ((app.priority as string) || "Medium") as "High" | "Medium" | "Low",
        status: dec === "APPROVE" ? "Recommending" : dec === "REJECT" ? "Not recommending" : dec,
      };
    }
    return {
      id: String(item.id),
      applicant: String(item.applicant || item.applicant_name || "Applicant"),
      tribe: String(item.tribe || "ST"),
      scheme: String(item.scheme || item.scheme_name || "Scheme"),
      score: (item.score ?? item.total_score ?? "—") as string | number,
      priority: ((item.priority as string) || "Medium") as "High" | "Medium" | "Low",
      status: String(item.status || "Pending review"),
    };
  });

  const total = candidates.length;
  const recommended = candidates.filter(
    (c) => c.status === "Recommending" || c.status === "APPROVE",
  ).length;
  const notRecommended = candidates.filter(
    (c) => c.status === "Not recommending" || c.status === "REJECT",
  ).length;

  return (
    <div>
      <PageHeader title="Candidates" desc="Ranked shortlist for your committee's review." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Assigned" value={String(total)} icon={Users} />
        <KpiCard label="Recommending" value={String(recommended)} icon={BadgeCheck} />
        <KpiCard label="Not recommending" value={String(notRecommended)} icon={XCircle} />
      </div>

      {isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading candidates…</p>
      ) : isError ? (
        <p className="py-8 text-sm text-destructive">We could not load committee candidates.</p>
      ) : candidates.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">
          No candidates are assigned to this committee.
        </p>
      ) : (
        <DataTable
          data={candidates}
          columns={columns}
          getRowKey={(r) => r.id}
          searchPlaceholder="Search candidate, application, tribe or scheme"
          searchKeys={(r) => `${r.applicant} ${r.id} ${r.tribe} ${r.scheme}`}
          onRowClick={(r) => navigate({ to: "/committee/candidates/$id", params: { id: r.id } })}
        />
      )}
    </div>
  );
}
