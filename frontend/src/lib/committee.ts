/**
 * Selection-committee view models.
 *
 * `GET /committee/candidates` returns a *bundle* per candidate
 * (`candidate_data()` in `backend/app/selection_finance.py`): the candidate row
 * plus its application, scores, reviews, decisions and comments, and finally
 * the caller's own `my_decision` / `my_conflict`.
 *
 * That bundle is deliberately normalised here, once, so the dashboard, the
 * candidates table and the candidate detail screen all agree. Only fields the
 * backend actually returns are read — there is no applicant name, scheme name,
 * category or priority on these payloads, so none are invented.
 */
import { applicationLabel, applicationProgramme, type Application } from "@/api/applications";
import type {
  CommitteeCandidateDetail,
  CommitteeDecision,
  SelectionCandidate,
} from "@/api/selection";

/** Flattened candidate row shared by the committee dashboard and table. */
export interface CommitteeCandidateRow {
  id: string;
  applicationId: string;
  applicationNumber: string;
  programme: string;
  category: string;
  institution: string;
  status: string;
  score: string | number;
  rank: string | number;
  /** Raw decision token from the caller's own row, if any. */
  decision: string | null;
  conflict: boolean;
}

/** Human label for the committee member's own decision state. */
export function committeeDecisionLabel(detail: {
  my_decision: CommitteeDecision | null;
  my_conflict: boolean;
}): string {
  if (detail.my_conflict) return "Conflict declared";
  const decision = detail.my_decision?.decision;
  if (decision === "APPROVE") return "Recommending";
  if (decision === "REJECT") return "Not recommending";
  if (decision === "ABSTAIN") return "Abstained";
  return "Pending review";
}

/** Tone key for the decision pill; drives the badge colours in the table. */
export function committeeDecisionTone(label: string): "leaf" | "destructive" | "muted" {
  if (label === "Recommending") return "leaf";
  if (label === "Not recommending") return "destructive";
  return "muted";
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/** Normalise one bundle into the shared row shape. */
export function toCommitteeCandidateRow(detail: CommitteeCandidateDetail): CommitteeCandidateRow {
  const candidate: SelectionCandidate = detail.candidate;
  const app: Application = detail.application;
  const status = committeeDecisionLabel(detail);

  return {
    id: candidate.id,
    applicationId: app.id,
    applicationNumber: applicationLabel(app),
    programme: applicationProgramme(app) ?? "—",
    category: text(app.answers?.category) ?? "—",
    institution: text(app.answers?.institution) ?? "—",
    status,
    score: candidate.total_score ?? "—",
    rank: candidate.rank ?? "—",
    decision: detail.my_decision?.decision ?? null,
    conflict: Boolean(detail.my_conflict),
  };
}

export function toCommitteeCandidateRows(
  details: CommitteeCandidateDetail[] | undefined,
): CommitteeCandidateRow[] {
  return (details ?? []).map(toCommitteeCandidateRow);
}

/** Counts for the committee dashboard tiles. */
export function summariseCommittee(rows: CommitteeCandidateRow[]) {
  return {
    total: rows.length,
    recommended: rows.filter((r) => r.status === "Recommending").length,
    notRecommended: rows.filter((r) => r.status === "Not recommending").length,
    pending: rows.filter((r) => r.status === "Pending review").length,
    conflicts: rows.filter((r) => r.conflict).length,
  };
}
