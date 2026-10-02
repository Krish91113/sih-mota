import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useCommitteeCandidatesQuery } from "@/hooks/api/useSelection";
import { BadgeCheck, Users, XCircle } from "lucide-react";
import { applicationLabel, applicationProgramme } from "@/api/applications";
import type { CommitteeCandidateDetail } from "@/api/selection";

/**
 * Flattened view model for the table.
 *
 * Built only from fields the bundle actually returns. The committee endpoints
 * do not expose an applicant name, a scheme name, a category or a priority, so
 * those are not invented here — the application number, the programme the
 * applicant answered, and the caller's own decision are what we can show.
 */
type CandidateRow = {
  id: string;
  applicationNumber: string;
  programme: string;
  category: string;
  rank: string | number;
  score: string | number;
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
    key: "applicationNumber",
    header: "Application",
    sortValue: (r) => r.applicationNumber,
    cell: (r) => <span className="font-semibold">{r.applicationNumber}</span>,
  },
  {
    key: "programme",
    header: "Programme",
    sortValue: (r) => r.programme,
    cell: (r) => <span className="font-medium">{r.programme}</span>,
  },
  {
    key: "category",
    header: "Category",
    sortValue: (r) => r.category,
    cell: (r) => <span className="text-muted-foreground">{r.category}</span>,
    hideBelowMd: true,
  },
  {
    key: "rank",
    header: "Rank",
    sortValue: (r) => r.rank,
    cell: (r) => <span className="text-muted-foreground">{r.rank}</span>,
    hideBelowLg: true,
  },
  {
    key: "score",
    header: "Score",
    sortValue: (r) => r.score,
    cell: (r) => <span className="font-semibold text-primary">{r.score}</span>,
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

  const isLoading = committeeQuery.isLoading;
  const isError = committeeQuery.isError;

  const bundles = (committeeQuery.data ?? []) as CommitteeCandidateDetail[];

  const candidates: CandidateRow[] = bundles.map((item) => {
    const app = item.application;
    const decision = item.my_decision?.decision;
    const status = item.my_conflict
      ? "Conflict declared"
      : decision === "APPROVE"
        ? "Recommending"
        : decision === "REJECT"
          ? "Not recommending"
          : "Pending review";

    return {
      id: item.candidate.id,
      applicationNumber: applicationLabel(app),
      programme: applicationProgramme(app) ?? "—",
      category: (app.answers?.category as string | undefined) ?? "—",
      rank: item.candidate.rank ?? "—",
      score: item.candidate.total_score ?? "—",
      status,
    };
  });

  const total = candidates.length;
  const recommended = candidates.filter((c) => c.status === "Recommending").length;
  const notRecommended = candidates.filter((c) => c.status === "Not recommending").length;

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
          searchPlaceholder="Search application, programme or category"
          searchKeys={(r) => `${r.applicationNumber} ${r.programme} ${r.category} ${r.status}`}
          onRowClick={(r) => navigate({ to: "/committee/candidates/$id", params: { id: r.id } })}
        />
      )}
    </div>
  );
}
