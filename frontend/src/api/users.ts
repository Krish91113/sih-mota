/** Users & RBAC API — maps to /users/*, /roles/*, /permissions */
import { api } from "./client";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  [key: string]: unknown;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  [key: string]: unknown;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  scope: string;
  [key: string]: unknown;
}

export interface UserScope {
  id: string;
  scope_type: string;
  scope_value: string;
  resource: string | null;
  [key: string]: unknown;
}

// ── Users ────────────────────────────────────────────────────────────────────

export function listUsers() {
  return api.get<User[]>("/users");
}

export function getUser(id: string) {
  return api.get<User>(`/users/${id}`);
}

export function createUser(data: {
  email: string;
  full_name: string;
  role?: string;
  password?: string;
}) {
  return api.post<User>("/users", data);
}

export function updateUser(id: string, data: Partial<User> & { password?: string }) {
  return api.patch<User>(`/users/${id}`, data);
}

// ── User Roles ───────────────────────────────────────────────────────────────

export function getUserRoles(userId: string) {
  return api.get<Role[]>(`/users/${userId}/roles`);
}

export function assignUserRole(userId: string, roleId: string) {
  return api.post(`/users/${userId}/roles`, { role_id: roleId });
}

export function removeUserRole(userId: string, roleId: string) {
  return api.delete(`/users/${userId}/roles/${roleId}`);
}

// ── User Scopes ──────────────────────────────────────────────────────────────

export function getUserScopes(userId: string) {
  return api.get<UserScope[]>(`/users/${userId}/scopes`);
}

export function addUserScope(
  userId: string,
  data: { scope_type: string; scope_value: string; resource?: string },
) {
  return api.post(`/users/${userId}/scopes`, data);
}

export function updateUserScope(userId: string, scopeId: string, data: Partial<UserScope>) {
  return api.patch(`/users/${userId}/scopes/${scopeId}`, data);
}

export function removeUserScope(userId: string, scopeId: string) {
  return api.delete(`/users/${userId}/scopes/${scopeId}`);
}

// ── Roles ────────────────────────────────────────────────────────────────────

export function listRoles() {
  return api.get<Role[]>("/roles");
}

export function getRole(id: string) {
  return api.get<Role>(`/roles/${id}`);
}

export function createRole(data: { name: string; description?: string; is_active?: boolean }) {
  return api.post<Role>("/roles", data);
}

export function updateRole(id: string, data: Partial<Role>) {
  return api.patch<Role>(`/roles/${id}`, data);
}

// ── Role Permissions ─────────────────────────────────────────────────────────

export function getRolePermissions(roleId: string) {
  return api.get<string[]>(`/roles/${roleId}/permissions`);
}

export function setRolePermissions(roleId: string, permissions: string[]) {
  return api.put(`/roles/${roleId}/permissions`, { permissions });
}

// ── Permissions ──────────────────────────────────────────────────────────────

export function listPermissions() {
  return api.get<Permission[]>("/permissions");
}
