import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout, UsefulLinks } from "@/components/mota/PublicLayout";
import { SectionHead } from "@/components/mota/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useSchemesQuery } from "@/hooks/api/useSchemes";
import { faqs as publicFaqs } from "@/content/publicContent";
import hero from "@/assets/hero-students.jpg";
import scholar from "@/assets/scholar.jpg";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  FileCheck2,
  FileText,
  GraduationCap,
  IdCard,
  Search,
  UserPlus,
  Landmark,
  ScrollText,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MoTA Scholarship & Fellowship Portal for Scheduled Tribes" },
      {
        name: "description",
        content:
          "Apply, track and manage Ministry of Tribal Affairs scholarships and fellowships for Scheduled Tribe students and research scholars.",
      },
      { property: "og:title", content: "MoTA Scholarship & Fellowship Portal" },
      {
        property: "og:description",
        content:
          "One portal for ST scholarships and fellowships — apply online, upload documents and track every stage of your application.",
      },
    ],
  }),
  component: Home,
});

const steps = [
  {
    icon: UserPlus,
    title: "Register",
    desc: "Create an account with your mobile number and email, then verify with a one-time password.",
  },
  {
    icon: IdCard,
    title: "Complete profile",
    desc: "Add personal, caste, academic, institution and bank details once — reused across every application.",
  },
  {
    icon: FileText,
    title: "Apply to a scheme",
    desc: "Fill the guided multi-step form, save drafts anytime and review before submission.",
  },
  {
    icon: FileCheck2,
    title: "Upload documents",
    desc: "Upload the checklist for your scheme. Replace any file if a deficiency is raised.",
  },
  {
    icon: Landmark,
    title: "Verification",
    desc: "Your institution confirms enrolment and Ministry officers scrutinise the application.",
  },
  {
    icon: BadgeCheck,
    title: "Selection & award",
    desc: "Selection and approval decisions are published in your portal with the award details.",
  },
];

function Home() {
  const schemesQuery = useSchemesQuery();
  const schemes = (schemesQuery.data ?? []).map((scheme) => ({
    ...scheme,
    type: String(scheme["type"] ?? "Scholarship"),
    open: Boolean(scheme["open"] ?? scheme["active"]),
    summary: String(
      scheme["summary"] ??
        scheme["description"] ??
        "Scheme details are available in the application form.",
    ),
    level: String(scheme["level"] ?? "Higher education"),
    deadline: String(scheme["deadline"] ?? "To be announced"),
  }));
  const notices: { id: string; date: string; tag: string; title: string; body: string }[] = [];
  const openSchemes = schemes.filter((s) => s.open);
  const featured = openSchemes[0] ?? schemes[0];
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="border-b bg-surface">
        <div className="shell grid items-center gap-10 py-14 md:py-20 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="eyebrow">Ministry of Tribal Affairs · Government of India</p>
            <h1 className="mt-4 text-4xl leading-[1.08] text-balance sm:text-5xl lg:text-[3.4rem]">
              Scholarships and fellowships for Scheduled Tribe students
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground text-pretty sm:text-lg">
              One portal to discover schemes, apply online, upload documents and follow every stage
              of your application — from submission to award.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/register">
                  Start an application <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/schemes">Explore schemes</Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t pt-6">
              <div>
                <dt className="font-display text-2xl">{schemes.length}</dt>
                <dd className="mt-1 text-xs text-muted-foreground">Schemes listed</dd>
              </div>
              <div>
                <dt className="font-display text-2xl">{openSchemes.length}</dt>
                <dd className="mt-1 text-xs text-muted-foreground">Open for applications</dd>
              </div>
              <div>
                <dt className="font-display text-2xl">6</dt>
                <dd className="mt-1 text-xs text-muted-foreground">Steps from apply to award</dd>
              </div>
            </dl>
          </div>
          <div className="relative">
            <img
              src={hero}
              alt="Scheduled Tribe students on a university campus"
              width={1280}
              height={1024}
              className="aspect-[5/4] w-full rounded-2xl border object-cover shadow-lift"
            />
            <div className="absolute -bottom-6 left-4 hidden max-w-xs rounded-xl border bg-card p-4 shadow-lift sm:block">
              {featured ? (
                <>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <CalendarClock className="size-4 text-primary" aria-hidden /> {featured.name} is{" "}
                    {featured.open ? "open" : "closed"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last date to apply: {featured.deadline}.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Scheme windows will be announced here.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Schemes */}
      <section className="shell py-16 md:py-20">
        <SectionHead
          eyebrow="Explore schemes"
          title="Schemes open for Scheduled Tribe students and scholars"
          desc="Pre-matric to doctoral and overseas study — choose the scheme that matches your stage of education."
          action={
            <Button asChild variant="outline">
              <Link to="/schemes">
                View all schemes <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          }
        />
        {schemesQuery.isLoading ? (
          <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
            Loading schemes…
          </p>
        ) : schemesQuery.isError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-sm text-destructive">
            We could not load schemes right now.
          </p>
        ) : schemes.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
            No schemes are currently available.
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {schemes.slice(0, 6).map((s) => (
              <Card
                key={s.id}
                className="flex flex-col shadow-card transition-shadow hover:shadow-lift"
              >
                <CardContent className="flex flex-1 flex-col p-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                      <GraduationCap className="size-3.5" aria-hidden /> {s.type}
                    </span>
                    <span
                      className={
                        s.open
                          ? "text-xs font-medium text-leaf"
                          : "text-xs font-medium text-muted-foreground"
                      }
                    >
                      {s.open ? "Open" : "Closed"}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg leading-snug">{s.name}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.summary}</p>
                  <dl className="mt-5 space-y-1.5 border-t pt-4 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Level</dt>
                      <dd className="text-right font-medium">{s.level}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Last date</dt>
                      <dd className="text-right font-medium">{s.deadline}</dd>
                    </div>
                  </dl>
                  <Button asChild variant="ghost" className="mt-4 justify-start px-0 text-primary">
                    <Link to="/schemes/$id" params={{ id: s.id }}>
                      Scheme details <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="border-y bg-surface py-16 md:py-20">
        <div className="shell">
          <SectionHead
            center
            eyebrow="How it works"
            title="Six steps from registration to award"
            desc="Every stage is visible to you. You will always know what is pending and who is acting on it."
          />
          <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-xl border bg-card p-6 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-display text-sm text-muted-foreground">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Eligibility & documents */}
      <section className="shell grid items-center gap-12 py-16 md:py-20 lg:grid-cols-2">
        <img
          src={scholar}
          alt="Research scholar preparing an application in a university library"
          width={1024}
          height={768}
          loading="lazy"
          className="order-2 aspect-[4/3] w-full rounded-2xl border object-cover shadow-card lg:order-1"
        />
        <div className="order-1 lg:order-2">
          <SectionHead
            eyebrow="Eligibility & documents"
            title="Check what you need before you begin"
            desc="Requirements vary by scheme. These are common across most scholarships and fellowships."
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold">General eligibility</p>
              <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
                {[
                  "Scheduled Tribe status with a valid certificate",
                  "Admission or enrolment in a recognised course",
                  "Family income within the scheme ceiling, where applicable",
                  "Not drawing another central award for the same course",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-leaf" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold">Documents to keep ready</p>
              <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
                {[
                  "Caste / Tribe certificate",
                  "Admission or enrolment proof",
                  "Latest marksheet or degree certificate",
                  "Income certificate, where applicable",
                  "Bank passbook first page",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <ScrollText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Button asChild variant="outline" className="mt-8">
            <Link to="/guidelines">Read full guidelines</Link>
          </Button>
        </div>
      </section>

      {/* Notices */}
      <section className="border-y bg-surface py-16 md:py-20">
        <div className="shell">
          <SectionHead
            eyebrow="Important notices"
            title="Latest circulars and announcements"
            action={
              <Button asChild variant="outline">
                <Link to="/notices">All notices</Link>
              </Button>
            }
          />
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {notices.length === 0 ? (
              <li className="p-5 text-sm text-muted-foreground">
                Notices will appear here when the notices API is available.
              </li>
            ) : (
              notices.map((n) => (
                <li
                  key={n.id}
                  className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:gap-6"
                >
                  <div className="shrink-0 sm:w-44">
                    <p className="text-xs font-medium text-muted-foreground">{n.date}</p>
                    <p className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                      {n.tag}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{n.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {/* Statistics */}
      <section className="shell py-16 md:py-20">
        <SectionHead
          center
          eyebrow="At a glance"
          title="Schemes published on the portal"
          desc="Live counts from the scheme catalogue."
        />
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-6 text-center shadow-card">
            <dt className="font-display text-3xl text-primary">{schemes.length}</dt>
            <dd className="mt-2 text-sm text-muted-foreground">Total schemes</dd>
          </div>
          <div className="rounded-xl border bg-card p-6 text-center shadow-card">
            <dt className="font-display text-3xl text-primary">{openSchemes.length}</dt>
            <dd className="mt-2 text-sm text-muted-foreground">Open for applications</dd>
          </div>
          <div className="rounded-xl border bg-card p-6 text-center shadow-card">
            <dt className="font-display text-3xl text-primary">
              {schemes.filter((s) => s.type === "Fellowship").length}
            </dt>
            <dd className="mt-2 text-sm text-muted-foreground">Fellowships</dd>
          </div>
          <div className="rounded-xl border bg-card p-6 text-center shadow-card">
            <dt className="font-display text-3xl text-primary">
              {schemes.filter((s) => s.type === "Scholarship").length}
            </dt>
            <dd className="mt-2 text-sm text-muted-foreground">Scholarships</dd>
          </div>
        </dl>
      </section>

      {/* Status CTA */}
      <section className="shell pb-16 md:pb-20">
        <div className="grid items-center gap-8 rounded-2xl border bg-ink p-8 text-ink-foreground md:grid-cols-2 md:p-12">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              Track application
            </p>
            <h2 className="mt-3 text-2xl md:text-3xl">Check the status of your application</h2>
            <p className="mt-3 text-sm text-ink-foreground/75">
              Enter your application number to see the current stage, pending actions and any
              deficiency raised against your submission.
            </p>
          </div>
          <div className="rounded-xl bg-card p-5 text-card-foreground">
            <p className="text-sm font-medium">Sign in to track your application</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Your application number, current stage, pending actions and any deficiency are shown
              securely in your dashboard.
            </p>
            <Button asChild className="mt-4 w-full">
              <Link to="/login">
                <Search className="size-4" aria-hidden /> Sign in to track
              </Link>
            </Button>
            <Button asChild variant="outline" className="mt-2 w-full">
              <Link to="/register">Create an account</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="border-y bg-surface py-16 md:py-20">
        <div className="shell max-w-3xl">
          <SectionHead center eyebrow="FAQs" title="Questions applicants ask most" />
          <Accordion type="single" collapsible className="rounded-xl border bg-card px-2">
            {publicFaqs.slice(0, 5).map((f, i) => (
              <AccordionItem key={f.q} value={`f${i}`}>
                <AccordionTrigger className="px-4 text-left text-base">{f.q}</AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-6 text-center">
            <Button asChild variant="outline">
              <Link to="/faqs">See all questions</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Useful links */}
      <section className="shell py-16 md:py-20">
        <SectionHead eyebrow="Useful links" title="Related portals and departments" />
        <UsefulLinks />
      </section>
    </PublicLayout>
  );
}
