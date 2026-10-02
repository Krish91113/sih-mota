/** Selection API — maps to /selection-rounds/*, /selection-candidates/*, /selection-corrections/* */
import { api } from "./client";
import type { Application } from "./applications";
import type { QueryParams } from "./types";

export interface SelectionRound {
  id: string;
  scheme_version_id: string;
  status: string;
  [key: string]: unknown;
}

export interface SelectionCandidate {
  id: string;
  round_id: string;
  application_id: string;
  total_score: number | null;
  rank: number | null;
  decision: string | null;
  [key: string]: unknown;
}

/** `selection_scores` — criterion_code / normalized_value / weight / weighted_score. */
export interface SelectionScore {
  id: string;
  candidate_id: string;
  criterion_code: string;
  raw_value?: unknown;
  normalized_value: number | null;
  weight: number;
  weighted_score: number;
  [key: string]: unknown;
}

/** `selection_reviews` — decision / note / conflict. */
export interface SelectionReview {
  id: string;
  candidate_id: string;
  member_id: string | null;
  decision: string;
  note: string | null;
  conflict: boolean;
  [key: string]: unknown;
}

/** `committee_decisions` — the caller's own row plus every member's row. */
export interface CommitteeDecision {
  id: string;
  candidate_id: string;
  member_id: string | null;
  decision: string;
  rationale: string | null;
  conflict: boolean;
  evidence: Record<string, unknown>;
  [key: string]: unknown;
}

/** `committee_comments` — append-only thread, ordered by created_at server-side. */
export interface CommitteeComment {
  id: string;
  candidate_id: string;
  member_id: string | null;
  comment: string;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * Exact payload of `candidate_data()` in `backend/app/selection_finance.py`.
 *
 * The committee endpoints return a **bundle** — the candidate row plus its
 * application, scores, reviews, decisions and comments — not a bare candidate.
 * `my_decision` / `my_conflict` are present because the endpoint always
 * receives the caller.
 */
export interface CommitteeCandidateDetail {
  candidate: SelectionCandidate;
  application: Application;
  scores: SelectionScore[];
  reviews: SelectionReview[];
  decisions: CommitteeDecision[];
  comments: CommitteeComment[];
  my_decision: CommitteeDecision | null;
  my_conflict: boolean;
}

export function listCommitteeCandidates(params?: QueryParams) {
  return api.get<CommitteeCandidateDetail[]>("/committee/candidates", { params });
}

/** Administrative view of a candidate, including assignment scope. */
export function getCommitteeCandidate(candidateId: string) {
  return api.get<CommitteeCandidateDetail>(`/committee/candidates/${candidateId}`);
}

/** Declare a conflict of interest on the committee (admin/committee scope). */
export function declareCommitteeConflict(
  candidateId: string,
  data: { member_id?: string; reason: string },
) {
  return api.post(`/committee/candidates/${candidateId}/conflict`, data);
}

/**
 * Assign a committee member to a candidate.
 *
 * NOTE: the backend's scope check only recognises assignments whose
 * `assignment_type` is exactly `SELECTION_COMMITTEE`; any other value records
 * the assignment but does not grant the member access to score/review.
 */
export function assignCommitteeMember(
  candidateId: string,
  data: { member_id: string; assignment_type?: string },
) {
  return api.post(`/committee/candidates/${candidateId}/assignments`, {
    assignment_type: "SELECTION_COMMITTEE",
    ...data,
  });
}

export function removeCommitteeAssignment(candidateId: string, memberId: string) {
  return api.delete(`/committee/candidates/${candidateId}/assignments/${memberId}`);
}

export function getCandidate(candidateId: string) {
  return api.get<CommitteeCandidateDetail>(`/selection-candidates/${candidateId}`);
}

export function getCandidateScores(candidateId: string) {
  return api.get<SelectionScore[]>(`/selection-candidates/${candidateId}/scores`);
}

export function getCandidateReviews(candidateId: string) {
  return api.get<SelectionReview[]>(`/selection-candidates/${candidateId}/reviews`);
}

export function getCandidateComments(candidateId: string) {
  return api.get<CommitteeComment[]>(`/selection-candidates/${candidateId}/comments`);
}

export function declareConflict(candidateId: string, data: Record<string, unknown>) {
  return api.post(`/selection-candidates/${candidateId}/conflict`, data);
}

export function abstainCandidate(candidateId: string, data: Record<string, unknown>) {
  return api.post(`/selection-candidates/${candidateId}/abstain`, data);
}

export function recommendCandidate(candidateId: string, data: Record<string, unknown>) {
  return api.post(`/selection-candidates/${candidateId}/recommend`, data);
}

export function addCandidateComment(candidateId: string, data: { comment: string }) {
  return api.post(`/selection-candidates/${candidateId}/comments`, data);
}

export function createSelectionRound(data: Record<string, unknown>) {
  return api.post<SelectionRound>("/selection-rounds", data);
}

export function getSelectionRound(roundId: string) {
  return api.get<SelectionRound>(`/selection-rounds/${roundId}`);
}

export function addCandidates(roundId: string, data: Record<string, unknown>) {
  return api.post(`/selection-rounds/${roundId}/candidates`, data);
}

export function scoreCandidate(candidateId: string, data: Record<string, unknown>) {
  return api.post(`/selection-candidates/${candidateId}/scores`, data);
}

export function reviewCandidate(candidateId: string, data: Record<string, unknown>) {
  return api.post(`/selection-candidates/${candidateId}/reviews`, data);
}

export function decideCandidate(candidateId: string, data: Record<string, unknown>) {
  return api.post(`/selection-candidates/${candidateId}/decisions`, data);
}

export function resolveTies(roundId: string, data?: Record<string, unknown>) {
  return api.post(`/selection-rounds/${roundId}/ties/resolve`, data);
}

export function finalizeRound(roundId: string) {
  return api.post(`/selection-rounds/${roundId}/finalize`);
}

export function createCorrection(candidateId: string, data: Record<string, unknown>) {
  return api.post(`/selection-candidates/${candidateId}/corrections`, data);
}

export function approveCorrection(correctionId: string) {
  return api.post(`/selection-corrections/${correctionId}/approve`);
}
