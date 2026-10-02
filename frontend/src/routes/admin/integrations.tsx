import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, KpiCard } from "@/components/mota/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Mail,
  Database,
  Image,
  Landmark,
  Server,
  Sparkles,
  TriangleAlert,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/admin/integrations")({
  head: () => ({ meta: [{ title: "Integrations | Administration" }] }),
  component: Integrations,
});

interface IntegrationInfo {
  mode: string;
  configured: boolean;
}

interface HealthResponse {
  status: string;
  ai: string;
  environment?: string;
  integrations: {
    storage?: IntegrationInfo;
    email?: IntegrationInfo;
    finance?: IntegrationInfo;
    database?: IntegrationInfo;
    ai?: IntegrationInfo;
    [key: string]: IntegrationInfo | undefined;
  };
}

const SERVICE_META: Record<
  string,
  { name: string; provider: string; desc: string; icon: typeof Server }
> = {
  storage: {
    name: "Document & File Storage",
    provider: "Cloudinary / local storage gateway",
    desc: "Secure document upload and certificate storage for applications.",
    icon: Image,
  },
  email: {
    name: "Email / Notification Service",
    provider: "SMTP relay",
    desc: "Applicant status notifications, OTP delivery, and circular alerts.",
    icon: Mail,
  },
  finance: {
    name: "Finance / Disbursement Provider",
    provider: "PFMS / treasury gateway",
    desc: "Direct Benefit Transfer (DBT) and treasury disbursement reconciliation.",
    icon: Landmark,
  },
  database: {
    name: "PostgreSQL Database Stack",
    provider: "Primary relational cluster",
    desc: "ACID transactional datastore with audit logging.",
    icon: Database,
  },
  ai: {
    name: "AI Eligibility Assistant",
    provider: "Optional language-model service",
    desc: "Assisted eligibility checks and application guidance.",
    icon: Sparkles,
  },
};

function serviceStatus(info: IntegrationInfo | undefined, backendReachable: boolean): string {
  if (!backendReachable) return "Unavailable";
  if (!info || !info.configured) return "Not configured";
  return "Operational";
}

function Integrations() {
  const healthQuery = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => api.get<HealthResponse>("/health"),
    retry: 1,
    refetchInterval: 60 * 1000,
  });

  const backendReachable = !healthQuery.isError && healthQuery.data !== undefined;
  const health = healthQuery.data;
  const overall = backendReachable
    ? health?.status === "ok"
      ? "Operational"
      : "Degraded"
    : "Unavailable";

  const entries = Object.entries(health?.integrations ?? {}).filter(([key]) => SERVICE_META[key]);

  const services = [
    {
      key: "api",
      name: "FastAPI Core API Gateway",
      provider: "Internal /api/v1",
      desc: "Core application workflow, authentication, and database transactions.",
      icon: Server,
      status: backendReachable ? "Operational" : "Unavailable",
    },
    ...entries.flatMap(([key, info]) => {
      const meta = SERVICE_META[key];
      if (!meta || !info) return [];
      return [
        {
          key,
          name: meta.name,
          provider: `${meta.provider} · ${info.mode}`,
          desc: meta.desc,
          icon: meta.icon,
          status: serviceStatus(info, backendReachable),
        },
      ];
    }),
  ];

  const operationalCount = services.filter((s) => s.status === "Operational").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="External integrations"
        desc="Health, connectivity, and status of external services connected to the platform."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Connected services" value={String(services.length)} icon={Server} />
        <KpiCard label="Operational" value={String(operationalCount)} icon={CheckCircle2} />
        <KpiCard
          label="API health"
          value={overall}
          icon={backendReachable ? CheckCircle2 : TriangleAlert}
        />
      </div>

      {backendReachable ? (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Environment: <span className="font-medium">{health?.environment ?? "unknown"}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => healthQuery.refetch()}
            disabled={healthQuery.isFetching}
          >
            <RefreshCw
              className={cn("mr-1.5 size-3.5", healthQuery.isFetching && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      ) : (
        <p className="text-sm text-destructive">
          Backend gateway unreachable ({healthQuery.error?.message ?? "network error"}). Service
          status reflects that no integration is currently reachable.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => {
          const Icon = svc.icon;
          const ok = svc.status === "Operational";
          return (
            <Card key={svc.key} className="shadow-card flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-accent p-2 text-accent-foreground">
                    <Icon className="size-5" />
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      ok ? "bg-leaf/10 text-leaf" : "bg-destructive/10 text-destructive",
                    )}
                  >
                    <span
                      className={cn("size-1.5 rounded-full", ok ? "bg-leaf" : "bg-destructive")}
                    />
                    {svc.status}
                  </span>
                </div>
                <CardTitle className="mt-3 text-base">{svc.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{svc.provider}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">{svc.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
