/** TanStack Query hooks for Schemes */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import * as schemesApi from "@/api/schemes";

export function useSchemesQuery() {
  return useQuery({
    queryKey: queryKeys.schemes.all,
    queryFn: schemesApi.listSchemes,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSchemeQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.schemes.detail(id),
    queryFn: () => schemesApi.getScheme(id),
    enabled: !!id,
  });
}

export function useSchemeVersionsQuery(schemeId: string) {
  return useQuery({
    queryKey: queryKeys.schemes.versions(schemeId),
    queryFn: () => schemesApi.listSchemeVersions(schemeId),
    enabled: !!schemeId,
  });
}

export function useSchemeVersionQuery(versionId: string) {
  return useQuery({
    queryKey: queryKeys.schemeVersions.detail(versionId),
    queryFn: () => schemesApi.getSchemeVersion(versionId),
    enabled: !!versionId,
  });
}

export function useFormDefinitionQuery(versionId: string) {
  return useQuery({
    queryKey: queryKeys.schemeVersions.form(versionId),
    queryFn: () => schemesApi.getFormDefinition(versionId),
    enabled: !!versionId,
  });
}

export function useSchemeRulesQuery(versionId: string) {
  return useQuery({
    queryKey: queryKeys.schemeVersions.rules(versionId),
    queryFn: () => schemesApi.listRules(versionId),
    enabled: !!versionId,
  });
}

export function useSchemeVersionDocumentsQuery(versionId: string) {
  return useQuery({
    queryKey: queryKeys.schemeVersions.documents(versionId),
    queryFn: () => schemesApi.getSchemeVersionDocuments(versionId),
    enabled: !!versionId,
  });
}

export function useCreateSchemeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: schemesApi.createScheme,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.schemes.all }),
  });
}

export function useUpdateSchemeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof schemesApi.updateScheme>[1];
    }) => schemesApi.updateScheme(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.schemes.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.schemes.all });
    },
  });
}

export function useCreateSchemeVersionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      schemeId,
      data,
    }: {
      schemeId: string;
      data: Parameters<typeof schemesApi.createSchemeVersion>[1];
    }) => schemesApi.createSchemeVersion(schemeId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.schemes.versions(vars.schemeId) });
    },
  });
}
