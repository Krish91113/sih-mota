import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, StatusBadge, Priority, Field, AiFlag } from "@/components/mota/bits";
import {
  useApplicationQuery,
  useApplicationTimelineQuery,
  useApprovalPacketQuery,
  useApproveApplicationMutation,
  useRejectApplicationMutation,
  useHoldApprovalMutation,
  useReturnApplicationMutation,
} from "@/hooks/api/useApplications";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  PauseCircle,
  RotateCcw,
  ShieldAlert,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type ApprovalApplication = {
  id: string;
  scheme?: string;
  applicant?: string;
  score?: string | number;
  amount?: string | number;
  due?: string;
  scrutiny?: string;
  committee?: string;
  institution?: string;
};
type ApprovalNote = { by?: string; at?: string; text?: string };

export const Route = createFileRoute("/approval/applications/$id")({
  head: () => ({
    meta: [{ title: "Application | Sanctioning Authority" }],
  }),
  component: ApprovalDetail,
});

function DecisionButton({
  label,
  icon,
  variant,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  variant: "default" | "destructive" | "outline";
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button variant={variant} className="w-full" onClick={onClick} disabled={disabled}>
      {icon} {label}
    </Button>
  );
}

function ApprovalDetail() {
  const { id } = Route.useParams();
  const applicationQuery = useApplicationQuery(id);
  const timelineQuery = useApplicationTimelineQuery(id);
  const packetQuery = useApprovalPacketQuery(id);
  const navigate = useNavigate();
  const a = applicationQuery.data as ApprovalApplication | undefined;
  const packet = packetQuery.data as { notes?: ApprovalNote[] } | undefined;
  const officerNotes = packet?.notes ?? [];
  const applicationAudit = (timelineQuery.data ?? []).map((event) => ({
    action: event.status,
    detail: event.note,
    by: event.actor,
    at: event.timestamp,
  }));
  const [decision, setDecision] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const approveMutation = useApproveApplicationMutation();
  const rejectMutation = useRejectApplicationMutation();
  const returnMutation = useReturnApplicationMutation();
  const holdMutation = useHoldApprovalMutation();

  const decisionPending =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    returnMutation.isPending ||
    holdMutation.isPending;

  if (applicationQuery.isLoading || timelineQuery.isLoading || packetQuery.isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading application…</p>;
  if (applicationQuery.isError || timelineQuery.isError || packetQuery.isError)
    return <p className="py-8 text-sm text-destructive">We could not load this application.</p>;
  if (!a)
    return <p className="py-8 text-sm text-muted-foreground">This application was not found.</p>;

  const confirm = (d: string) => {
    if (d !== "Approved" && !reason.trim()) {
      toast.error("A reason is required to hold, return, or reject an application");
      return;
    }
    const data = reason.trim() ? { reason: reason.trim() } : {};
    const mutation =
      d === "Approved"
        ? approveMutation.mutateAsync({ id: a.id, data })
        : d === "Held"
          ? holdMutation.mutateAsync({ id: a.id, data })
          : d === "Returned"
            ? returnMutation.mutateAsync({ id: a.id, data: data ?? {} })
            : rejectMutation.mutateAsync({ id: a.id, data });

    mutation
      .then(() => {
        setDecision(d);
        toast.success(
          d === "Approved"
            ? `Sanction approved for ${a.id}`
            : d === "Held"
              ? `Application ${a.id} put on hold`
              : d === "Returned"
                ? `Application ${a.id} returned to committee`
                : `Application ${a.id} rejected`,
        );
      })
      .catch((err: unknown) => {
        const errorMsg =
          err instanceof Error ? err.message : `Could not ${d.toLowerCase()} application ${a.id}`;
        toast.error(errorMsg);
      });
  };

  const clearance = (label: string, ok: boolean) => (
    <div className="flex items-center justify-between gap-3 rounded-xl border p-4 text-sm">
      <span className="font-medium">{label}</span>
      {ok ? (
        <span className="flex items-center gap-1.5 font-semibold text-leaf">
          <CheckCircle2 className="size-4" aria-hidden /> Cleared
        </span>
      ) : (
        <StatusBadge status="Pending" />
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title={a.id}
        desc={`${a.scheme} · ${a.applicant} · recommended score ${a.score}`}
        action={<StatusBadge status={decision ?? "Awaiting decision"} />}
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4 text-primary" aria-hidden /> Candidate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Name" value={a.applicant} />
              <Field label="Scheme" value={a.scheme} />
              <Field label="Amount" value={a.amount} />
              <Field label="Due" value={a.due} />
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sanction amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl text-primary">{a.amount}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Full-cycle entitlement as admissible for {a.scheme} for the 2026-27 session.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">AI assistant</CardTitle>
          </CardHeader>
          <CardContent>
            <AiFlag text="AI review not yet available — manual verification in progress." />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Clearance package</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {clearance("Scrutiny review", a.scrutiny === "Cleared")}
            {clearance("Committee recommendation", a.committee === "Recommended")}
            {clearance("Institution verification", a.institution === "Verified")}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Officer notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {officerNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No officer notes are available.</p>
            ) : null}
            {officerNotes.map((n, i) => (
              <div key={i} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{n.by}</span>
                  <span className="text-xs text-muted-foreground">{n.at}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{n.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Audit trail</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ul className="space-y-4">
              {applicationAudit.length === 0 ? (
                <li className="text-sm text-muted-foreground">No audit events are available.</li>
              ) : null}
              {applicationAudit.map((e, i) => (
                <li key={i} className="relative border-l border-dashed pl-5">
                  <span
                    className="absolute -left-1 top-1.5 size-2 rounded-full bg-primary"
                    aria-hidden
                  />
                  <p className="text-sm font-medium">{e.action}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    {e.by} · {e.at}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="size-4 text-primary" aria-hidden /> Decision
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <Textarea
                className="min-h-20"
                placeholder="Reason for decision (required for return / reject)…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <DecisionButton
                label="Approve sanction"
                variant="default"
                icon={<BadgeCheck className="size-4" aria-hidden />}
                onClick={() => confirm("Approved")}
                disabled={decisionPending}
              />
              <DecisionButton
                label="Hold approval"
                variant="outline"
                icon={<PauseCircle className="size-4" aria-hidden />}
                onClick={() => confirm("Held")}
                disabled={decisionPending}
              />
              <DecisionButton
                label="Return to committee"
                variant="outline"
                icon={<RotateCcw className="size-4" aria-hidden />}
                onClick={() => confirm("Returned")}
                disabled={decisionPending}
              />
              <DecisionButton
                label="Reject"
                variant="destructive"
                icon={<XCircle className="size-4" aria-hidden />}
                onClick={() => confirm("Rejected")}
                disabled={decisionPending}
              />
              {decision === "Returned" || decision === "Rejected" || decision === "Held" ? (
                <p className="rounded-lg bg-amber-500/10 p-3 text-center text-xs font-medium text-amber-700">
                  {decision === "Rejected"
                    ? "Rejection ends the application lifecycle for this candidate."
                    : decision === "Held"
                      ? "Application is put on hold awaiting further clarification."
                      : "Returning sends it back to the selection committee."}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => navigate({ to: "/approval/queue" })}
          >
            <ArrowRight className="size-4 rotate-180" aria-hidden /> Back to approval queue
          </Button>
        </aside>
      </div>
    </div>
  );
}
