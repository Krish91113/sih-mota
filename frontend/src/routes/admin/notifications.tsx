import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, StatusBadge, KpiCard } from "@/components/mota/bits";
import {
  useSentNotificationsQuery,
  useSendNotificationMutation,
} from "@/hooks/api/useNotifications";
import {
  useNotificationTemplatesQuery,
  useCreateNotificationTemplateMutation,
} from "@/hooks/api/useAdmin";
import { useUsersQuery } from "@/hooks/api/useUsers";
import { Bell, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({
    meta: [{ title: "Notifications | Administration" }],
  }),
  component: AdminNotifications,
});

function formatWhen(value: unknown): string {
  if (typeof value !== "string") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function AdminNotifications() {
  const sentQuery = useSentNotificationsQuery();
  const templatesQuery = useNotificationTemplatesQuery();
  const usersQuery = useUsersQuery();
  const sendMutation = useSendNotificationMutation();
  const createTemplate = useCreateNotificationTemplateMutation();

  const [userId, setUserId] = useState("");
  const [channel, setChannel] = useState("EMAIL");
  const [templateCode, setTemplateCode] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const sent = Array.isArray(sentQuery.data) ? sentQuery.data : [];
  const templates = Array.isArray(templatesQuery.data) ? templatesQuery.data : [];
  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];

  const delivered = sent.filter((n) => n.status === "SENT" || n.status === "DELIVERED").length;
  const failed = sent.filter((n) => n.status === "FAILED").length;

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast.error("Select a recipient");
      return;
    }
    if (channel !== "IN_APP" && !templateCode && !body.trim()) {
      toast.error("A message body or template is required");
      return;
    }
    try {
      await sendMutation.mutateAsync({
        user_id: userId,
        channel,
        template_code: templateCode || undefined,
        subject: subject.trim() || undefined,
        body: body.trim() || undefined,
      });
      setSubject("");
      setBody("");
      setTemplateCode("");
      toast.success("Notification sent");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send notification");
    }
  };

  const handleCreateTemplate = async () => {
    const code = templateCode.trim().toUpperCase();
    if (!code || !body.trim()) {
      toast.error("Template code and body are required");
      return;
    }
    try {
      await createTemplate.mutateAsync({
        code,
        channel,
        subject: subject.trim() || undefined,
        body: body.trim(),
        published: true,
      });
      toast.success("Template published");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create template");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manual notifications"
        desc="Send notifications to a user on demand and review recently dispatched messages."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Dispatched" value={String(sent.length)} icon={Bell} />
        <KpiCard label="Delivered" value={String(delivered)} icon={Send} />
        <KpiCard label="Failed" value={String(failed)} icon={TriangleAlert} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Recent notifications</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {sentQuery.isLoading ? (
              <p className="py-6 text-sm text-muted-foreground">Loading notifications…</p>
            ) : sentQuery.isError ? (
              <p className="py-6 text-sm text-destructive">We could not load notifications.</p>
            ) : sent.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No notifications have been dispatched yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">Recipient</th>
                      <th className="px-4 py-3 font-semibold">Channel</th>
                      <th className="px-4 py-3 font-semibold">Subject</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sent.map((n) => (
                      <tr key={n.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">
                          {n.recipient_name ?? n.recipient_email ?? n.user_id}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{n.channel}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {n.payload?.subject ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={n.status ?? "PENDING"} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatWhen(n.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card h-fit">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Send notification</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <Label htmlFor="nuser">Recipient</Label>
                <select
                  id="nuser"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a user…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="nchannel">Channel</Label>
                <select
                  id="nchannel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="IN_APP">In-App</option>
                </select>
              </div>
              <div>
                <Label htmlFor="ntemplate">Template (optional)</Label>
                <select
                  id="ntemplate"
                  value={templateCode}
                  onChange={(e) => setTemplateCode(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No template</option>
                  {templates.map((t) => (
                    <option key={t.id ?? t.code} value={t.code}>
                      {t.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="nsubject">Subject</Label>
                <Input
                  id="nsubject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="nbody">Message</Label>
                <Textarea
                  id="nbody"
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" disabled={sendMutation.isPending} className="w-full">
                <Send className="mr-1.5 size-4" />
                {sendMutation.isPending ? "Sending…" : "Send notification"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={createTemplate.isPending}
                onClick={handleCreateTemplate}
              >
                Save as template
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
