import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, StatusBadge, Field } from "@/components/mota/bits";
import {
  DynamicFormRenderer,
  type FormValues,
  isDefined,
} from "@/components/mota/DynamicFormRenderer";
import { Stepper, StepNav } from "@/components/mota/Stepper";
import { useSchemesQuery, useFormDefinitionQuery } from "@/hooks/api/useSchemes";
import { useCreateApplicationMutation } from "@/hooks/api/useApplications";
import { useCurrentUserQuery, useApplicantProfileQuery } from "@/hooks/api/useAuth";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  FileText,
  GraduationCap,
  Info,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/applications/new")({
  head: () => ({
    meta: [{ title: "New Application | Applicant Portal" }],
  }),
  component: NewApplication,
});

const STEP_TITLES = ["Choose scheme", "Fill application", "Review & submit"];

function NewApplication() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [schemeId, setSchemeId] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [submittedAppNumber, setSubmittedAppNumber] = useState<string | null>(null);

  const userQuery = useCurrentUserQuery();
  const profileQuery = useApplicantProfileQuery();
  const createMutation = useCreateApplicationMutation();

  const user = userQuery.data;
  const profile = profileQuery.data?.profile;

  const schemesQuery = useSchemesQuery();
  const schemes = schemesQuery.data ?? [];
  const schemeOptions = schemes.map((s) => ({
    ...s,
    type: String(s.type ?? "Scholarship"),
    open: Boolean(s.open ?? s.active),
    level: String(s.level ?? "Higher education"),
    deadline: String(s.deadline ?? "To be announced"),
  }));
  const scheme = schemeOptions.find((s) => s.id === schemeId);
  const formQuery = useFormDefinitionQuery(String(scheme?.scheme_version_id ?? ""));
  const formDefinition = (formQuery.data ?? { sections: [], fields: [] }) as Record<
    string,
    unknown
  >;

  const handleFormSubmit = (v: FormValues) => {
    setValues(v);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFinalSubmit = async () => {
    if (!scheme) return;
    if (!scheme.scheme_version_id) {
      toast.error("This scheme does not have an active published configuration.");
      return;
    }

    try {
      const res = await createMutation.mutateAsync({
        scheme_id: scheme.id,
        scheme_version_id: String(scheme.scheme_version_id),
        cycle: "2026-2027",
        answers: (values as Record<string, unknown>) || {},
      });

      const appNum = (res as any)?.application_number || (res as any)?.id || "APP-2026";
      const appId = (res as any)?.id || appNum;
      setSubmittedId(appId);
      setSubmittedAppNumber(appNum);
      toast.success("Application created successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit application");
    }
  };

  if (submittedId) {
    return (
      <div>
        <Card className="mx-auto max-w-2xl border-leaf/30 shadow-lift">
          <CardContent className="flex flex-col items-center p-10 text-center">
            <span className="rounded-full bg-leaf/10 p-4 text-leaf">
              <CheckCircle2 className="size-12" aria-hidden />
            </span>
            <p className="eyebrow mt-6">Application Submitted</p>
            <h1 className="mt-2 text-3xl">Your application was created</h1>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Application number{" "}
              <span className="font-semibold text-foreground">{submittedAppNumber || submittedId}</span>.
              You can now upload your marksheets & certificates, and track your verification timeline.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button
                onClick={() =>
                  navigate({
                    to: "/portal/applications/$id/documents",
                    params: { id: submittedId },
                  })
                }
              >
                <Upload className="size-4 mr-1" aria-hidden /> Upload Documents
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  navigate({
                    to: "/portal/applications/$id",
                    params: { id: submittedId },
                  })
                }
              >
                View Timeline <ArrowRight className="size-4 ml-1" aria-hidden />
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/portal/applications">All Applications</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New Application"
        desc="Your persistent profile details are prefilled. Complete scheme-specific requirements and submit."
      />

      <Stepper steps={STEP_TITLES} current={step} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          {step === 0 ? (
            <section aria-label="Choose a scheme" className="space-y-4">
              <h2 className="text-lg font-medium">Which scheme are you applying to?</h2>
              {schemeOptions.map((s) => {
                const detail = schemes.find((x) => x.id === s.id);
                const selected = schemeId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSchemeId(s.id)}
                    disabled={!s.open}
                    className={`w-full rounded-xl border bg-card p-5 text-left shadow-card transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex size-5 items-center justify-center rounded-full border-2 ${selected ? "border-primary bg-primary" : "border-border"}`}
                          aria-hidden
                        >
                          {selected ? (
                            <CheckCircle2 className="size-3.5 text-primary-foreground" />
                          ) : null}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                              {s.code} · {s.type}
                            </span>
                            <span className="text-xs font-medium text-leaf">
                              {s.open ? "Open" : "Closed"}
                            </span>
                          </div>
                          <h3 className="mt-2 text-base font-semibold">{s.name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{detail?.summary || detail?.description}</p>
                        </div>
                      </div>
                    </div>
                    <dl className="mt-4 grid gap-3 border-t pt-4 text-xs sm:grid-cols-3">
                      <div>
                        <dt className="text-muted-foreground">Level</dt>
                        <dd className="mt-0.5 font-medium">{s.level}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Award</dt>
                        <dd className="mt-0.5 font-medium">{detail?.amount || "As per norms"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Last date</dt>
                        <dd className="mt-0.5 font-medium">{s.deadline}</dd>
                      </div>
                    </dl>
                  </button>
                );
              })}
              <StepNav
                onNext={() => {
                  if (schemeId) setStep(1);
                }}
                nextLabel={schemeId ? "Continue to form" : "Select a scheme first"}
                canNext={!!schemeId}
              />
            </section>
          ) : null}

          {step === 1 && scheme ? (
            <DynamicFormRenderer
              definition={formDefinition}
              defaults={{
                fullName: profileQuery.data?.full_name || user?.full_name || "Applicant",
                dob: (profile?.personal as any)?.dob || "1999-03-14",
                gender: (profile?.personal as any)?.gender?.toLowerCase() || "female",
                tribe: (profile?.st as any)?.tribe?.toLowerCase() || "oraon",
                mobile: (profile?.contact as any)?.mobile || "9876543210",
                email: user?.email || "",
                pursuingPhd: "true",
              }}
              onSubmit={handleFormSubmit}
              submitLabel="Continue to review"
              onCancel={() => setStep(0)}
            />
          ) : null}

          {step === 2 && values ? (
            <section aria-label="Review and submit" className="space-y-5">
              <div className="rounded-xl border border-leaf/30 bg-leaf/5 p-4 text-sm">
                <p className="flex items-center gap-2 font-medium text-leaf">
                  <BadgeCheck className="size-4" aria-hidden /> All required fields are complete
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Review the summary before submitting. After submission your application is saved to your account.
                </p>
              </div>

              {formDefinition.sections && Array.isArray(formDefinition.sections) && formDefinition.sections.length > 0 ? (
                (formDefinition.sections as any[]).map((section, si) => {
                  const filled = (section.fields || []).filter(
                    (f: any) => !f.when || (values[f.when.field] as string) === f.when.equals,
                  );
                  return (
                    <Card key={section.id || si} className="shadow-card">
                      <CardContent className="p-6">
                        <p className="eyebrow">Section {si + 1}</p>
                        <h3 className="mt-1 text-lg">{section.title}</h3>
                        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {filled.map((f: any) => (
                            <Field
                              key={f.id}
                              label={f.label}
                              value={
                                Array.isArray(values[f.id])
                                  ? (values[f.id] as string[]).join(", ")
                                  : String(values[f.id] ?? "—")
                              }
                            />
                          ))}
                        </dl>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="shadow-card">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold">Application Summary</h3>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      {Object.entries(values).map(([k, v]) => (
                        <Field key={k} label={k} value={Array.isArray(v) ? v.join(", ") : String(v ?? "—")} />
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              )}

              <div className="rounded-xl border border-primary/20 bg-accent/30 p-4 text-xs">
                <p className="flex items-center gap-2 font-medium text-primary">
                  <Info className="size-4" aria-hidden /> Verification Process
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                  <li>Your submitted application will be routed to your institution for enrolment verification.</li>
                  <li>You can upload supporting marksheets, income certificate, and caste proof on the next step.</li>
                </ul>
              </div>

              <StepNav
                onPrev={() => setStep(1)}
                onNext={handleFinalSubmit}
                nextLabel={createMutation.isPending ? "Creating Application..." : "Submit application"}
                canNext={!createMutation.isPending}
              />
            </section>
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {scheme ? (
            <Card className="border-primary/25 bg-accent/40 shadow-card">
              <CardContent className="p-5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <GraduationCap className="size-4 text-primary" aria-hidden /> {scheme.code} ·{" "}
                  {scheme.name}
                </p>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Level</dt>
                    <dd className="font-medium">{scheme.level}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Last date</dt>
                    <dd className="flex items-center gap-1 font-medium">
                      <CalendarClock className="size-3.5 text-primary" aria-hidden />{" "}
                      {scheme.deadline}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ) : null}

          <Card className="shadow-card">
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4 text-primary" aria-hidden /> Documents to keep ready
              </p>
              <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
                {[
                  "Caste / Tribe certificate",
                  "Admission or enrolment proof",
                  "Latest marksheet / transcript",
                  "Income certificate, where applicable",
                  "Bank passbook first page",
                ].map((d) => (
                  <li key={d} className="flex gap-2">
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                      aria-hidden
                    />
                    {d}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
