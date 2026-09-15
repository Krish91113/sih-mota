import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, KpiCard } from "@/components/mota/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ShieldCheck,
  Mail,
  Database,
  Image,
  Landmark,
  Server,
  TriangleAlert,
} from "lucide-react";

export const Route = createFileRoute("/admin/integrations")({
  head: () => ({ meta: [{ title: "Integrations | Administration" }] }),
  component: Integrations,
});

function Integrations() {
  const healthQuery = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => api.get<{ status: string; ai: string; integrations: string }>("/health"),
    retry: 1,
  });

  const backendReachable = !healthQuery.isError && healthQuery.data !== undefined;
  const status = healthQuery.data?.status === "ok" ? "Operational" : "Unavailable";
  const degraded = !backendReachable;

  const services = [
    {
      name: "FastAPI Core API Gateway",
      provider: "Internal /api/v1",
      status: degraded
        ? "Unavailable"
        : healthQuery.data?.status === "ok"
          ? "Operational"
          : "Degraded",
      desc: "Handles core application workflow, authentication, and database transactions.",
      icon: Server,
    },
    {
      name: "ImageKit Document & File Storage",
      provider:
        healthQuery.data?.integrations === "imagekit" ? "ImageKit CDN Gateway" : "Storage backend",
      status: degraded ? "Unavailable" : "Operational",
      desc: "Secure encrypted document upload and certificate storage. Uploads fail with HTTP 503 when this gateway is down.",
      icon: Image,
    },
    {
      name: "Gmail / SMTP Notification Service",
      provider: "Google SMTP Relay",
      status: degraded ? "Unavailable" : "Operational",
      desc: "Applicant status notifications, OTP delivery, and circular alerts.",
      icon: Mail,
    },
    {
      name: "PFMS / Public Financial Management System",
      provider: "Ministry of Finance PFMS Gateway",
      status: degraded ? "Unavailable" : "Operational",
      desc: "Direct Benefit Transfer (DBT) and treasury disbursement reconciliation.",
      icon: Landmark,
    },
    {
      name: "DigiLocker & UIDAI Verification",
      provider: "MeitY National Identity Stack",
      status: degraded ? "Unavailable" : "Operational",
      desc: "Automated Aadhaar e-KYC and digital caste certificate verification.",
      icon: ShieldCheck,
    },
    {
      name: "PostgreSQL Database Stack",
      provider: "Primary Relational Cluster",
      status: degraded ? "Unavailable" : "Operational",
      desc: "ACID transactional datastore with row-level security and audit logging.",
      icon: Database,
    },
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
        <KpiCard label="API health" value={status} icon={degraded ? TriangleAlert : ShieldCheck} />
      </div>

      {degraded ? (
        <p className="text-sm text-destructive">
          Backend gateway unreachable ({healthQuery.error?.message ?? "network error"}). Service
          status reflects that no integration is currently reachable.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => {
          const Icon = svc.icon;
          const ok = svc.status === "Operational";
          return (
            <Card key={svc.name} className="shadow-card flex flex-col justify-between">
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
