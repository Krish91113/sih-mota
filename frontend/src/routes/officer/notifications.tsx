import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/mota/bits";
import { useNotificationsQuery } from "@/hooks/api/useNotifications";
import {
  isNotificationRead,
  notificationBody,
  notificationTime,
  notificationTitle,
} from "@/api/notifications";
import { formatRelative, humanizeField } from "@/lib/format";
import { useState } from "react";
import { AlertTriangle, BellRing, Mail, MessageSquareText } from "lucide-react";

export const Route = createFileRoute("/officer/notifications")({
  head: () => ({
    meta: [{ title: "Notifications | Officer Workspace" }],
  }),
  component: OfficerNotifications,
});

/** Icons are chosen from the delivery channel / status, not a made-up title. */
const ICON_BY_CHANNEL = [
  { match: /EMAIL|SMS|WHATSAPP/, icon: <Mail className="size-4" aria-hidden /> },
  { match: /FAIL/, icon: <AlertTriangle className="size-4" aria-hidden /> },
  { match: /PENDING/, icon: <MessageSquareText className="size-4" aria-hidden /> },
];

function iconFor(channel: string, status: string) {
  const hit =
    ICON_BY_CHANNEL.find((i) => i.match.test(status)) ??
    ICON_BY_CHANNEL.find((i) => i.match.test(channel));
  return hit?.icon ?? <BellRing className="size-4" aria-hidden />;
}

function OfficerNotifications() {
  const [tab, setTab] = useState("all");
  const { data: notifications = [], isLoading, isError } = useNotificationsQuery();
  const filtered =
    tab === "all"
      ? notifications
      : notifications.filter((n) =>
          tab === "unread" ? !isNotificationRead(n) : isNotificationRead(n),
        );

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading notifications…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load notifications.</p>;
  return (
    <div>
      <PageHeader
        title="Notifications"
        desc="Updates about your queue, deficiencies and workflow events."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 space-y-3">
        {filtered.map((n) => {
          const unread = !isNotificationRead(n);
          return (
            <Card key={n.id} className={unread ? "border-primary/40 shadow-card" : "shadow-card"}>
              <CardContent className="flex items-start gap-3 p-5">
                <span
                  className={`mt-0.5 rounded-lg p-2 ${unread ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {iconFor(n.channel, n.status)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-sm font-semibold ${unread ? "" : "text-muted-foreground"}`}>
                      {notificationTitle(n)}
                    </p>
                    {unread ? (
                      <span
                        className="size-2 shrink-0 rounded-full bg-primary"
                        aria-label="Unread"
                      />
                    ) : null}
                  </div>
                  {notificationBody(n) ? (
                    <p className="mt-1 text-sm text-muted-foreground">{notificationBody(n)}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground/70">
                    {humanizeField(n.channel)} · {formatRelative(notificationTime(n))}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No {tab} notifications.
          </p>
        ) : null}
      </div>
    </div>
  );
}
