import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, KpiCard, StatusBadge } from "@/components/mota/bits";
import { useApplicationsQuery } from "@/hooks/api/useApplications";
import { useGrievancesQuery } from "@/hooks/api/useGrievances";
import { useUsersQuery } from "@/hooks/api/useUsers";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  FolderKanban,
  ShieldCheck,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/institution/")({
  head: () => ({
    meta: [{ title: "Institution Dashboard | MoTA Scholarships" }],
  }),
  component: InstitutionDashboard,
});

function InstitutionDashboard() {
  const navigate = useNavigate();
  const {
    data: institutionApps = [],
    isLoading: appsLoading,
    isError: appsError,
  } = useApplicationsQuery();
  const { data: institutionClarifications = [], isLoading: clarificationsLoading } =
    useGrievancesQuery();
  const { data: institutionUsers = [], isLoading: usersLoading } = useUsersQuery();
  const institutionVerifications = institutionApps;
  if (appsLoading || clarificationsLoading || usersLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading institution dashboard…</p>;
  if (appsError)
    return <p className="py-8 text-sm text-destructive">We could not load institution data.</p>;
  const total = institutionApps.length;
  const pending = institutionApps.filter((a) => a.status === "Pending").length;
  const clarifications = institutionClarifications.filter(
    (c) => c.status === "Awaiting response",
  ).length;

  return (
    <div>
      <PageHeader
        title="Institution dashboard"
        desc="Verify that applicants are genuinely enrolled with you. Your confirmation decides whether an application proceeds."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Assigned applications" value={String(total)} icon={FolderKanban} />
        <KpiCard label="Pending verification" value={String(pending)} icon={Clock} />
        <KpiCard label="Open clarifications" value={String(clarifications)} icon={ShieldCheck} />
        <KpiCard
          label="Cleared"
          value={String(institutionApps.filter((a) => a.status === "Cleared").length)}
          icon={CheckCircle2}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="flex-row items-center justify-between border-b border-dashed pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-primary" aria-hidden /> Verification queue
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-primary">
              <Link to="/institution/verifications">
                View all <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-3">
            <ul>
              {institutionVerifications.map((v, i) => (
                <li key={v.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left hover:bg-muted/50"
                    onClick={() =>
                      v.status === "Pending" &&
                      navigate({
                        to: "/institution/applications/$id",
                        params: { id: v.application },
                      })
                    }
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{v.student}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.type} verification · {v.course}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-muted-foreground">{v.due}</span>
                      <StatusBadge status={v.status} />
                    </div>
                  </button>
                  {i < institutionVerifications.length - 1 ? (
                    <hr className="mx-3 border-dashed" />
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-destructive/30 bg-destructive/[0.02] shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-destructive" aria-hidden /> Clarifications
                needed
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <ul>
                {institutionClarifications.map((c, i) => (
                  <li key={c.id} className="rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{c.subject}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {c.application} · from {c.from}
                        </p>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    {i < institutionClarifications.length - 1 ? (
                      <hr className="mt-3 border-dashed" />
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="px-3 pb-3">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/institution/clarifications">
                    Open clarifications desk <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6 shadow-card">
        <CardHeader className="border-b border-dashed pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" aria-hidden /> Institution users
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {institutionUsers.map((u) => (
                <tr key={u.email} className="border-b last:border-0">
                  <td className="px-5 py-3 font-medium">{u.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{u.role}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.status === "Active" ? "bg-leaf/10 text-leaf" : "bg-accent text-accent-foreground"}`}
                    >
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
