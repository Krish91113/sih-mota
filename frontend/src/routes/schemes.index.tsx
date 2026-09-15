import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/mota/PublicLayout";
import { PageBanner } from "@/components/mota/PageBanner";
import { EmptyState } from "@/components/mota/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSchemesQuery } from "@/hooks/api/useSchemes";
import { ArrowRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/schemes/")({
  head: () => ({
    meta: [
      { title: "Scholarship & Fellowship Schemes for ST Students | MoTA" },
      {
        name: "description",
        content:
          "Browse Ministry of Tribal Affairs scholarship and fellowship schemes for Scheduled Tribe students, from pre-matric to overseas doctoral study.",
      },
      { property: "og:title", content: "MoTA Schemes for Scheduled Tribe Students" },
      {
        property: "og:description",
        content: "Eligibility, award value, documents and last dates for every ST scheme.",
      },
    ],
  }),
  component: Schemes,
});

function Schemes() {
  const [q, setQ] = useState("");
  const schemesQuery = useSchemesQuery();
  const schemes = schemesQuery.data ?? [];
  const schemeViews = schemes.map((scheme) => ({
    ...scheme,
    type: String(scheme.type ?? "Scholarship"),
    open: Boolean(scheme.open ?? scheme.active),
    summary: String(
      scheme.summary ??
        scheme.description ??
        "Scheme details are available in the application form.",
    ),
    level: String(scheme.level ?? "Higher education"),
    amount: String(scheme.amount ?? "See scheme guidelines"),
    deadline: String(scheme.deadline ?? "To be announced"),
    code: String(scheme.code ?? ""),
  }));
  const [tab, setTab] = useState("all");

  const list = useMemo(
    () =>
      schemeViews.filter(
        (s) =>
          (tab === "all" ||
            (tab === "open" && s.open) ||
            (tab === "fellowship" && s.type === "Fellowship") ||
            (tab === "scholarship" && s.type === "Scholarship")) &&
          (s.name + s.summary + s.level).toLowerCase().includes(q.toLowerCase()),
      ),
    [q, tab, schemesQuery.data],
  );

  return (
    <PublicLayout>
      <PageBanner
        title="Scholarship and fellowship schemes"
        desc="Six central schemes support Scheduled Tribe students across school, college, research and overseas study."
        crumb="Schemes"
      />
      <div className="shell py-10 md:py-14">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="w-full max-w-sm">
            <Label htmlFor="q" className="text-sm">
              Search schemes
            </Label>
            <div className="relative mt-2">
              <Search
                className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Fellowship, overseas, post-matric…"
                className="pl-9"
              />
            </div>
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="scholarship">Scholarships</TabsTrigger>
              <TabsTrigger value="fellowship">Fellowships</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {schemesQuery.isLoading ? (
          <p className="rounded-xl border border-dashed bg-card p-8 text-sm text-muted-foreground">
            Loading schemes…
          </p>
        ) : schemesQuery.isError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-sm text-destructive">
            We could not load schemes. Please try again later.
          </p>
        ) : list.length === 0 ? (
          <EmptyState
            title="No schemes match your search"
            desc="Try a different keyword, or clear the filters to see all six schemes."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQ("");
                  setTab("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {list.map((s) => (
              <Card key={s.id} className="shadow-card transition-shadow hover:shadow-lift">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                      {s.code} · {s.type}
                    </span>
                    <span
                      className={
                        s.open
                          ? "text-xs font-medium text-leaf"
                          : "text-xs font-medium text-muted-foreground"
                      }
                    >
                      {s.open ? "Applications open" : "Currently closed"}
                    </span>
                  </div>
                  <h2 className="mt-4 text-xl leading-snug">{s.name}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{s.summary}</p>
                  <dl className="mt-5 grid gap-4 border-t pt-4 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Level</dt>
                      <dd className="mt-1 font-medium">{s.level}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Award</dt>
                      <dd className="mt-1 font-medium">{s.amount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Last date</dt>
                      <dd className="mt-1 font-medium">{s.deadline}</dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button asChild>
                      <Link to="/schemes/$id" params={{ id: s.id }}>
                        View details <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/portal/applications/new">Apply now</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
