import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, StatusBadge, Priority, AiFlag } from "@/components/mota/bits";
import { useApplicationQuery } from "@/hooks/api/useApplications";
import {
  useCandidateQuery,
  useCandidateScoresQuery,
  useCandidateReviewsQuery,
  useCandidateCommentsQuery,
  useDeclareConflictMutation,
  useAbstainCandidateMutation,
  useRecommendCandidateMutation,
  useCandidateCommentMutation,
} from "@/hooks/api/useSelection";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  FileText,
  Loader2,
  Send,
  ShieldAlert,
  UserRound,
  XCircle,
} from "lucide-react";

type ScoreItem = {
  parameter?: string;
  name?: string;
  weight?: number;
  obtained?: number;
  score?: number;
  max_score?: number;
  basis?: string;
  comments?: string;
};

export const Route = createFileRoute("/committee/candidates/$id")({
  component: CommitteeCandidateDetail,
});

function CommitteeCandidateDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [commentText, setCommentText] = useState("");

  const candidateQuery = useCandidateQuery(id);
  const applicationQuery = useApplicationQuery(id);
  const scoresQuery = useCandidateScoresQuery(id);
  const reviewsQuery = useCandidateReviewsQuery(id);
  const commentsQuery = useCandidateCommentsQuery(id);

  const conflictMutation = useDeclareConflictMutation();
  const abstainMutation = useAbstainCandidateMutation();
  const recommendMutation = useRecommendCandidateMutation();
  const commentMutation = useCandidateCommentMutation();

  const isLoading = candidateQuery.isLoading && applicationQuery.isLoading;
  const isError = candidateQuery.isError && applicationQuery.isError;

  const candidateData = (candidateQuery.data || {}) as Record<string, unknown>;
  const appData = (applicationQuery.data || {}) as Record<string, unknown>;

  const c = {
    id: String(candidateData.id || appData.id || id),
    applicant: String(
      candidateData.applicant_name ||
        candidateData.applicant ||
        appData.applicant_name ||
        appData.applicant ||
        "Candidate",
    ),
    scheme: String(
      candidateData.scheme_name ||
        candidateData.scheme ||
        appData.scheme_name ||
        appData.scheme ||
        "Scheme",
    ),
    tribe: String(candidateData.tribe || appData.tribe || "Scheduled Tribe"),
    state: String(candidateData.state || appData.state || "—"),
    status: String(candidateData.status || appData.status || "Under Review"),
    committee: String(
      candidateData.committee_name || candidateData.committee || "Central Selection Committee",
    ),
    priority: (candidateData.priority || appData.priority || "Medium") as "Medium" | "High" | "Low",
    evidence: String(candidateData.evidence_status || appData.evidence_status || "Verified"),
    score: (candidateData.total_score ?? candidateData.score ?? appData.score ?? "—") as
      string | number,
  };

  const rawScores =
    (scoresQuery.data as { scores?: ScoreItem[] })?.scores ||
    (Array.isArray(scoresQuery.data) ? scoresQuery.data : []) ||
    [];
  const scoreBreakdown: ScoreItem[] = Array.isArray(rawScores) ? (rawScores as ScoreItem[]) : [];

  const rawComments =
    (
      commentsQuery.data as {
        data?: Array<{
          id: string;
          member_id?: string;
          comment?: string;
          note?: string;
          created_at?: string;
        }>;
      }
    )?.data ||
    (Array.isArray(commentsQuery.data) ? commentsQuery.data : []) ||
    [];
  const commentsList: Array<{
    id: string;
    member_id?: string;
    comment?: string;
    note?: string;
    created_at?: string;
  }> = Array.isArray(rawComments)
    ? (rawComments as Array<{
        id: string;
        member_id?: string;
        comment?: string;
        note?: string;
        created_at?: string;
      }>)
    : [];

  const reviewsData =
    (
      reviewsQuery.data as {
        data?: Array<{
          id: string;
          decision?: string;
          conflict?: boolean;
          rationale?: string;
        }>;
      }
    )?.data ||
    (Array.isArray(reviewsQuery.data) ? reviewsQuery.data : []) ||
    [];
  const reviewsList: Array<{
    id: string;
    decision?: string;
    conflict?: boolean;
    rationale?: string;
  }> = Array.isArray(reviewsData)
    ? (reviewsData as Array<{
        id: string;
        decision?: string;
        conflict?: boolean;
        rationale?: string;
      }>)
    : [];

  const isConflicted = reviewsList.some((r) => r.conflict);
  const myDecision = reviewsList.length > 0 ? reviewsList[reviewsList.length - 1].decision : null;

  const handleConflict = async () => {
    try {
      await conflictMutation.mutateAsync({ id, data: {} });
      toast.success("Conflict of interest recorded");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to declare conflict";
      toast.error(errorMsg);
    }
  };

  const handleAbstain = async () => {
    try {
      await abstainMutation.mutateAsync({
        id,
        data: { note: commentText || undefined },
      });
      toast.success("Abstention recorded");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to record abstention";
      toast.error(errorMsg);
    }
  };

  const handleRecommend = async (decision: "RECOMMEND" | "NOT_RECOMMEND") => {
    try {
      await recommendMutation.mutateAsync({
        id,
        data: {
          decision,
          rationale: commentText || undefined,
        },
      });
      toast.success(decision === "RECOMMEND" ? "Recommendation recorded" : "Rejection recorded");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to record decision";
      toast.error(errorMsg);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    try {
      await commentMutation.mutateAsync({
        id,
        data: { comment: commentText.trim() },
      });
      setCommentText("");
      toast.success("Comment posted");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to post comment";
      toast.error(errorMsg);
    }
  };

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading candidate details…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load this candidate.</p>;

  return (
    <div>
      <PageHeader
        title={c.applicant}
        desc={`${c.id} · ${c.scheme} · ${c.tribe} · ${c.state}`}
        action={<StatusBadge status={c.status} />}
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4 text-primary" aria-hidden /> Candidate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Committee</span>
              <span className="font-medium">{c.committee}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Priority</span>
              <Priority level={c.priority} />
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Evidence</span>
              <span className="font-medium">{c.evidence}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Total score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-4xl text-primary">
              {c.score} <span className="text-base text-muted-foreground">/ 100</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Evaluated across {scoreBreakdown.length > 0 ? scoreBreakdown.length : "all"} weighted
              parameters.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Review status</CardTitle>
          </CardHeader>
          <CardContent>
            {isConflicted ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                <ShieldAlert className="size-3.5" /> Conflict declared
              </span>
            ) : myDecision ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf/10 px-3 py-1 text-xs font-semibold text-leaf">
                <BadgeCheck className="size-3.5" /> Decision: {myDecision}
              </span>
            ) : (
              <AiFlag text="Pending committee board evaluation." />
            )}
          </CardContent>
        </Card>
      </div>

      {scoreBreakdown.length > 0 && (
        <Card className="mb-6 shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Score breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {scoreBreakdown.map((b, idx) => {
                const paramName = b.parameter || b.name || `Parameter ${idx + 1}`;
                const weight = b.weight || b.max_score || 100;
                const obtained = b.obtained ?? b.score ?? 0;
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">
                        {paramName}{" "}
                        <span className="text-xs text-muted-foreground">· weight {weight}%</span>
                      </span>
                      <span className="font-semibold">
                        {obtained} / {weight}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(100, Math.max(0, (obtained / weight) * 100))}%`,
                        }}
                        aria-hidden
                      />
                    </div>
                    {b.basis ? (
                      <p className="mt-1 text-xs text-muted-foreground">{b.basis}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-primary" aria-hidden /> Evidence & Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              {[
                "Caste / Tribe certificate — verified",
                "Admission letter — verified",
                "Academic marksheet — verified",
                "Income certificate — verified",
              ].map((d, i) => (
                <p key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-leaf" aria-hidden /> {d}
                </p>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Member comments ({commentsList.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {commentsList.length > 0 && (
                <div className="space-y-2">
                  {commentsList.map((comm) => (
                    <div key={comm.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
                      <p className="font-medium text-foreground">{comm.comment || comm.note}</p>
                      {comm.created_at && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(comm.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <Textarea
                  className="min-h-24"
                  placeholder="Record a note for the committee record…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={handlePostComment}
                  disabled={!commentText.trim() || commentMutation.isPending}
                >
                  {commentMutation.isPending ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 size-4" />
                  )}
                  Add comment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="border-destructive/30 shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="size-4 text-destructive" aria-hidden /> Conflict of interest
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <button
                type="button"
                onClick={handleConflict}
                disabled={isConflicted || conflictMutation.isPending}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left text-sm transition-colors ${isConflicted ? "border-destructive bg-destructive/10 cursor-not-allowed" : "border-border bg-card hover:bg-muted/50 cursor-pointer"}`}
              >
                <span>
                  <span className="font-medium">
                    {isConflicted
                      ? "Conflict of interest declared"
                      : "Declare conflict of interest"}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {isConflicted
                      ? "You are abstained from voting on this candidate."
                      : "Declare if you know this applicant or have personal ties."}
                  </span>
                </span>
              </button>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Record decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <Button
                className="w-full"
                variant={myDecision === "APPROVE" ? "default" : "outline"}
                disabled={isConflicted || recommendMutation.isPending}
                onClick={() => handleRecommend("RECOMMEND")}
              >
                <BadgeCheck className="mr-1.5 size-4" aria-hidden /> Recommend
              </Button>
              <Button
                className="w-full"
                variant={myDecision === "REJECT" ? "destructive" : "outline"}
                disabled={isConflicted || recommendMutation.isPending}
                onClick={() => handleRecommend("NOT_RECOMMEND")}
              >
                <XCircle className="mr-1.5 size-4" aria-hidden /> Not recommend
              </Button>
              <Button
                className="w-full"
                variant="secondary"
                disabled={isConflicted || abstainMutation.isPending}
                onClick={handleAbstain}
              >
                <ArrowRight className="mr-1.5 size-4 rotate-90" aria-hidden /> Abstain
              </Button>
            </CardContent>
          </Card>

          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => navigate({ to: "/committee/candidates" })}
          >
            <ArrowRight className="mr-1.5 size-4 rotate-180" aria-hidden /> Back to candidates
          </Button>
        </aside>
      </div>
    </div>
  );
}
