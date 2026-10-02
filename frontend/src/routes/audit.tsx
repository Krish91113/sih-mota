import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PortalLayout } from "@/components/mota/PortalLayout";
import { auditNav } from "@/lib/portal-nav";
import { usePortalUser } from "@/hooks/usePortalUser";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [{ title: "Audit Trail | MoTA Scholarships" }],
  }),
  component: AuditLayout,
});

function AuditLayout() {
  const { portalUser, isLoading } = usePortalUser("/audit");
  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  if (!portalUser)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-destructive">Unable to load your audit access.</p>
      </div>
    );
  return (
    <PortalLayout user={portalUser} nav={auditNav} portalName="Audit Portal">
      <Outlet />
    </PortalLayout>
  );
}
