import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/mota/PublicLayout";
import { PageBanner } from "@/components/mota/PageBanner";
import { EmptyState } from "@/components/mota/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notices } from "@/content/publicContent";
import { useState } from "react";

export const Route = createFileRoute("/notices")({
  head: () => ({
    meta: [
      { title: "Notices & Circulars | MoTA Scholarship Portal" },
      {
        name: "description",
        content:
          "Official notices, circulars, deadline extensions and result announcements for MoTA scholarship and fellowship schemes.",
      },
      { property: "og:title", content: "Notices & Circulars | MoTA" },
      {
        property: "og:description",
        content: "Latest announcements for ST scholarship and fellowship applicants.",
      },
    ],
  }),
  component: Notices,
});

function Notices() {
  const [q, setQ] = useState("");
  const list = notices.filter((n) =>
    (n.title + n.body + n.tag).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <PublicLayout>
      <PageBanner
        title="Notices and circulars"
        desc="Announcements issued by the Ministry for applicants, institutions and State nodal officers."
        crumb="Notices"
      />
      <div className="shell py-10 md:py-14">
        <div className="mb-8 max-w-sm">
          <Label htmlFor="nq" className="text-sm">
            Search notices
          </Label>
          <Input
            id="nq"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Deadline, result, verification…"
            className="mt-2"
          />
        </div>
        {list.length === 0 ? (
          <EmptyState
            title="No notices found"
            desc="No notice matches that keyword. Clear the search to see all announcements."
            action={
              <Button variant="outline" onClick={() => setQ("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <ul className="space-y-4">
            {list.map((n) => (
              <li key={n.id} className="rounded-xl border bg-card p-6 shadow-card">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                    {n.tag}
                  </span>
                  <span className="text-xs text-muted-foreground">{n.date}</span>
                </div>
                <h2 className="mt-3 text-lg leading-snug">{n.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PublicLayout>
  );
}
