import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PortalLayout } from "@/components/mota/PortalLayout";
import { adminNav } from "@/lib/portal-nav";
import { usePortalUser } from "@/hooks/usePortalUser";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Administration | MoTA Scholarships" }],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { portalUser, isLoading } = usePortalUser("/admin");
  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  if (!portalUser)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-destructive">Unable to load your admin access.</p>
      </div>
    );
  return (
    <PortalLayout user={portalUser} nav={adminNav} portalName="Admin Portal">
      <Outlet />
    </PortalLayout>
  );
}
