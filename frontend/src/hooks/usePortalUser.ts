/**
 * usePortalUser — returns the PortalUser shape needed by PortalLayout,
 * derived from the real AuthProvider context.
 *
 * Also handles the auth guard: redirects to /login if unauthenticated.
 */
import { useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useNavigate } from "@tanstack/react-router";

export type PortalUser = { name: string; role: string; id: string };

export function usePortalUser(returnTo: string) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login", search: { returnTo }, replace: true });
    }
  }, [isLoading, isAuthenticated, navigate, returnTo]);

  const portalUser: PortalUser | null = user
    ? { name: user.full_name, role: user.role, id: user.id }
    : null;

  return { portalUser, isLoading };
}
