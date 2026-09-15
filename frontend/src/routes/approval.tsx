import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PortalLayout } from "@/components/mota/PortalLayout";
import { approvalNav } from "@/lib/portal-nav";
import { usePortalUser } from "@/hooks/usePortalUser";

export const Route = createFileRoute("/approval")({
  head: () => ({
    meta: [{ title: "Sanctioning Authority | MoTA Scholarships" }],
  }),
  component: ApprovalLayout,
});

function ApprovalLayout() {
  const { portalUser, isLoading } = usePortalUser("/approval");
  if (isLoading || !portalUser)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  return (
    <PortalLayout user={portalUser} nav={approvalNav} portalName="Approval Portal">
      <Outlet />
    </PortalLayout>
  );
}
