import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard, StatusBadge, Priority } from "@/components/mota/bits";
import { useCommitteeCandidatesQuery } from "@/hooks/api/useSelection";
import { useApplicationsQuery } from "@/hooks/api/useApplications";
import { ArrowRight, BadgeCheck, BarChart3, Scale, Users, XCircle } from "lucide-react";

interface CommitteeCandidateItem {
  id: string;
  applicant: string;
  tribe: string;
  scheme: string;
  score: string | number;
  priority: "High" | "Medium" | "Low";
  status: string;
}

export const Route = createFileRoute("/committee/")({
  head: () => ({ meta: [{ title: "Selection Committee | MoTA" }] }),
  component: CommitteeIndex,
});

function CommitteeIndex() {
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

  const candidates: CommitteeCandidateItem[] = rawList.map((item: Record<string, unknown>) => {
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
  const pending = candidates.filter(
    (c) => c.status === "Pending review" || c.status === "Pending my review",
  ).length;

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
            {candidates.map((c: CommitteeCandidateItem, i: number) => (
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
                      <p className="truncate text-sm font-medium">{c.applicant}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.id} · {c.scheme} · {c.tribe}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold text-primary">{c.score}</span>
                    <Priority level={c.priority} />
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
              .filter(
                (c: CommitteeCandidateItem) =>
                  c.status === "Recommending" || c.status === "APPROVE",
              )
              .map((c: CommitteeCandidateItem) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <p className="text-sm font-medium">{c.applicant}</p>
                    <p className="text-xs text-muted-foreground">{c.id}</p>
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
              .filter(
                (c: CommitteeCandidateItem) =>
                  c.status === "Not recommending" || c.status === "REJECT",
              )
              .map((c: CommitteeCandidateItem) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <p className="text-sm font-medium">{c.applicant}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.id} · {c.tribe}
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
