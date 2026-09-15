import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  PageHeader,
  StatusBadge,
  Field,
  StageTimeline,
  AiSummaryCard,
} from "@/components/mota/bits";
import { useApplicationQuery } from "@/hooks/api/useApplications";
import { useDocumentsQuery } from "@/hooks/api/useDocuments";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  FolderOpen,
  PencilLine,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/applications/$id")({
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.id ?? "Application"} | Applicant Portal` }],
  }),
  component: ApplicationDetail,
});

function ApplicationDetail() {
  const { id } = Route.useParams();
  const appQuery = useApplicationQuery(id);
  const documentsQuery = useDocumentsQuery({ application_id: id });
  const navigate = useNavigate();
  const app = appQuery.data;
  const documents = (documentsQuery.data ?? []).map((document) => ({
    ...document,
    name: document.filename,
  }));
  const verifiedDocs = documents.filter((d) => d.status === "Verified").length;
  if (appQuery.isLoading)
    return <p className="py-12 text-sm text-muted-foreground">Loading application…</p>;
  if (appQuery.isError || !app)
    return <p className="py-12 text-sm text-destructive">We could not load this application.</p>;
  const appView = {
    ...app,
    scheme: String(app.scheme_name ?? app.scheme_id),
    progress: Number(app.progress ?? 100),
    submitted: app.created_at ? new Date(app.created_at).toLocaleDateString() : "—",
    updated: app.updated_at ? new Date(app.updated_at).toLocaleDateString() : "—",
    nextAction: String(app.next_action ?? "View application status"),
    stage: String(app.stage ?? app.status),
  };

  return (
    <div>
      <PageHeader
        title={appView.id}
        desc={`${appView.scheme} · submitted ${appView.submitted}`}
        action={<StatusBadge status={app.status} />}
      />

      <Card className="mb-6 border-primary/25 bg-accent/40 shadow-card">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Overall progress</p>
              <p className="mt-1 font-display text-3xl text-primary">{appView.progress}%</p>
            </div>
            <div className="w-full max-w-sm">
              <Progress
                value={appView.progress}
                className="h-2"
                aria-label={`${appView.progress}% complete`}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Next action:{" "}
                <span className="font-medium text-foreground">{appView.nextAction}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {app.status === "Draft" ? (
                <Button onClick={() => navigate({ to: "/portal/applications/new" })}>
                  <PencilLine className="size-4" aria-hidden /> Continue application
                </Button>
              ) : null}
              {app.status === "Action Required" ? (
                <Button
                  onClick={() =>
                    navigate({
                      to: "/portal/applications/$id/deficiency",
                      params: { id: appView.id },
                    })
                  }
                >
                  <AlertTriangle className="size-4" aria-hidden /> Resolve deficiencies
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link to="/portal/applications/$id/documents" params={{ id: app.id }}>
                  <FolderOpen className="size-4" aria-hidden /> Documents
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-card">
        <CardHeader className="border-b border-dashed pb-3">
          <CardTitle className="text-base">Application tracking timeline</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <StageTimeline current={appView.stage} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Application summary</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Field label="Application ID" value={appView.id} />
              <Field label="Scheme" value={appView.scheme} />
              <Field label="Submitted" value={appView.submitted} />
              <Field label="Last updated" value={appView.updated} />
              <Field label="Academic year" value="2026-27" />
              <Field
                label="Document slots verified"
                value={`${verifiedDocs} of ${documents.length}`}
              />
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Documents checklist</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ul className="space-y-2.5">
              {documents.map((d) => (
                <li
                  key={d.name}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-5 w-full">
              <Link to="/portal/applications/$id/documents" params={{ id: app.id }}>
                <UploadCloud className="size-4" aria-hidden /> Manage documents
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <AiSummaryCard title="Application insights" />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <Button asChild variant="ghost" className="text-muted-foreground">
          <Link to="/portal/applications">
            <ArrowRight className="size-4 rotate-180" aria-hidden /> Back to applications
          </Link>
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            toast.success("PDF snapshot downloading");
          }}
        >
          <FileText className="size-4" aria-hidden /> Download PDF snapshot
        </Button>
      </div>
    </div>
  );
}
