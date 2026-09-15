import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PortalLayout } from "@/components/mota/PortalLayout";
import { applicantNav } from "@/lib/portal-nav";
import { useAuth } from "@/lib/auth/AuthProvider";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [{ title: "Applicant Portal | MoTA Scholarships" }],
  }),
  component: PortalLayoutRoute,
});

function PortalLayoutRoute() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login", search: { returnTo: "/portal" }, replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) return null;

  const portalUser = {
    name: user.full_name,
    role: user.role,
    id: user.id,
  };

  return (
    <PortalLayout nav={applicantNav} portalName="Applicant Portal" user={portalUser}>
      <Outlet />
    </PortalLayout>
  );
}
