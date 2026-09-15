/**
 * AuthProvider — React context that manages authentication state.
 *
 * On mount, reads stored tokens and calls `GET /auth/me` to restore session.
 * Provides `currentUser`, `isAuthenticated`, `isLoading`, and a `logout` action.
 *
 * Usage:
 * ```tsx
 * // Wrap your app (done in __root.tsx):
 * <AuthProvider><Outlet /></AuthProvider>
 *
 * // Consume anywhere:
 * const { user, isAuthenticated, logout } = useAuth();
 * ```
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getAccessToken, clearTokens } from "@/api/client";
import { getMe, logout as apiLogout, type UserProfile } from "@/api/auth";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  /** Currently authenticated user, or null */
  user: UserProfile | null;
  /** Plan-compatible alias for `user`. */
  currentUser: UserProfile | null;
  /** True while the initial auth check is in progress */
  isLoading: boolean;
  /** Plan-compatible alias for `isLoading`. */
  loading: boolean;
  /** Shorthand — `user !== null` */
  isAuthenticated: boolean;
  /** Role names supplied by the backend. */
  roles: string[];
  /** Permission keys supplied by the backend when available. */
  permissions: string[];
  /** Log out: calls backend, clears tokens, resets state */
  logout: () => Promise<void>;
  /** Force-reload the current user from the backend */
  refreshUser: () => Promise<void>;
  /** Set user directly (useful after login) */
  setUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = getAccessToken();
      if (!token) {
        setUser(null);
        return;
      }
      const profile = await getMe();
      setUser(profile);
    } catch {
      setUser(null);
      clearTokens();
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      /* best-effort */
    }
    setUser(null);
    clearTokens();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        currentUser: user,
        isLoading,
        loading: isLoading,
        isAuthenticated: user !== null,
        roles: user ? [user.role] : [],
        permissions: user?.permissions ?? [],
        logout,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// RoleGuard — hide children when the user lacks a required role/permission
// ---------------------------------------------------------------------------

/**
 * Simple UX guard. Does NOT replace backend authorization.
 *
 * ```tsx
 * <RoleGuard roles={["SUPER_ADMIN"]}>
 *   <AdminPanel />
 * </RoleGuard>
 * ```
 */
export function RoleGuard({
  roles = [],
  permission,
  children,
  fallback = null,
}: {
  /** Backend role names the user must have one of */
  roles?: string[];
  /** Optional backend permission key, such as `applications:read:OWN`. */
  permission?: string;
  children: ReactNode;
  /** Rendered when the user lacks the role or permission */
  fallback?: ReactNode;
}) {
  const { user, permissions } = useAuth();
  if (!user) return <>{fallback}</>;
  if (roles.length > 0 && !roles.includes(user.role)) return <>{fallback}</>;
  if (permission && !permissions.includes(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
