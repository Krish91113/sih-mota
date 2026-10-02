import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard, StatusBadge } from "@/components/mota/bits";
import { useCommitteeCandidatesQuery } from "@/hooks/api/useSelection";
import {
  summariseCommittee,
  toCommitteeCandidateRows,
  type CommitteeCandidateRow,
} from "@/lib/committee";
import { ArrowRight, BadgeCheck, BarChart3, Scale, Users, XCircle } from "lucide-react";
import type { CommitteeCandidateDetail } from "@/api/selection";

export const Route = createFileRoute("/committee/")({
  head: () => ({ meta: [{ title: "Selection Committee | MoTA" }] }),
  component: CommitteeIndex,
});

function CommitteeIndex() {
  const navigate = useNavigate();
  const committeeQuery = useCommitteeCandidatesQuery();

  const isLoading = committeeQuery.isLoading;
  const isError = committeeQuery.isError;

  const candidates: CommitteeCandidateRow[] = toCommitteeCandidateRows(
    committeeQuery.data as CommitteeCandidateDetail[] | undefined,
  );

  const { total, recommended, notRecommended, pending } = summariseCommittee(candidates);

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading committee dashboard…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load committee data.</p>;
  if (candidates.length === 0)
    return (
      <div>
        <PageHeader
          title="Selection committee"
          desc="Review ranked candidates and record your recommendation before the committee meeting."
        />
        <p className="py-8 text-sm text-muted-foreground">No candidates are currently assigned.</p>
      </div>
    );
  return (
    <div>
      <PageHeader
        title="Selection committee"
        desc="Review ranked candidates and record your recommendation before the committee meeting."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Candidates assigned" value={String(total)} icon={Users} />
        <KpiCard label="Pending review" value={String(pending)} icon={Scale} />
        <KpiCard label="Recommending" value={String(recommended)} icon={BadgeCheck} />
        <KpiCard label="Not recommending" value={String(notRecommended)} icon={XCircle} />
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex-row items-center justify-between border-b border-dashed pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-primary" aria-hidden /> Ranked candidates
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-primary">
            <Link to="/committee/candidates">
              All candidates <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-3">
          <ul>
            {candidates.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left hover:bg-muted/50"
                  onClick={() =>
                    navigate({ to: "/committee/candidates/$id", params: { id: c.id } })
                  }
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.applicationNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.programme} · {c.category}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold text-primary">{c.score}</span>
                    <StatusBadge status={c.status} />
                  </div>
                </button>
                {i < candidates.length - 1 ? <hr className="mx-3 border-dashed" /> : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-leaf/30 shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="size-4 text-leaf" aria-hidden /> Recommended for approval
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {candidates
              .filter((c) => c.status === "Recommending")
              .map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <p className="text-sm font-medium">{c.applicationNumber}</p>
                    <p className="text-xs text-muted-foreground">{c.programme}</p>
                  </div>
                  <span className="text-sm font-semibold text-leaf">{c.score}</span>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/[0.02] shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <XCircle className="size-4 text-destructive" aria-hidden /> Not recommended
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {candidates
              .filter((c) => c.status === "Not recommending")
              .map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <p className="text-sm font-medium">{c.applicationNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.programme} · {c.category}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">{c.score}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
