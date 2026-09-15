import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/mota/bits";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAiConfig, updateAiConfig } from "@/api/ai";
import { useState } from "react";
import { Save, Sparkles } from "lucide-react";
export const Route = createFileRoute("/admin/ai")({
  head: () => ({ meta: [{ title: "AI Configuration | Administration" }] }),
  component: AiConfig,
});
function AiConfig() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["ai", "config"], queryFn: getAiConfig });
  const config = (query.data ?? {}) as Record<string, unknown>;
  const [enabled, setEnabled] = useState(Boolean(config.enabled));
  const [provider, setProvider] = useState(String(config.provider ?? ""));
  const mutation = useMutation({
    mutationFn: () => updateAiConfig({ ...config, enabled, provider }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "config"] }),
  });
  if (query.isLoading)
    return <p className="text-sm text-muted-foreground">Loading AI configuration…</p>;
  if (query.isError)
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load AI configuration.
      </p>
    );
  return (
    <div>
      <PageHeader
        title="AI configuration"
        desc="Configure provider availability and thresholds for AI-assisted review."
      />
      <Card className="max-w-3xl shadow-card">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center justify-between rounded-xl border p-4">
            <p className="flex items-center gap-2 font-medium">
              <Sparkles className="size-4 text-primary" /> AI features enabled
            </p>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          </div>
          <label className="block text-sm">
            Provider
            <input
              className="mt-2 h-10 w-full rounded-md border px-3"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </label>
          <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
            Model: {String(config.model_version ?? "—")}. Analytics throughput metrics are not
            exposed by the current AI API.
          </p>
          <div className="flex items-center justify-between border-t pt-5">
            <StatusBadge status={enabled ? "Processed" : "Pending"} />
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              <Save className="size-4" /> {mutation.isPending ? "Saving…" : "Save configuration"}
            </Button>
          </div>
          {mutation.isError ? (
            <p className="text-sm text-destructive">Unable to save AI configuration.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
