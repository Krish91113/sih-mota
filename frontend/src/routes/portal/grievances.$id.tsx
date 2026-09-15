import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/mota/bits";
import { useGrievanceQuery } from "@/hooks/api/useGrievances";
import { useState } from "react";
import { ArrowRight, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/grievances/$id")({
  component: GrievanceDetail,
});

function GrievanceDetail() {
  const { id } = Route.useParams();
  const query = useGrievanceQuery(id);
  const g = query.data;
  const [reply, setReply] = useState("");
  if (query.isLoading)
    return <p className="py-12 text-sm text-muted-foreground">Loading grievance…</p>;
  if (query.isError || !g)
    return <p className="py-12 text-sm text-destructive">We could not load this grievance.</p>;
  const raised = g.created_at ? new Date(g.created_at).toLocaleDateString() : "—";
  const scheme = String(g.scheme_name ?? "—");

  const messages = [
    { role: "me", text: g.subject, at: `${raised}, 10:14 am` },
    {
      role: "grievance",
      text: `Reference ${g.id} received and assigned to the grievance cell.`,
      at: `${raised}, 3:40 pm`,
    },
    ...(g.response
      ? [{ role: "grievance" as const, text: g.response, at: "13 September 2026, 12:05 pm" }]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title={g.id}
        desc={g.subject}
        action={
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${g.status === "Resolved" ? "bg-leaf/10 text-leaf" : "bg-accent text-accent-foreground"}`}
          >
            {g.status}
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Conversation thread</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "me" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl border p-4 ${m.role === "me" ? "bg-accent/60" : "bg-card shadow-card"}`}
                >
                  <p className="text-sm">{m.text}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{m.at}</p>
                </div>
              </div>
            ))}

            {g.status !== "Resolved" ? (
              <div className="border-t pt-4">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="min-h-24"
                  placeholder="Add details or clarification for the grievance cell…"
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    disabled={!reply.trim()}
                    onClick={() => {
                      toast.success("Reply sent to grievance cell");
                      setReply("");
                    }}
                  >
                    <Send className="size-4" aria-hidden /> Send reply
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Case details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Scheme</span>
                <span className="font-medium">{scheme}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Raised on</span>
                <span className="font-medium">{raised}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">{g.status}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Assigned to</span>
                <span className="font-medium">Grievance Cell, MoTA</span>
              </div>
            </CardContent>
          </Card>

          <Button asChild variant="ghost" className="w-full justify-start text-muted-foreground">
            <Link to="/portal/grievances">
              <ArrowRight className="size-4 rotate-180" aria-hidden /> Back to grievances
            </Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
