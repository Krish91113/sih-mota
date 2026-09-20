import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, StatusBadge } from "@/components/mota/bits";
import { UploadZone } from "@/components/mota/UploadZone";
import { useApplicationQuery } from "@/hooks/api/useApplications";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listDeficiencies, respondToDeficiency } from "@/api/deficiencies";
import { useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/applications/$id/deficiency")({
  component: DeficiencyResponse,
});

function DeficiencyResponse() {
  const { id } = Route.useParams();
  const appQuery = useApplicationQuery(id);
  const deficienciesQuery = useQuery({
    queryKey: ["deficiencies", id],
    queryFn: () => listDeficiencies({ application_id: id }),
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [responded, setResponded] = useState(false);
  const [response, setResponse] = useState("");
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);
  const respondMutation = useMutation({
    mutationFn: ({ deficiencyId, data }: { deficiencyId: string; data: Record<string, unknown> }) =>
      respondToDeficiency(deficiencyId, data as { response: string }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deficiencies", id] });
      setResponded(true);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not submit response"),
  });

  const app = appQuery.data;
  const list = deficienciesQuery.data ?? [];

  if (appQuery.isLoading || deficienciesQuery.isLoading)
    return <p className="py-12 text-sm text-muted-foreground">Loading deficiencies…</p>;
  if (appQuery.isError || deficienciesQuery.isError || !app)
    return <p className="py-12 text-sm text-destructive">We could not load this application.</p>;

  if (responded) {
    return (
      <div>
        <Card className="mx-auto max-w-xl border-leaf/30 shadow-lift">
          <CardContent className="flex flex-col items-center p-10 text-center">
            <span className="rounded-full bg-leaf/10 p-4 text-leaf">
              <CheckCircle2 className="size-10" aria-hidden />
            </span>
            <h1 className="mt-5 text-2xl">Response submitted</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your response is now with the scrutiny officer. Track the application to see when the
              deficiency is closed.
            </p>
            <Button
              className="mt-6"
              onClick={() => navigate({ to: "/portal/applications/$id", params: { id: app.id } })}
            >
              Back to application <ArrowRight className="size-4" aria-hidden />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Action required — deficiencies"
        desc={`Respond to the issues raised on ${app.application_number ?? app.id} before the deadlines below.`}
        action={<StatusBadge status="Action Required" />}
      />

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-8 text-sm text-muted-foreground">
          No open deficiencies on this application.
        </p>
      ) : (
        <div className="space-y-6">
          {list.map((d, i) => (
            <Card key={d.id} className="border-destructive/30 bg-destructive/[0.03] shadow-card">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground">
                    <AlertTriangle className="size-3.5" aria-hidden /> Deficiency {i + 1} of{" "}
                    {list.length}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {d.id} · {d.type}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold">{d.description}</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Required action
                    </dt>
                    <dd className="mt-1 text-sm font-medium">{d.required_action}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Severity
                    </dt>
                    <dd className="mt-1 text-sm font-medium">{d.severity}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Deadline
                    </dt>
                    <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium text-destructive">
                      <Clock className="size-3.5" aria-hidden />{" "}
                      {d.deadline ? new Date(d.deadline).toLocaleDateString() : "—"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-5">
                  <p className="text-sm font-medium">Upload replacement document</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF or JPG up to 5 MB. The earlier file is retained in version history for
                    audit.
                  </p>
                  <div className="mt-3">
                    <UploadZone
                      applicationId={app.id}
                      documentType={d.type || "MARKSHEET"}
                      onUploaded={(doc) => {
                        const docId =
                          doc && typeof doc === "object" && "id" in doc
                            ? String((doc as { id: unknown }).id)
                            : null;
                        setUploadedDocId(docId);
                      }}
                    />
                  </div>
                </div>
                <div className="mt-5 border-t pt-4">
                  <Textarea
                    className="min-h-24"
                    placeholder="Describe the correction made and any clarification for the officer…"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                  />
                  <div className="mt-3 flex justify-end">
                    <Button
                      disabled={!response.trim() || respondMutation.isPending}
                      onClick={() =>
                        respondMutation.mutate({
                          deficiencyId: d.id,
                          data: {
                            response: response.trim(),
                            supporting_documents: uploadedDocId
                              ? { document_ids: [uploadedDocId] }
                              : {},
                          },
                        })
                      }
                    >
                      {respondMutation.isPending ? "Submitting…" : "Submit response"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Button asChild variant="ghost" className="text-muted-foreground">
          <Link to="/portal/applications/$id" params={{ id: app.id }}>
            <ArrowRight className="size-4 rotate-180" aria-hidden /> Back to application
          </Link>
        </Button>
      </div>
    </div>
  );
}
