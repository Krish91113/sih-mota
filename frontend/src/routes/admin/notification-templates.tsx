import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, KpiCard } from "@/components/mota/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useNotificationTemplatesQuery,
  useCreateNotificationTemplateMutation,
} from "@/hooks/api/useAdmin";
import { Mail, MessageSquare, Plus, Send, Bell } from "lucide-react";
import { toast } from "sonner";

interface NotificationTemplateItem {
  id?: string;
  code: string;
  channel: string;
  subject?: string;
  body: string;
  published?: boolean;
}

export const Route = createFileRoute("/admin/notification-templates")({
  head: () => ({ meta: [{ title: "Notification Templates | Administration" }] }),
  component: NotificationTemplates,
});

function NotificationTemplates() {
  const templatesQuery = useNotificationTemplatesQuery();
  const createMutation = useCreateNotificationTemplateMutation();

  const [code, setCode] = useState("");
  const [channel, setChannel] = useState("EMAIL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const rawTemplates: NotificationTemplateItem[] = Array.isArray(templatesQuery.data)
    ? (templatesQuery.data as NotificationTemplateItem[])
    : [];

  const templates = rawTemplates;

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !body.trim()) {
      toast.error("Template code and body are required");
      return;
    }
    try {
      await createMutation.mutateAsync({
        code: code.trim().toUpperCase(),
        channel,
        subject: subject.trim() || undefined,
        body: body.trim(),
        published: true,
      });
      setCode("");
      setSubject("");
      setBody("");
      toast.success("Notification template published");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create template";
      toast.error(errorMsg);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification templates"
        desc="Reusable message templates, delivery channels and automated alerts."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Published templates" value={String(templates.length)} icon={Mail} />
        <KpiCard
          label="Email templates"
          value={String(
            templates.filter((t: NotificationTemplateItem) => t.channel === "EMAIL").length,
          )}
          icon={Send}
        />
        <KpiCard
          label="SMS & In-app"
          value={String(
            templates.filter((t: NotificationTemplateItem) => t.channel !== "EMAIL").length,
          )}
          icon={Bell}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Configured templates ({templates.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {templatesQuery.isLoading ? (
                <p className="py-6 text-sm text-muted-foreground">Loading templates…</p>
              ) : templatesQuery.isError ? (
                <p className="py-6 text-sm text-destructive">We could not load templates.</p>
              ) : templates.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">
                  No notification templates have been published yet.
                </p>
              ) : (
                templates.map((t: NotificationTemplateItem) => (
                  <div key={t.id || t.code} className="rounded-lg border p-4 bg-card space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold bg-accent px-2 py-0.5 rounded text-accent-foreground">
                          {t.code}
                        </span>
                        <span className="text-xs text-muted-foreground uppercase">{t.channel}</span>
                      </div>
                      <span className="rounded-full bg-leaf/10 px-2.5 py-0.5 text-xs font-semibold text-leaf">
                        Published
                      </span>
                    </div>
                    {t.subject && (
                      <p className="text-sm font-medium text-foreground">{t.subject}</p>
                    )}
                    <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded font-mono break-words">
                      {t.body}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card h-fit">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Create template</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <Label htmlFor="tcode">Template code</Label>
                <Input
                  id="tcode"
                  placeholder="e.g. GRIEVANCE_RESOLVED"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1.5 font-mono uppercase text-xs"
                />
              </div>
              <div>
                <Label htmlFor="tchannel">Delivery channel</Label>
                <select
                  id="tchannel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="IN_APP">In-App Notification</option>
                </select>
              </div>
              <div>
                <Label htmlFor="tsubject">Subject line (Email only)</Label>
                <Input
                  id="tsubject"
                  placeholder="e.g. Your grievance ticket has been resolved"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="tbody">Body / Message</Label>
                <Textarea
                  id="tbody"
                  rows={4}
                  placeholder="Supports placeholders: {{application_id}}, {{name}}, etc."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="mt-1.5 font-mono text-xs"
                />
              </div>
              <Button type="submit" disabled={createMutation.isPending} className="w-full">
                <Plus className="mr-1.5 size-4" />
                {createMutation.isPending ? "Creating…" : "Publish template"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
