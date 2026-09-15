/** Selection API — maps to /selection-rounds/*, /selection-candidates/*, /selection-corrections/* */
import { api } from "./client";

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

export function listCommitteeCandidates(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return api.get<SelectionCandidate[]>("/committee/candidates", { params });
}

export function getCandidate(candidateId: string) {
  return api.get<SelectionCandidate>(`/selection-candidates/${candidateId}`);
}

export function getCandidateScores(candidateId: string) {
  return api.get(`/selection-candidates/${candidateId}/scores`);
}

export function getCandidateReviews(candidateId: string) {
  return api.get(`/selection-candidates/${candidateId}/reviews`);
}

export function getCandidateComments(candidateId: string) {
  return api.get(`/selection-candidates/${candidateId}/comments`);
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
