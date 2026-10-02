import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PortalLayout } from "@/components/mota/PortalLayout";
import { committeeNav } from "@/lib/portal-nav";
import { usePortalUser } from "@/hooks/usePortalUser";

export const Route = createFileRoute("/committee")({
  head: () => ({
    meta: [{ title: "Selection Committee | MoTA Scholarships" }],
  }),
  component: CommitteeLayout,
});

function CommitteeLayout() {
  const { portalUser, isLoading } = usePortalUser("/committee");
  if (isLoading || !portalUser)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  return (
    <PortalLayout user={portalUser} nav={committeeNav} portalName="Committee Portal">
      <Outlet />
    </PortalLayout>
  );
}
