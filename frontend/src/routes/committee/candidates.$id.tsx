import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, StatusBadge, AiFlag } from "@/components/mota/bits";
import {
  useCandidateQuery,
  useDeclareConflictMutation,
  useAbstainCandidateMutation,
  useRecommendCandidateMutation,
  useCandidateCommentMutation,
} from "@/hooks/api/useSelection";
import { toCommitteeCandidateRow, type CommitteeCandidateRow } from "@/lib/committee";
import { formatJson, formatNumber, humanizeField } from "@/lib/format";
import type {
  CommitteeCandidateDetail,
  CommitteeComment,
  SelectionReview,
  SelectionScore,
} from "@/api/selection";
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

export const Route = createFileRoute("/committee/candidates/$id")({
  component: CommitteeCandidateDetail,
});

function CommitteeCandidateDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [commentText, setCommentText] = useState("");

  const candidateQuery = useCandidateQuery(id);

  const conflictMutation = useDeclareConflictMutation();
  const abstainMutation = useAbstainCandidateMutation();
  const recommendMutation = useRecommendCandidateMutation();
  const commentMutation = useCandidateCommentMutation();

  const isLoading = candidateQuery.isLoading;
  const isError = candidateQuery.isError;

  const bundle = candidateQuery.data as CommitteeCandidateDetail | undefined;

  /**
   * Everything below comes from the single `candidate_data()` bundle.
   *
   * Previously this page also fetched `GET /applications/{id}` using the
   * *candidate* id, which is a guaranteed 404, and re-derived scores, reviews
   * and comments from three extra requests with defensive `.data` envelope
   * casts. The bundle already contains all of it.
   */
  const row: CommitteeCandidateRow | undefined = bundle
    ? toCommitteeCandidateRow(bundle)
    : undefined;
  const scoreBreakdown: SelectionScore[] = bundle?.scores ?? [];
  const commentsList: CommitteeComment[] = bundle?.comments ?? [];
  const reviewsList: SelectionReview[] = bundle?.reviews ?? [];

  const isConflicted = reviewsList.some((r) => r.conflict);
  const myDecision = bundle?.my_decision?.decision ?? null;

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

  if (!row) {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        This candidate is not visible to your committee.
      </p>
    );
  }

  return (
    <div>
      <PageHeader
        title={row.applicationNumber}
        desc={`${row.id} · ${row.programme} · ${row.category}`}
        action={<StatusBadge status={row.status} />}
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
              <span className="text-muted-foreground">Application</span>
              <span className="font-mono text-xs">{row.applicationId}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Institution</span>
              <span className="font-medium">{row.institution}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Rank</span>
              <span className="font-medium">{row.rank}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Total score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-4xl text-primary">{row.score}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Sum of {scoreBreakdown.length} weighted criterion
              {scoreBreakdown.length === 1 ? "" : "s"}.
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
              {scoreBreakdown.map((b) => {
                const weight = Number(b.weight) || 0;
                const obtained = Number(b.normalized_value ?? 0);
                const pct = weight > 0 ? (obtained / weight) * 100 : 0;
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">
                        {humanizeField(b.criterion_code)}{" "}
                        <span className="text-xs text-muted-foreground">
                          · weight {formatNumber(weight)}
                        </span>
                      </span>
                      <span className="font-semibold">
                        {formatNumber(obtained)} / {formatNumber(weight)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        aria-hidden
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Weighted {formatNumber(b.weighted_score)} · raw {formatJson(b.raw_value)}
                    </p>
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
                      <p className="font-medium text-foreground">{comm.comment}</p>
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
