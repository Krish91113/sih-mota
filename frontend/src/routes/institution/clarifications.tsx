import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, StatusBadge } from "@/components/mota/bits";
import { useAddGrievanceMessageMutation, useGrievancesQuery } from "@/hooks/api/useGrievances";

type Row = Record<string, unknown>;
import { useState } from "react";
import { AlertTriangle, CheckCircle2, MessageSquareText, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/institution/clarifications")({
  head: () => ({
    meta: [{ title: "Clarifications | Institution Portal" }],
  }),
  component: InstitutionClarifications,
});

function InstitutionClarifications() {
  const { data: institutionClarifications = [], isLoading, isError } = useGrievancesQuery();
  const [responded, setResponded] = useState<Record<string, string>>({});
  const addMessageMutation = useAddGrievanceMessageMutation();
  const open = institutionClarifications.filter((c) => c.status === "Awaiting response");

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading clarifications…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load clarifications.</p>;
  return (
    <div>
      <PageHeader
        title="Clarifications desk"
        desc="Questions that need an answer from your institution to continue the application."
      />

      {open.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          <MessageSquareText className="mx-auto mb-2 size-6 text-muted-foreground/50" aria-hidden />
          Nothing awaiting your response right now.
        </p>
      ) : (
        <div className="space-y-4">
          {open.map((c) => (
            <Card key={c.id} className="shadow-card">
              <CardHeader className="flex-row items-center justify-between gap-3 border-b border-dashed pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-amber-500" aria-hidden /> {c.subject}
                </CardTitle>
                <StatusBadge status={c.status} />
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.id}</span>
                  <span>{c.application}</span>
                  <span>Requested by {c.from}</span>
                  <span>On {c.on}</span>
                </div>
                <div className="mt-4">
                  <Textarea
                    className="min-h-24"
                    placeholder={`Reply for ${c.id}…`}
                    value={responded[c.id] ?? ""}
                    onChange={(e) => setResponded((r) => ({ ...r, [c.id]: e.target.value }))}
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    disabled={!responded[c.id]?.trim() || addMessageMutation.isPending}
                    onClick={() => {
                      const message = responded[c.id]?.trim();
                      if (!message) return;
                      addMessageMutation.mutate(
                        { id: c.id, data: { message } },
                        {
                          onSuccess: () => {
                            setResponded((r) => ({ ...r, [c.id]: "" }));
                            toast.success(`Reply submitted for ${c.id}`);
                          },
                          onError: () => toast.error(`Could not submit reply for ${c.id}`),
                        },
                      );
                    }}
                  >
                    <Send className="size-4" aria-hidden />
                    {addMessageMutation.isPending ? "Sending…" : "Send response"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="size-4 text-leaf" aria-hidden /> Resolved history
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Ref</th>
                <th className="px-5 py-3 font-semibold">Subject</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {institutionClarifications
                .filter((c) => c.status === "Resolved")
                .map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-5 py-3 font-semibold">{c.id}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.subject}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status="Resolved" />
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
