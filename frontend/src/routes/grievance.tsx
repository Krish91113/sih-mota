import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/mota/PublicLayout";
import { PageBanner } from "@/components/mota/PageBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Timer, UserCheck } from "lucide-react";

export const Route = createFileRoute("/grievance")({
  head: () => ({
    meta: [
      { title: "Grievance Redressal | MoTA Scholarship Portal" },
      {
        name: "description",
        content:
          "How to raise, escalate and track a grievance related to MoTA scholarship and fellowship applications, with response timelines.",
      },
      { property: "og:title", content: "Grievance Redressal | MoTA" },
      {
        property: "og:description",
        content: "Levels, timelines and tracking for scholarship grievances.",
      },
    ],
  }),
  component: Grievance,
});

const levels = [
  {
    icon: UserCheck,
    title: "Level 1 — Scheme helpdesk",
    time: "Response within 7 working days",
    desc: "First point of contact for application, document and verification issues.",
  },
  {
    icon: ShieldCheck,
    title: "Level 2 — State nodal officer",
    time: "Response within 15 working days",
    desc: "For institution verification delays and State-level scholarship matters.",
  },
  {
    icon: Timer,
    title: "Level 3 — Ministry grievance cell",
    time: "Response within 30 working days",
    desc: "Escalation where earlier levels have not resolved the matter.",
  },
];

function Grievance() {
  return (
    <PublicLayout>
      <PageBanner
        title="Grievance redressal"
        desc="Every grievance receives a ticket number and is tracked against a defined response timeline."
        crumb="Grievance"
      />
      <div className="shell py-10 md:py-14">
        <div className="grid gap-5 md:grid-cols-3">
          {levels.map((l) => (
            <Card key={l.title} className="shadow-card">
              <CardContent className="p-6">
                <span className="inline-flex rounded-lg bg-primary/10 p-2 text-primary">
                  <l.icon className="size-5" aria-hidden />
                </span>
                <h2 className="mt-4 text-base font-semibold">{l.title}</h2>
                <p className="mt-1 text-xs font-medium text-primary">{l.time}</p>
                <p className="mt-2 text-sm text-muted-foreground">{l.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-xl">Track an existing grievance</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Grievances raised through the portal appear with their ticket number and live status
                once you sign in. This keeps ticket details private to you.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/login">Sign in to track</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/portal/grievances">Go to my grievances</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/25 bg-accent/40 shadow-card">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-xl">Raise a new grievance</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Registered applicants can raise and follow grievances from inside the portal, where
                your application details are attached automatically.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                <li>• Attach supporting documents up to 5 MB</li>
                <li>• Receive updates by email and portal notification</li>
                <li>• Escalate to the next level if the timeline lapses</li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/portal/grievances">Go to my grievances</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/login">Login</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}
