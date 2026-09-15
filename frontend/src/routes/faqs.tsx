import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/mota/PublicLayout";
import { PageBanner } from "@/components/mota/PageBanner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { faqs } from "@/lib/mock";

export const Route = createFileRoute("/faqs")({
  head: () => ({
    meta: [
      { title: "Frequently Asked Questions | MoTA Scholarship Portal" },
      {
        name: "description",
        content:
          "Answers on eligibility, documents, deficiencies, verification and tracking for MoTA scholarships and fellowships.",
      },
      { property: "og:title", content: "FAQs | MoTA Scholarship Portal" },
      {
        property: "og:description",
        content: "Common questions from ST scholarship and fellowship applicants.",
      },
    ],
  }),
  component: Faqs,
});

const more = [
  {
    q: "Can I edit my application after submitting it?",
    a: "No. After submission the application is locked for processing. If a correction is needed, an officer raises a deficiency and you respond through the portal.",
  },
  {
    q: "Is there any fee to apply?",
    a: "No fee is charged for applying to scholarships or fellowships on this portal.",
  },
  {
    q: "My institution is not listed. What should I do?",
    a: "Ask your institution to complete onboarding through the institution portal. Until then, raise a grievance so the Ministry can guide you.",
  },
];

function Faqs() {
  return (
    <PublicLayout>
      <PageBanner
        title="Frequently asked questions"
        desc="If your question is not answered here, contact the helpdesk or raise a grievance."
        crumb="FAQs"
      />
      <div className="shell max-w-3xl py-10 md:py-14">
        <Accordion type="single" collapsible className="rounded-xl border bg-card px-2 shadow-card">
          {[...faqs, ...more].map((f, i) => (
            <AccordionItem key={f.q} value={`q${i}`}>
              <AccordionTrigger className="px-4 text-left text-base">{f.q}</AccordionTrigger>
              <AccordionContent className="px-4 text-sm text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/contact">Contact helpdesk</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/grievance">Raise a grievance</Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}
