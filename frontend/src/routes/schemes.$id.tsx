import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/mota/PublicLayout";
import { PageBanner } from "@/components/mota/PageBanner";
import { Field, SectionHead } from "@/components/mota/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSchemeQuery } from "@/hooks/api/useSchemes";
import { getScheme } from "@/api/schemes";
import { BadgeCheck, CalendarClock, FileText } from "lucide-react";

export const Route = createFileRoute("/schemes/$id")({
  loader: async ({ params }) => {
    try {
      const scheme = await getScheme(params.id);
      return {
        id: params.id,
        name: scheme.name,
        summary: scheme.description ?? undefined,
      };
    } catch {
      return { id: params.id, name: undefined, summary: undefined };
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Scheme"} | MoTA Scholarships` },
      { name: "description", content: loaderData?.summary ?? "MoTA scheme details." },
      { property: "og:title", content: loaderData?.name ?? "MoTA Scheme" },
      { property: "og:description", content: loaderData?.summary ?? "MoTA scheme details." },
    ],
  }),
  component: SchemeDetail,
});

function SchemeDetail() {
  const { id } = Route.useLoaderData();
  const schemeQuery = useSchemeQuery(id);
  const raw = schemeQuery.data;
  const s = raw
    ? {
        ...raw,
        code: String(raw.code ?? ""),
        type: String(raw.type ?? "Scholarship"),
        name: String(raw.name ?? "Scheme"),
        summary: String(
          raw.summary ?? raw.description ?? "Scheme details are available in the application form.",
        ),
        level: String(raw.level ?? "Higher education"),
        amount: String(raw.amount ?? "See scheme guidelines"),
        slots: String(raw.slots ?? "—"),
        deadline: String(raw.deadline ?? "To be announced"),
        open: Boolean(raw.open ?? raw.active),
        eligibility: Array.isArray(raw.eligibility) ? raw.eligibility.map(String) : [],
        documents: Array.isArray(raw.documents) ? raw.documents.map(String) : [],
      }
    : null;
  if (schemeQuery.isLoading)
    return <p className="shell py-12 text-sm text-muted-foreground">Loading scheme…</p>;
  if (schemeQuery.isError || !s)
    return <p className="shell py-12 text-sm text-destructive">We could not load this scheme.</p>;
  return (
    <PublicLayout>
      <PageBanner
        eyebrow={`${s.code} · ${s.type}`}
        title={s.name}
        desc={s.summary}
        crumb="Scheme details"
      />
      <div className="shell grid gap-10 py-10 md:py-14 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-10">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Scheme overview</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-6 sm:grid-cols-2">
                <Field label="Level of study" value={s.level} />
                <Field label="Award value" value={s.amount} />
                <Field label="Number of awards" value={s.slots} />
                <Field label="Last date to apply" value={s.deadline} />
              </dl>
            </CardContent>
          </Card>

          <div>
            <SectionHead eyebrow="Eligibility" title="Who can apply" />
            <ul className="space-y-3 rounded-xl border bg-card p-6 shadow-card">
              {s.eligibility.map((e) => (
                <li key={e} className="flex gap-3 text-sm">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-leaf" aria-hidden />
                  {e}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SectionHead eyebrow="Documents" title="Checklist to upload" />
            <ul className="grid gap-3 sm:grid-cols-2">
              {s.documents.map((d) => (
                <li
                  key={d}
                  className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-card"
                >
                  <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                  {d}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SectionHead eyebrow="Selection" title="How applications are processed" />
            <ol className="space-y-4 rounded-xl border bg-card p-6 shadow-card">
              {[
                "Automated validation of mandatory fields and duplicate checks.",
                "Document verification against the scheme checklist.",
                "Institution verification of enrolment and course details.",
                "Scrutiny by Ministry officers, with deficiencies raised where needed.",
                "Selection committee review and merit-based recommendation.",
                "Competent authority approval and award release.",
              ].map((t, i) => (
                <li key={t} className="flex gap-4 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card className="border-primary/25 bg-accent/40 shadow-card">
            <CardContent className="p-6">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="size-4 text-primary" aria-hidden />
                {s.open ? "Applications open" : "Currently closed"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Last date: {s.deadline}</p>
              <Button asChild className="mt-5 w-full" disabled={!s.open}>
                <Link to="/portal/applications/new">Apply for this scheme</Link>
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link to="/guidelines">Read guidelines</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6 text-sm">
              <p className="font-semibold">Need help?</p>
              <p className="mt-2 text-muted-foreground">
                Contact the scheme helpdesk on working days between 9:30 am and 6:00 pm.
              </p>
              <Button asChild variant="ghost" className="mt-3 px-0 text-primary">
                <Link to="/contact">Contact details</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PublicLayout>
  );
}
