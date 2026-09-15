import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/mota/bits";
import { useQuery } from "@tanstack/react-query";
import { getAiConfig } from "@/api/ai";
import { Sparkles } from "lucide-react";
export const Route = createFileRoute("/analytics/ai")({
  head: () => ({ meta: [{ title: "AI Analytics | MoTA Scholarships" }] }),
  component: AiAnalytics,
});
function AiAnalytics() {
  const query = useQuery({ queryKey: ["ai", "config"], queryFn: getAiConfig });
  const config = (query.data ?? {}) as {
    provider?: string;
    model_version?: string;
    threshold_classify?: number;
    threshold_extract?: number;
    enabled?: boolean;
  };
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
        title="AI analytics"
        desc="Performance of AI-assisted classification, extraction and validation."
      />
      <Card className="mx-auto max-w-2xl border-dashed bg-card shadow-card">
        <CardHeader className="border-b border-dashed pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" aria-hidden /> AI capability status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-8">
          <div className="text-center">
            <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              {config.enabled ? "Enabled" : "Not enabled in this environment"}
            </span>
          </div>
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Document extraction and automated verification thresholds active for the current scheme
            cycle.
          </p>
          <dl className="space-y-3 rounded-xl border p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Provider</dt>
              <dd>{config.provider ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Model version</dt>
              <dd>{config.model_version ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Classification threshold</dt>
              <dd>{config.threshold_classify ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Extraction threshold</dt>
              <dd>{config.threshold_extract ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
