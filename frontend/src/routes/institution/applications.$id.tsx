import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PageHeader,
  StatusBadge,
  Field,
  StageTimeline,
  AiSummaryCard,
} from "@/components/mota/bits";
import { useApplicationQuery, useApplicationTimelineQuery } from "@/hooks/api/useApplications";
import { useVerifyInstitutionApplicationMutation } from "@/hooks/api/useInstitutions";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  RotateCcw,
  ShieldQuestion,
  UserRound,
} from "lucide-react";

type InstitutionApplication = {
  id: string;
  scheme: string;
  course: string;
  assigned: string;
  status: string;
  applicant: string;
  regNo: string;
  state: string;
  tribe?: string;
  program: string;
};

export const Route = createFileRoute("/institution/applications/$id")({
  component: InstitutionApplicationDetail,
});

const VERIFICATION_STEPS = ["Admission", "Enrollment", "Programme", "Research"];

function InstitutionApplicationDetail() {
  const { id } = Route.useParams();
  const applicationQuery = useApplicationQuery(id);
  const timelineQuery = useApplicationTimelineQuery(id);
  const app = applicationQuery.data as InstitutionApplication | undefined;
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [marks, setMarks] = useState<Record<string, "Verified" | "Discrepancy" | "Pending">>({
    Admission: "Verified",
    Enrollment: "Pending",
    Programme: "Pending",
    Research: "Pending",
  });
  const verifyMutation = useVerifyInstitutionApplicationMutation();

  if (applicationQuery.isLoading || timelineQuery.isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading application…</p>;
  if (applicationQuery.isError || timelineQuery.isError)
    return <p className="py-8 text-sm text-destructive">We could not load this application.</p>;
  if (!app)
    return <p className="py-8 text-sm text-muted-foreground">This application was not found.</p>;
  const stepName = VERIFICATION_STEPS[activeStep] ?? "Admission";
  const currentStage = timelineQuery.data?.length ?? 1;
  const submitVerification = (result: "VERIFIED" | "DISCREPANCY") => {
    verifyMutation.mutate(
      {
        applicationId: id,
        data: { result, fields: { step: stepName } },
      },
      {
        onSuccess: () => {
          setMarks((current) => ({
            ...current,
            [stepName]: result === "VERIFIED" ? "Verified" : "Discrepancy",
          }));
        },
      },
    );
  };

  return (
    <div>
      <PageHeader
        title={app.id}
        desc={`${app.scheme} · ${app.course} · assigned ${app.assigned}`}
        action={<StatusBadge status={app.status} />}
      />

      <Card className="mb-6 border-primary/25 bg-accent/40 shadow-card">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Applicant</p>
              <p className="mt-1 font-display text-2xl text-primary">{app.applicant}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Reg no. {app.regNo} · {app.state}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/institution/applications" })}
              >
                <ArrowRight className="size-4 rotate-180" aria-hidden /> Back to list
              </Button>
              <Button disabled>
                <BadgeCheck className="size-4" aria-hidden /> Verification unavailable
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-5 sm:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4 text-primary" aria-hidden /> Applicant snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Caste / tribe" value={app.tribe ?? app.applicant ?? "—"} />
              <Field label="Course of study" value={app.course} />
              <Field label="Programme level" value={app.program} />
              <Field label="Institution state" value={app.state} />
            </dl>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <StageTimeline current={currentStage} />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="border-b border-dashed pb-3">
          <CardTitle className="text-base">Verification workspace</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-6 flex flex-wrap gap-2">
            {VERIFICATION_STEPS.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setActiveStep(i)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  i === activeStep
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {marks[s] === "Verified" ? (
                  <CheckCircle2 className="size-3.5 text-leaf" aria-hidden />
                ) : marks[s] === "Discrepancy" ? (
                  <AlertTriangle className="size-3.5 text-amber-500" aria-hidden />
                ) : (
                  <Clock className="size-3.5" aria-hidden />
                )}
                {s}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                {activeStep === 3 ? (
                  <GraduationCap className="size-4 text-primary" aria-hidden />
                ) : (
                  <BookOpen className="size-4 text-primary" aria-hidden />
                )}
                {stepName} verification
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {stepName === "Research"
                  ? "Confirm the research supervisor, department and the declared research topic are correct."
                  : stepName === "Programme"
                    ? "Ensure the declared course and programme level match your admission records."
                    : stepName === "Enrollment"
                      ? "Verify the applicant is currently enrolled with your institution for 2026-27 with a valid enrolment number."
                      : "Confirm that the admission letter provisionally accepted for the declared academic session."}
              </p>

              <div className="mt-4 space-y-3 rounded-xl border bg-muted/40 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{stepName} status</span>
                  <span className="font-medium">{app.status}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Multiple application?</span>
                  <span className="font-medium">No, single active</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Fee record match</span>
                  <span className="font-medium text-leaf">Matches declared</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  disabled={verifyMutation.isPending}
                  onClick={() => submitVerification("VERIFIED")}
                >
                  <CheckCircle2 className="size-4" aria-hidden />
                  {verifyMutation.isPending ? "Saving…" : `Mark ${stepName.toLowerCase()} verified`}
                </Button>
                <Button
                  variant="outline"
                  className="text-amber-600"
                  disabled={verifyMutation.isPending}
                  onClick={() => submitVerification("DISCREPANCY")}
                >
                  <ShieldQuestion className="size-4" aria-hidden /> Flag discrepancy
                </Button>
              </div>
              {verifyMutation.isError ? (
                <p className="mt-3 text-xs text-destructive">
                  The verification could not be saved. Please retry.
                </p>
              ) : null}

              {marks[stepName] === "Discrepancy" ? (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                  <p className="font-medium text-amber-700">Discrepancy recorded</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A clarification request will be sent to the scrutiny officer. The application is
                    paused until resolved.
                  </p>
                  <Button variant="ghost" size="sm" className="mt-2 text-amber-700" disabled>
                    <RotateCcw className="size-3.5" aria-hidden /> Undo
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-4 text-sm shadow-card">
                <p className="font-medium">Steps done</p>
                <ul className="mt-2 space-y-2">
                  {VERIFICATION_STEPS.map((s) => (
                    <li key={s} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">{s}</span>
                      <Badge
                        variant={
                          marks[s] === "Verified"
                            ? "default"
                            : marks[s] === "Discrepancy"
                              ? "destructive"
                              : "outline"
                        }
                        className="gap-1"
                      >
                        {marks[s] === "Verified" ? (
                          <CheckCircle2 className="size-3" aria-hidden />
                        ) : null}
                        {marks[s]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>

              <AiSummaryCard title="Verification insights" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Button asChild variant="ghost" className="text-muted-foreground">
          <Link to="/institution/applications">
            <ArrowRight className="size-4 rotate-180" aria-hidden /> Back to assigned applications
          </Link>
        </Button>
      </div>
    </div>
  );
}
