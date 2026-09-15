/** TanStack Query hooks for Documents */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import * as docApi from "@/api/documents";

export function useDocumentsQuery(params?: Record<string, string | number | boolean | undefined>) {
  return useQuery({
    queryKey: queryKeys.documents.list(params),
    queryFn: () => docApi.listDocuments(params),
  });
}

export function useDocumentQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.documents.detail(id),
    queryFn: () => docApi.getDocument(id),
    enabled: !!id,
  });
}

export function useDocumentDownloadUrlQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.documents.downloadUrl(id),
    queryFn: () => docApi.getDownloadUrl(id),
    enabled: !!id,
    staleTime: 60 * 1000, // Short-lived URLs
  });
}

export function useUploadDocumentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => docApi.createDocument(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documents.all });
    },
  });
}

export function useVerifyDocumentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, data }: { docId: string; data?: Record<string, unknown> }) =>
      docApi.verifyDocument(docId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documents.all });
      qc.invalidateQueries({ queryKey: queryKeys.documents.verificationQueue });
    },
  });
}

export function useRejectDocumentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, data }: { docId: string; data?: Record<string, unknown> }) =>
      docApi.rejectDocument(docId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documents.all });
    },
  });
}
