import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { PortalLayout } from "@/components/mota/PortalLayout";
import { officerNav } from "@/lib/portal-nav";
import { usePortalUser } from "@/hooks/usePortalUser";
import { useOfficerQueueQuery } from "@/hooks/api/useQueues";

export const Route = createFileRoute("/officer")({
  head: () => ({
    meta: [{ title: "Officer Workspace | MoTA Scholarships" }],
  }),
  component: OfficerLayout,
});

function OfficerLayout() {
  const { portalUser, isLoading } = usePortalUser("/officer");
  const { data: queue } = useOfficerQueueQuery();
  if (isLoading || !portalUser)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  return (
    <PortalLayout
      user={portalUser}
      nav={officerNav}
      portalName="Officer Workspace"
      badgeCounts={{ "/officer/queue": queue?.length ?? 0 }}
    >
      <Outlet />
    </PortalLayout>
  );
}
