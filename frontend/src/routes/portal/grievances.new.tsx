import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/mota/bits";
import { UploadZone } from "@/components/mota/UploadZone";
import { useApplicationsQuery } from "@/hooks/api/useApplications";
import { useState } from "react";
import { CheckCircle2, MessageSquarePlus } from "lucide-react";

export const Route = createFileRoute("/portal/grievances/new")({
  head: () => ({
    meta: [{ title: "Raise Grievance | Applicant Portal" }],
  }),
  component: NewGrievance,
});

const CATEGORIES = [
  "Application status",
  "Deficiency response",
  "Payment / disbursement",
  "Certificate issue",
  "Portal access",
  "Other",
];

function NewGrievance() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [category, setCategory] = useState("");
  const applicationsQuery = useApplicationsQuery();
  const applications = applicationsQuery.data ?? [];

  if (submitted) {
    return (
      <Card className="mx-auto max-w-xl border-leaf/30 shadow-lift">
        <CardContent className="flex flex-col items-center p-10 text-center">
          <span className="rounded-full bg-leaf/10 p-4 text-leaf">
            <CheckCircle2 className="size-10" aria-hidden />
          </span>
          <h1 className="mt-5 text-2xl">Grievance registered</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reference <span className="font-semibold text-foreground">GRV-2026-1212</span> has been
            assigned to the grievance cell. Escalation timelines apply if it stays unresolved.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/portal/grievances" })}>
            Track my grievances
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Raise a grievance"
        desc="Describe your issue in your own words. Redeemable only for genuine concerns — efforts to misuse may be penalised."
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquarePlus className="size-4 text-primary" aria-hidden /> Grievance details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label className="text-sm">Category</Label>
                <Select value={category || undefined} onValueChange={setCategory}>
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Related application</Label>
                <Select>
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue placeholder="Select application (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {applications.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="g-subject" className="text-sm">
                Subject
              </Label>
              <Input
                id="g-subject"
                className="mt-2"
                placeholder="Brief summary of the issue"
                required
              />
            </div>
            <div>
              <Label htmlFor="g-body" className="text-sm">
                Description
              </Label>
              <Textarea
                id="g-body"
                className="mt-2 min-h-32"
                placeholder="Explain what happened, when, and what you expect to be resolved."
                required
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Do not include Aadhaar or your full bank account number.
              </p>
            </div>
            <div>
              <p className="text-sm">Supporting evidence (optional)</p>
              <div className="mt-2">
                <UploadZone onUploaded={() => undefined} />
              </div>
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border bg-card p-5 text-xs text-muted-foreground shadow-card">
            <p className="text-sm font-semibold text-foreground">What happens next</p>
            <ol className="mt-3 list-inside list-decimal space-y-2">
              <li>Grievance cell acknowledge within 2 working days.</li>
              <li>Resolved cases are closed with a written reply.</li>
              <li>Unresolved grievances escalate to the nodal officer next.</li>
              <li>Incorrect fields are returned as deficiencies on grievance.</li>
            </ol>
          </div>
          <Card className="shadow-card">
            <CardContent className="p-5 text-xs text-muted-foreground">
              Be sure to share a reachable mobile/email — the grievance cell may contact you for
              clarification before deciding the case.
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/portal/grievances">Cancel</Link>
            </Button>
            <Button className="flex-1" onClick={() => setSubmitted(true)}>
              Submit grievance
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
