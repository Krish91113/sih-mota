/** TanStack Query hooks for Authentication */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAuth } from "@/lib/auth/AuthProvider";
import * as authApi from "@/api/auth";

export function useCurrentUserQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: authApi.getMe,
    initialData: user ?? undefined,
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });
}

export function useLoginMutation() {
  const { setUser } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: async () => {
      const profile = await authApi.getMe();
      setUser(profile);
      queryClient.setQueryData(queryKeys.auth.me, profile);
    },
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: ({
      email,
      password,
      fullName,
    }: {
      email: string;
      password: string;
      fullName: string;
    }) => authApi.register(email, password, fullName),
  });
}

export function useLogoutMutation() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useSessionsQuery() {
  return useQuery({
    queryKey: queryKeys.auth.sessions,
    queryFn: authApi.getSessions,
  });
}

export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions });
    },
  });
}

export function useApplicantProfileQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.auth.profile,
    queryFn: authApi.getApplicantProfile,
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

export function useUpdateApplicantProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.updateApplicantProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.profile, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });
}
