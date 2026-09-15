import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import * as selectionApi from "@/api/selection";

export function useCommitteeCandidatesQuery(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: queryKeys.selection.candidates(params),
    queryFn: () => selectionApi.listCommitteeCandidates(params),
  });
}

export function useCandidateQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.selection.candidate(id),
    queryFn: () => selectionApi.getCandidate(id),
    enabled: !!id,
  });
}

export function useCandidateScoresQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.selection.scores(id),
    queryFn: () => selectionApi.getCandidateScores(id),
    enabled: !!id,
  });
}

export function useCandidateReviewsQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.selection.reviews(id),
    queryFn: () => selectionApi.getCandidateReviews(id),
    enabled: !!id,
  });
}

export function useCandidateCommentsQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.selection.comments(id),
    queryFn: () => selectionApi.getCandidateComments(id),
    enabled: !!id,
  });
}

function useCandidateMutation(
  mutationFn: (args: { id: string; data: Record<string, unknown> }) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.selection.candidate(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.selection.scores(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.selection.reviews(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.selection.comments(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.selection.all });
    },
  });
}

export function useDeclareConflictMutation() {
  return useCandidateMutation(({ id, data }) => selectionApi.declareConflict(id, data));
}

export function useAbstainCandidateMutation() {
  return useCandidateMutation(({ id, data }) => selectionApi.abstainCandidate(id, data));
}

export function useRecommendCandidateMutation() {
  return useCandidateMutation(({ id, data }) => selectionApi.recommendCandidate(id, data));
}

export function useCandidateCommentMutation() {
  return useCandidateMutation(({ id, data }) =>
    selectionApi.addCandidateComment(id, data as { comment: string }),
  );
}

export function useScoreCandidateMutation() {
  return useCandidateMutation(({ id, data }) => selectionApi.scoreCandidate(id, data));
}

export function useReviewCandidateMutation() {
  return useCandidateMutation(({ id, data }) => selectionApi.reviewCandidate(id, data));
}

export function useDecideCandidateMutation() {
  return useCandidateMutation(({ id, data }) => selectionApi.decideCandidate(id, data));
}
