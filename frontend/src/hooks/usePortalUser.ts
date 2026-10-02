/**
 * usePortalUser — returns the PortalUser shape needed by PortalLayout, derived
 * from the real AuthProvider context.
 *
 * Responsibilities:
 *  1. Auth guard — redirect to /login when there is no session.
 *  2. Route guard — redirect to the user's own portal when the current route
 *     requires a role the account does not hold, so a user never lands on an
 *     empty shell and gets a wall of 403s.
 *
 * Both guards are UX only; the backend remains the authority on every request.
 */
import { useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { portalForRole } from "@/lib/auth/rolePortals";
import { canAccessPath } from "@/lib/auth/access";
import { useLocation, useNavigate } from "@tanstack/react-router";

export type PortalUser = {
  name: string;
  role: string;
  /** Every role held by the account, not just the primary one. */
  roles: string[];
  permissions: string[];
  email: string;
  id: string;
};

export function usePortalUser(returnTo: string) {
  const { user, isLoading, isAuthenticated, roles, permissions } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login", search: { returnTo }, replace: true });
    }
  }, [isLoading, isAuthenticated, navigate, returnTo]);

  // Route-level authorisation. Only runs once the session is resolved so we
  // never bounce a still-loading user.
  const path = location.pathname;
  useEffect(() => {
    if (isLoading || !user) return;
    const rule = canAccessPath(path);
    if (rule && !rule.roles.some((r) => roles.includes(r))) {
      navigate({ to: portalForRole(user.role), replace: true });
    }
  }, [isLoading, user, roles, path, navigate]);

  const portalUser: PortalUser | null = user
    ? {
        name: user.full_name,
        role: user.role,
        roles,
        permissions,
        email: user.email,
        id: user.id,
      }
    : null;

  return { portalUser, isLoading, roles, permissions };
}
