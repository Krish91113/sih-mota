/** TanStack Query hooks for Users, Roles, Permissions */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import * as usersApi from "@/api/users";

export function useUsersQuery() {
  return useQuery({ queryKey: queryKeys.users.all, queryFn: usersApi.listUsers });
}

export function useUserQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => usersApi.getUser(id),
    enabled: !!id,
  });
}

export function useRolesQuery() {
  return useQuery({ queryKey: queryKeys.roles.all, queryFn: usersApi.listRoles });
}

export function useRoleQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.roles.detail(id),
    queryFn: () => usersApi.getRole(id),
    enabled: !!id,
  });
}

export function usePermissionsQuery() {
  return useQuery({ queryKey: queryKeys.permissions.all, queryFn: usersApi.listPermissions });
}

export function useRolePermissionsQuery(roleId: string) {
  return useQuery({
    queryKey: queryKeys.roles.permissions(roleId),
    queryFn: () => usersApi.getRolePermissions(roleId),
    enabled: !!roleId,
  });
}

export function useCreateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}

export function useUpdateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof usersApi.updateUser>[1] }) =>
      usersApi.updateUser(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.users.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useCreateRoleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.createRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roles.all }),
  });
}

export function useUserScopesQuery(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.scopes(userId),
    queryFn: () => usersApi.getUserScopes(userId),
    enabled: !!userId,
  });
}

export function useAddUserScopeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: { scope_type: string; scope_value: string; resource?: string };
    }) => usersApi.addUserScope(userId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.users.scopes(vars.userId) });
    },
  });
}

export function useRemoveUserScopeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, scopeId }: { userId: string; scopeId: string }) =>
      usersApi.removeUserScope(userId, scopeId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.users.scopes(vars.userId) });
    },
  });
}
