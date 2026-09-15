import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PortalLayout } from "@/components/mota/PortalLayout";
import { analyticsNav } from "@/lib/portal-nav";
import { usePortalUser } from "@/hooks/usePortalUser";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [{ title: "Analytics | MoTA Scholarships" }],
  }),
  component: AnalyticsLayout,
});

function AnalyticsLayout() {
  const { portalUser, isLoading } = usePortalUser("/analytics");
  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  if (!portalUser)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-destructive">Unable to load your analytics access.</p>
      </div>
    );
  return (
    <PortalLayout user={portalUser} nav={analyticsNav} portalName="Analytics Portal">
      <Outlet />
    </PortalLayout>
  );
}
