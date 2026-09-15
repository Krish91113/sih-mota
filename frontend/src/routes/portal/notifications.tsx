import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/mota/bits";
import { useNotificationsQuery } from "@/hooks/api/useNotifications";
import { useState } from "react";
import { AlertTriangle, BellRing, Mail, MessageSquareText } from "lucide-react";

export const Route = createFileRoute("/portal/notifications")({
  head: () => ({
    meta: [{ title: "Notifications | Applicant Portal" }],
  }),
  component: NotificationsCentre,
});

const ICON_BY_TITLE = [
  { match: /[Dd]eficiency/, icon: <AlertTriangle className="size-4" aria-hidden /> },
  { match: /[Ii]nstitution/, icon: <Mail className="size-4" aria-hidden /> },
  { match: /[Aa]pplication received/, icon: <MessageSquareText className="size-4" aria-hidden /> },
];

function iconFor(title: string) {
  const hit = ICON_BY_TITLE.find((i) => i.match.test(title));
  return hit?.icon ?? <BellRing className="size-4" aria-hidden />;
}

function NotificationsCentre() {
  const [tab, setTab] = useState("all");
  const query = useNotificationsQuery();
  const notifications = (query.data ?? []).map((notification) => ({
    ...notification,
    unread: !notification.read,
    time: notification.created_at ? new Date(notification.created_at).toLocaleDateString() : "",
  }));
  const filtered =
    tab === "all"
      ? notifications
      : notifications.filter((n) => (tab === "unread" ? n.unread : !n.unread));

  return (
    <div>
      <PageHeader
        title="Notifications"
        desc="Status changes, deficiencies and messages sent to your registered accounts."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isLoading ? (
        <p className="mt-4 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Loading notifications…
        </p>
      ) : null}
      {query.isError ? (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          We could not load notifications.
        </p>
      ) : null}
      <div className="mt-4 space-y-3">
        {filtered.map((n, i) => (
          <Card key={i} className={n.unread ? "border-primary/40 shadow-card" : "shadow-card"}>
            <CardContent className="flex items-start gap-3 p-5">
              <span
                className={`mt-0.5 rounded-lg p-2 ${n.unread ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {iconFor(n.title)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-sm font-semibold ${n.unread ? "" : "text-muted-foreground"}`}>
                    {n.title}
                  </p>
                  {n.unread ? (
                    <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-2 text-xs text-muted-foreground/70">{n.time}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            <BellRing className="mx-auto mb-2 size-6 text-muted-foreground/50" aria-hidden />
            No {tab} notifications.
          </p>
        ) : null}
      </div>
    </div>
  );
}
