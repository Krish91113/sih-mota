import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/mota/PublicLayout";
import { PageBanner } from "@/components/mota/PageBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/guidelines")({
  head: () => ({
    meta: [
      { title: "Application Guidelines | MoTA Scholarship Portal" },
      {
        name: "description",
        content:
          "Step-by-step guidelines, document standards and timelines for applying to MoTA scholarships and fellowships for ST students.",
      },
      { property: "og:title", content: "Application Guidelines | MoTA" },
      {
        property: "og:description",
        content: "How to prepare, submit and track a scholarship or fellowship application.",
      },
    ],
  }),
  component: Guidelines,
});

const sections = [
  {
    title: "Before you apply",
    points: [
      "Keep a valid Scheduled Tribe certificate issued by a competent authority.",
      "Confirm that your course and institution are recognised under the scheme.",
      "Have your bank account details in your own name, linked to your identity proof.",
      "Check the last date published on the scheme page; late submissions are not accepted.",
    ],
  },
  {
    title: "Filling the application",
    points: [
      "Complete your profile first — personal, caste, academic, institution and bank sections.",
      "The application form saves automatically as you move between sections.",
      "You may save a draft and return later; drafts are listed in your portal.",
      "Review the summary page carefully before submitting. Submitted applications cannot be edited.",
    ],
  },
  {
    title: "Document standards",
    points: [
      "Upload PDF, JPG or PNG files up to 5 MB per document.",
      "Scans must be in colour, complete, and show seals and signatures clearly.",
      "Do not upload password-protected or cropped documents.",
      "Replacing a document keeps the earlier file in version history for audit.",
    ],
  },
  {
    title: "Deficiencies and responses",
    points: [
      "If a document or detail needs correction, a deficiency is raised with a response deadline.",
      "Deficiencies appear as Action Required cards on your dashboard and by notification.",
      "Upload the replacement, review it, then submit your response before the deadline.",
      "Applications with unresolved deficiencies after the deadline may be closed.",
    ],
  },
  {
    title: "Verification and selection",
    points: [
      "Your institution confirms enrolment, course duration and fee details.",
      "Ministry officers scrutinise eligibility and documents against scheme rules.",
      "A selection committee records recommendations with reasons.",
      "Final approval is recorded by the competent authority and reflected in your portal.",
    ],
  },
];

function Guidelines() {
  return (
    <PublicLayout>
      <PageBanner
        title="Application guidelines"
        desc="Read these guidelines before starting an application. They apply to all scholarship and fellowship schemes unless a scheme notice states otherwise."
        crumb="Guidelines"
      />
      <div className="shell grid gap-10 py-10 md:py-14 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-6">
          {sections.map((s, i) => (
            <Card key={s.title} id={`s${i}`} className="shadow-card">
              <CardContent className="p-6 md:p-8">
                <p className="eyebrow">Section {i + 1}</p>
                <h2 className="mt-2 text-xl md:text-2xl">{s.title}</h2>
                <ul className="mt-5 space-y-3">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-3 text-sm text-muted-foreground">
                      <span
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                      {p}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="On this page" className="rounded-xl border bg-card p-5 shadow-card">
            <p className="text-sm font-semibold">On this page</p>
            <ul className="mt-3 space-y-2 text-sm">
              {sections.map((s, i) => (
                <li key={s.title}>
                  <a href={`#s${i}`} className="text-muted-foreground hover:text-primary">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4 text-primary" aria-hidden /> Scheme checklist
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              The exact document checklist and eligibility conditions are published on each scheme
              page. Open a scheme to see its requirements before applying.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full justify-start">
              <Link to="/schemes">Browse schemes</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="mt-2 w-full justify-start">
              <Link to="/contact">Contact the helpdesk</Link>
            </Button>
          </div>
        </aside>
      </div>
    </PublicLayout>
  );
}
