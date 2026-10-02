import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PortalLayout } from "@/components/mota/PortalLayout";
import { institutionNav } from "@/lib/portal-nav";
import { usePortalUser } from "@/hooks/usePortalUser";

export const Route = createFileRoute("/institution")({
  head: () => ({
    meta: [{ title: "Institution Portal | MoTA Scholarships" }],
  }),
  component: InstitutionLayout,
});

function InstitutionLayout() {
  const { portalUser, isLoading } = usePortalUser("/institution");
  if (isLoading || !portalUser)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  return (
    <PortalLayout user={portalUser} nav={institutionNav} portalName="Institution Portal">
      <Outlet />
    </PortalLayout>
  );
}
