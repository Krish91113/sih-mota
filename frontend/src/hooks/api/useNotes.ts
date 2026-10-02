import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import * as notesApi from "@/api/notes";

export function useApplicationNotesQuery(applicationId: string) {
  return useQuery({
    queryKey: queryKeys.notes.application(applicationId),
    queryFn: () => notesApi.listApplicationNotes(applicationId),
    enabled: !!applicationId,
  });
}

export function useCreateApplicationNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      data,
    }: {
      applicationId: string;
      data: { note: string; internal?: boolean };
    }) => notesApi.createApplicationNote(applicationId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.application(variables.applicationId),
      });
    },
  });
}

export function useUpdateApplicationNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
      applicationId,
    }: {
      id: string;
      applicationId: string;
      data: { note?: string; internal?: boolean };
    }) => notesApi.updateApplicationNote(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.application(variables.applicationId),
      });
    },
  });
}

export function useDeleteApplicationNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, applicationId }: { id: string; applicationId: string }) =>
      notesApi.deleteApplicationNote(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.application(variables.applicationId),
      });
    },
  });
}
