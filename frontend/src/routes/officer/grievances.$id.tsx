import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge, Priority } from "@/components/mota/bits";
import { useTransitionGrievanceMutation } from "@/hooks/api/useGrievances";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Send, UserRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/officer/grievances/$id")({
  loader: ({ params }) => {
    const g = {
      id: params.id,
      subject: "Grievance case",
      category: "General",
      application: "—",
      scheme: "—",
      raised: "—",
      status: "Under Review",
      priority: "Medium",
      sla: "7 working days",
      due: "—",
      response: "Case is being reviewed.",
      messages: [{ from: "Applicant", text: "Details of the case pending.", at: "—", mine: true }],
    };
    return g;
  },
  component: OfficerGrievanceDetail,
});

const STATUS_OPTIONS = ["Assign to officer", "Under Review", "Escalated L2", "Resolved"];

function OfficerGrievanceDetail() {
  const g = Route.useLoaderData();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>(g.status);
  const [messages] = useState(g.messages);
  const transitionMutation = useTransitionGrievanceMutation();

  const updateStatus = () => {
    transitionMutation.mutate(
      { id: g.id, data: { status } },
      {
        onSuccess: () =>
          toast.success(
            status === "Resolved" ? `Grievance ${g.id} resolved` : `Status updated to "${status}"`,
          ),
        onError: () => toast.error(`Could not update grievance ${g.id}`),
      },
    );
  };

  return (
    <div>
      <PageHeader
        title={g.id}
        desc={`${g.category} · ${g.application}`}
        action={<StatusBadge status={g.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Priority level={g.priority as "High" | "Medium" | "Low"} />
                <span className="text-xs text-muted-foreground">
                  SLA {g.sla} · due {g.due}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-semibold">{g.subject}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Raised {g.raised} · scheme {g.scheme}
              </p>
              <div className="mt-4 rounded-xl border bg-accent/40 p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Latest response
                </p>
                <p className="mt-2">{g.response || "No response recorded yet."}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Case thread</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl border p-4 ${m.mine ? "bg-accent/60" : "bg-card shadow-card"}`}
                  >
                    <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <UserRound className="size-3.5" aria-hidden /> {m.from}
                    </p>
                    <p className="mt-1 text-sm">{m.text}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{m.at}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Case actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${status === s ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                onClick={updateStatus}
                disabled={transitionMutation.isPending}
              >
                {status === "Resolved" ? (
                  <CheckCircle2 className="size-4" aria-hidden />
                ) : (
                  <Send className="size-4" aria-hidden />
                )}
                {transitionMutation.isPending
                  ? "Applying…"
                  : `Apply ${status === "Resolved" ? "resolution" : "status"}`}
              </Button>
              {status === "Resolved" ? (
                <p className="text-xs text-muted-foreground">
                  Resolving closes the case; the applicant receives your response by email and SMS.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Escalating moves it to the designated level as configured for this category.
                </p>
              )}
            </CardContent>
          </Card>

          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => navigate({ to: "/officer/grievances" })}
          >
            <ArrowRight className="size-4 rotate-180" aria-hidden /> Back to grievances
          </Button>
        </aside>
      </div>
    </div>
  );
}
