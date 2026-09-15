import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  LoadingBlock,
  ErrorBlock,
  DeficiencyCard,
} from "@/components/mota/bits";
import { useApplicationsQuery } from "@/hooks/api/useApplications";
import { useCurrentUserQuery } from "@/hooks/api/useAuth";
import { useNotificationsQuery } from "@/hooks/api/useNotifications";
import { useQuery } from "@tanstack/react-query";
import { listDeficiencies } from "@/api/deficiencies";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bell,
  FilePlus2,
  FolderKanban,
  GraduationCap,
  LifeBuoy,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useMemo, type ComponentType } from "react";

export const Route = createFileRoute("/portal/")({
  component: ApplicantDashboard,
});

const quickActionIcons: Record<string, ComponentType<{ className?: string }>> = {
  "Apply for a scheme": FilePlus2,
  "View applications": FolderKanban,
  Documents: GraduationCap,
  Deficiencies: AlertTriangle,
  Notifications: Bell,
  Grievances: LifeBuoy,
  Profile: UserRound,
  "Help & guidelines": LifeBuoy,
};

function ApplicantDashboard() {
  const applicationsQuery = useApplicationsQuery();
  const deficienciesQuery = useQuery({
    queryKey: ["deficiencies", "portal"],
    queryFn: () => listDeficiencies(),
  });
  const notificationsQuery = useNotificationsQuery({ limit: 4 });
  const userQuery = useCurrentUserQuery();
  const loading =
    applicationsQuery.isLoading ||
    deficienciesQuery.isLoading ||
    notificationsQuery.isLoading ||
    userQuery.isLoading;
  const error =
    applicationsQuery.isError ||
    deficienciesQuery.isError ||
    notificationsQuery.isError ||
    userQuery.isError;
  const applications = (applicationsQuery.data ?? []).map((application) => ({
    ...application,
    scheme: String(application.scheme_name ?? application.scheme_id),
    progress: Number(application.progress ?? (application.status === "Draft" ? 25 : 100)),
    nextAction: String(application.next_action ?? "View application status"),
    deadline: String(application.deadline ?? "—"),
    stage: String(application.stage ?? application.status),
  }));
  const deficiencies = (deficienciesQuery.data ?? []).map((deficiency) => ({
    ...deficiency,
    issue: deficiency.description,
    action: deficiency.required_action,
    raisedBy: String(deficiency.raised_by ?? "Scrutiny officer"),
    deadline: deficiency.deadline ?? "—",
  }));
  const notifications = (notificationsQuery.data ?? []).map((notification) => ({
    ...notification,
    unread: !notification.read,
    time: notification.created_at ? new Date(notification.created_at).toLocaleDateString() : "",
  }));
  const currentUser = userQuery.data;
  const applicantQuickActions = [
    { label: "Apply for a scheme", to: "/portal/applications/new" },
    { label: "View applications", to: "/portal/applications" },
    { label: "Documents", to: "/portal/documents" },
    { label: "Deficiencies", to: "/portal/deficiencies" },
    { label: "Notifications", to: "/portal/notifications" },
    { label: "Grievances", to: "/portal/grievances" },
    { label: "Profile", to: "/portal/profile" },
  ] as const;
  const actionApps = useMemo(
    () => applications.filter((a) => a.status === "Action Required"),
    [applications],
  );

  if (loading) return <LoadingBlock label="Loading your dashboard" />;
  if (error)
    return (
      <ErrorBlock
        label="We could not load your dashboard"
        onRetry={() => window.location.reload()}
      />
    );

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${(currentUser?.full_name ?? "Applicant").split(" ")[0]}`}
        desc="Here is what is happening with your scholarship and fellowship applications."
        action={
          <Button asChild>
            <Link to="/portal/applications/new">
              <Plus className="size-4" aria-hidden /> Apply for a scheme
            </Link>
          </Button>
        }
      />

      {/* Action required */}
      {actionApps.length > 0 ? (
        <section aria-labelledby="action-heading" className="mb-8">
          <h2 id="action-heading" className="sr-only">
            Action required
          </h2>
          {deficiencies.map((d) => (
            <div key={d.id} className="mb-4">
              <DeficiencyCard d={d} onResolve={() => undefined} />
            </div>
          ))}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Applications */}
        <section className="lg:col-span-2" aria-labelledby="apps-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="apps-heading" className="text-lg">
              Active applications
            </h2>
            <Button asChild variant="ghost" className="text-primary">
              <Link to="/portal/applications">
                View all <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>

          {applications.length === 0 ? (
            <EmptyState
              title="No applications yet"
              desc="Start an application for an open scheme — your details are prefilled from your profile."
              action={
                <Button asChild>
                  <Link to="/portal/applications/new">Apply now</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {applications.map((a) => (
                <Link key={a.id} to="/portal/applications/$id" params={{ id: a.id }}>
                  <Card className="transition-shadow hover:shadow-lift">
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">{a.id}</span>
                            <StatusBadge status={a.status} />
                          </div>
                          <h3 className="mt-1.5 text-base font-semibold">{a.scheme}</h3>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-lg text-primary">{a.progress}%</p>
                          <p className="text-xs text-muted-foreground">complete</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <Progress
                          value={a.progress}
                          className="h-1.5"
                          aria-label={`Progress ${a.progress}%`}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Next:</span> {a.nextAction}
                        </p>
                        {a.deadline !== "—" ? (
                          <p className="font-medium text-warn">Respond by {a.deadline}</p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Notifications */}
        <aside aria-labelledby="notif-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="notif-heading" className="text-lg">
              Latest updates
            </h2>
            <Button asChild variant="ghost" className="text-primary">
              <Link to="/portal/notifications">All</Link>
            </Button>
          </div>
          <Card className="shadow-card">
            <CardContent className="divide-y p-0">
              {notifications.slice(0, 4).map((n, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.unread ? (
                      <span
                        className="size-2 shrink-0 rounded-full bg-primary"
                        aria-label="Unread"
                      />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">
                    {n.time}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Quick actions */}
      <section aria-labelledby="quick-heading" className="mt-8">
        <h2 id="quick-heading" className="mb-4 text-lg">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {applicantQuickActions.map((qa) => {
            const Icon = quickActionIcons[qa.label] ?? FilePlus2;
            return (
              <Link
                key={qa.label}
                to={qa.to}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <span className="rounded-lg bg-accent p-2 text-accent-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-sm font-medium">{qa.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* AI readiness note */}
      <section className="mt-8 flex items-start gap-3 rounded-xl border border-primary/20 bg-accent/40 p-4">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">
          AI-assisted document review is not yet live. All documents are currently verified manually
          by officers — you will always see a plain-language status.{" "}
          <Link
            to="/guidelines"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            How verification works
          </Link>
        </p>
      </section>
    </div>
  );
}
