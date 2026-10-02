import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard } from "@/components/mota/bits";
import { useSchemesQuery } from "@/hooks/api/useSchemes";
import { useUsersQuery, useRolesQuery } from "@/hooks/api/useUsers";
import { api } from "@/api/client";
import { ArrowRight, Cog, Users, ShieldCheck } from "lucide-react";
export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard | Administration" }] }),
  component: AdminDashboard,
});
function AdminDashboard() {
  const schemes = useSchemesQuery();
  const users = useUsersQuery();
  const roles = useRolesQuery();
  /** `GET /health` reports live service readiness — used for the integrations tile. */
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<HealthResponse>("/health"),
  });
  const loading = schemes.isLoading || users.isLoading || roles.isLoading;
  const error = schemes.isError || users.isError || roles.isError;
  type HealthResponse = {
    status?: string;
    integrations?: Record<string, { configured?: boolean }>;
  };
  const healthData = health.data as HealthResponse | undefined;
  /** `GET /health` reports each integration's real configured state. */
  const integrations = Object.entries(healthData?.integrations ?? {});
  const configuredCount = integrations.filter(([, v]) => v?.configured).length;
  if (loading) return <p className="text-sm text-muted-foreground">Loading administration data…</p>;
  if (error)
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load administration data.
      </p>
    );
  return (
    <div>
      <PageHeader
        title="Administration"
        desc="Configure schemes, access control, notifications and platform integrations."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active schemes"
          value={String(schemes.data?.filter((s) => s.active).length ?? 0)}
          icon={Cog}
        />
        <KpiCard label="Platform users" value={String(users.data?.length ?? 0)} icon={Users} />
        <KpiCard label="Roles" value={String(roles.data?.length ?? 0)} icon={ShieldCheck} />
        <KpiCard
          label="Platform health"
          value={healthData?.status ?? "—"}
          icon={Cog}
          hint={
            integrations.length
              ? `${configuredCount}/${integrations.length} integrations configured`
              : undefined
          }
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="flex-row items-center justify-between border-b border-dashed pb-3">
            <CardTitle className="text-base">Schemes</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/schemes">
                Manage <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {schemes.data?.slice(0, 5).map((s) => (
              <div key={s.id} className="rounded-xl border p-4 text-sm">
                <p className="font-medium">
                  {s.code} · {s.name}
                </p>
                <p className="text-xs text-muted-foreground">{s.active ? "Active" : "Inactive"}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Backend coverage</CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Integrations, notification templates and system settings do not have corresponding
            endpoints in the current API modules.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
