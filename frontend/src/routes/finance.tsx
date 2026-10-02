import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PortalLayout } from "@/components/mota/PortalLayout";
import { financeNav } from "@/lib/portal-nav";
import { usePortalUser } from "@/hooks/usePortalUser";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [{ title: "Finance & Disbursement | MoTA Scholarships" }],
  }),
  component: FinanceLayout,
});

function FinanceLayout() {
  const { portalUser, isLoading } = usePortalUser("/finance");
  if (isLoading || !portalUser)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  return (
    <PortalLayout user={portalUser} nav={financeNav} portalName="Finance Portal">
      <Outlet />
    </PortalLayout>
  );
}
