import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  PageHeader,
  StatusBadge,
  Field,
  StageTimeline,
  Priority,
  AiFlag,
  AiReviewWorkspace,
} from "@/components/mota/bits";
import { useApplicationQuery, useApplicationTimelineQuery } from "@/hooks/api/useApplications";
import { useDocumentsQuery } from "@/hooks/api/useDocuments";
import { useApplicationNotesQuery, useCreateApplicationNoteMutation } from "@/hooks/api/useNotes";
import { useMutation } from "@tanstack/react-query";
import { returnApplication } from "@/api/applications";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

type OfficerApplication = {
  id: string;
  scheme: string;
  applicant: string;
  state: string;
  stage: string;
  score: string | number;
  priority: "Medium" | "High" | "Low";
  sla: number;
};
type OfficerDocument = {
  id: string;
  name: string;
  file: string;
  size: string;
  status: string;
};

export const Route = createFileRoute("/officer/applications/$id")({
  head: () => ({
    meta: [{ title: "Application | Officer Workspace" }],
  }),
  component: OfficerApplicationDetail,
});

const REVIEW_TABS = ["Eligibility", "Documents", "AI", "Notes", "Audit trail"];

function OfficerApplicationDetail() {
  const { id } = Route.useParams();
  const applicationQuery = useApplicationQuery(id);
  const timelineQuery = useApplicationTimelineQuery(id);
  const documentsQuery = useDocumentsQuery({ application_id: id });
  const notesQuery = useApplicationNotesQuery(id);
  const createNoteMutation = useCreateApplicationNoteMutation();

  const app = applicationQuery.data as OfficerApplication | undefined;
  const documents: OfficerDocument[] = (documentsQuery.data ?? []).map((document) => ({
    id: document.id,
    name: document.filename,
    file: document.filename,
    size: typeof document["size"] === "string" ? document["size"] : "",
    status: document.status,
  }));
  const applicationAudit = (timelineQuery.data ?? []).map((event) => ({
    action: event.status,
    detail: event.note,
    by: event.actor,
    at: event.timestamp,
  }));
  const navigate = useNavigate();
  const [tab, setTab] = useState("Eligibility");
  const [note, setNote] = useState("");

  const rawNotes =
    (
      notesQuery.data as {
        data?: Array<{
          id: string;
          author_id?: string;
          note: string;
          internal?: boolean;
          created_at?: string;
        }>;
      }
    )?.data ||
    (Array.isArray(notesQuery.data) ? notesQuery.data : []) ||
    [];
  const notesList: Array<{
    id: string;
    author_id?: string;
    note: string;
    internal?: boolean;
    created_at?: string;
  }> = Array.isArray(rawNotes)
    ? (rawNotes as Array<{
        id: string;
        author_id?: string;
        note: string;
        internal?: boolean;
        created_at?: string;
      }>)
    : [];

  const handleCreateNote = async () => {
    if (!note.trim()) return;
    try {
      await createNoteMutation.mutateAsync({
        applicationId: id,
        data: { note: note.trim(), internal: true },
      });
      setNote("");
      toast.success("Note added");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to add note";
      toast.error(errorMsg);
    }
  };

  const sendBackMutation = useMutation({
    mutationFn: (reason: string) => returnApplication(id, { reason }),
  });

  if (applicationQuery.isLoading || timelineQuery.isLoading || documentsQuery.isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading application…</p>;
  if (applicationQuery.isError || timelineQuery.isError || documentsQuery.isError)
    return <p className="py-8 text-sm text-destructive">We could not load this application.</p>;
  if (!app)
    return <p className="py-8 text-sm text-muted-foreground">This application was not found.</p>;

  return (
    <div>
      <PageHeader
        title={app.id}
        desc={`${app.scheme} · ${app.applicant} · ${app.state}`}
        action={<StatusBadge status={app.stage === "Documents" ? "Scrutiny" : app.stage} />}
      />

      <Card className="mb-6 border-primary/25 bg-accent/40 shadow-card">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Recommended score</p>
              <p className="mt-1 font-display text-3xl text-primary">{app.score} / 100</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Auto-computed from scoring model 2026 · not yet reviewed by AI
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Priority level={app.priority} />
              <Badge variant="outline" className="text-foreground">
                Deadline {app.sla >= 0 ? `${app.sla} days` : "overdue"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="text-destructive" disabled>
                <AlertTriangle className="size-4" aria-hidden /> Raise deficiency unavailable
              </Button>
              <Button disabled>
                <ShieldCheck className="size-4" aria-hidden /> Verify & forward unavailable
              </Button>
              <Button
                variant="outline"
                className="text-amber-600"
                disabled={sendBackMutation.isPending}
                onClick={() =>
                  sendBackMutation.mutate("Returned for officer reconsideration", {
                    onSuccess: () => toast.success(`Application ${id} sent back`),
                    onError: () => toast.error(`Could not send back application ${id}`),
                  })
                }
              >
                <RotateCcw className="size-4" aria-hidden />
                {sendBackMutation.isPending ? "Sending back…" : "Send back"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-5 sm:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4 text-primary" aria-hidden /> Applicant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Name" value={app.applicant} />
              <Field label="Scheme" value={app.scheme} />
              <Field label="Stage" value={app.stage} />
              <Field label="State" value={app.state} />
            </dl>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <StageTimeline
              current={app.stage === "Documents" ? 1 : app.stage === "Institution" ? 2 : 3}
              compact
            />
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">AI confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <AiFlag text="AI review not yet available — manual verification in progress." />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-0">
          <div className="flex flex-wrap gap-2">
            {REVIEW_TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                  tab === t
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {tab === "Eligibility" ? (
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <p className="eyebrow">Eligibility checklist</p>
                <ul className="mt-4 space-y-3">
                  {[
                    ["Tribal community certificate on file", true, "Valid and legible"],
                    ["Class / marks criterion met", true, "60% and above"],
                    ["Income ceiling within limit", true, "Applies to this scheme"],
                    ["No overlapping scholarship", true, "Single active award"],
                    ["Institution approved", true, "UGC / AICTE recognised"],
                    ["Course within scheme scope", false, "Course listed under scheme"],
                  ].map(([label, ok, hint], i) => {
                    const state = Boolean(ok);
                    return (
                      <li
                        key={i}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-sm ${state ? "border-leaf/30 bg-leaf/5" : "border-destructive/30 bg-destructive/5"}`}
                      >
                        <span className="flex items-center gap-2 font-medium">
                          {state ? (
                            <CheckCircle2 className="size-4 text-leaf" aria-hidden />
                          ) : (
                            <ShieldAlert className="size-4 text-destructive" aria-hidden />
                          )}
                          {label as string}
                        </span>
                        <span className="text-xs text-muted-foreground">{hint as string}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="space-y-5">
                <div className="rounded-xl border bg-accent/40 p-5">
                  <p className="eyebrow">Scoring (auto-computed)</p>
                  <p className="mt-2 font-display text-2xl text-primary">{app.score}/100</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scoring parameters are fixed by the published scheme and cannot be edited here.
                  </p>
                </div>
                <div className="rounded-xl border border-dashed p-5 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Manual review state</p>
                  <p className="mt-2">
                    This application is being reviewed manually by a scrutiny officer. Summary,
                    flags and confidence are computed by the automated stack where available;
                    anything not yet computed shows the default "not yet available" state above.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "Documents" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground md:col-span-2">
                  No documents are available for this application.
                </p>
              ) : null}
              {documents.map((d) => (
                <div
                  key={d.name}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-card"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.file ?? "No file yet"} {d.size ? `· ${d.size}` : ""}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
              <div className="rounded-xl border border-dashed p-4 md:col-span-2">
                <p className="text-sm font-medium">Raise a deficiency</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select the reason, and the applicant gets a bounded window to respond.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="text-destructive" disabled>
                    Caste certificate unavailable
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" disabled>
                    Bank mismatch unavailable
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" disabled>
                    Marksheet deficiency unavailable
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "AI" ? <AiReviewWorkspace /> : null}

          {tab === "Notes" ? (
            <div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Textarea
                  className="min-h-20 flex-1"
                  placeholder="Add a review note visible to the officer team…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button
                  className="self-end sm:self-auto"
                  disabled={!note.trim() || createNoteMutation.isPending}
                  onClick={handleCreateNote}
                >
                  <Plus className="mr-1.5 size-4" aria-hidden />
                  {createNoteMutation.isPending ? "Posting…" : "Add note"}
                </Button>
              </div>

              <ul className="mt-5 space-y-4">
                {notesList.length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    No review notes have been added.
                  </li>
                ) : null}
                {notesList.map((n) => (
                  <li key={n.id} className="rounded-xl border p-4 bg-card shadow-card">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Send className="size-3.5 text-primary" aria-hidden />{" "}
                        {n.author_id || "Officer"}
                        {n.internal ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Internal
                          </Badge>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                      {n.note}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tab === "Audit trail" ? (
            <ul className="space-y-4">
              {applicationAudit.length === 0 ? (
                <li className="text-sm text-muted-foreground">No audit events are available.</li>
              ) : null}
              {applicationAudit.map((a, i) => (
                <li key={i} className="relative border-l border-dashed pl-5">
                  <span
                    className="absolute -left-1 top-1.5 size-2 rounded-full bg-primary"
                    aria-hidden
                  />
                  <p className="text-sm font-medium">{a.action}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    {a.by} · {a.at}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-6">
        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => navigate({ to: "/officer/queue" })}
        >
          <ArrowRight className="size-4 rotate-180" aria-hidden /> Back to work queue
        </Button>
      </div>
    </div>
  );
}
