import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatusBadge } from "@/components/mota/bits";
import {
  useSchemeQuery,
  useSchemeVersionsQuery,
  useFormDefinitionQuery,
  useSchemeRulesQuery,
} from "@/hooks/api/useSchemes";
import { ArrowLeft } from "lucide-react";
export const Route = createFileRoute("/admin/schemes/$id")({
  head: () => ({ meta: [{ title: "Scheme | Administration" }] }),
  component: SchemeDetail,
});
function SchemeDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const scheme = useSchemeQuery(id);
  const versions = useSchemeVersionsQuery(id);
  const versionId = versions.data?.[0]?.id ?? "";
  const form = useFormDefinitionQuery(versionId);
  const rules = useSchemeRulesQuery(versionId);
  if (scheme.isLoading || versions.isLoading)
    return <p className="text-sm text-muted-foreground">Loading scheme…</p>;
  if (scheme.isError || versions.isError)
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load this scheme.
      </p>
    );
  if (!scheme.data)
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Scheme not found.
      </p>
    );
  const s = scheme.data;
  return (
    <div>
      <PageHeader
        title={`${s.code} · ${s.name}`}
        desc={s.description ?? "No description provided."}
        action={<StatusBadge status={s.active ? "Active" : "Inactive"} />}
      />
      <Button variant="outline" onClick={() => navigate({ to: "/admin/schemes" })}>
        <ArrowLeft className="size-4" aria-hidden /> Back
      </Button>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Version history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {!versions.data?.length ? (
              <p className="text-sm text-muted-foreground">No versions are available.</p>
            ) : (
              versions.data.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-xl border p-4 text-sm"
                >
                  <span>{v.version}</span>
                  <StatusBadge status={v.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-muted-foreground">
              {rules.isLoading || form.isLoading
                ? "Loading version configuration…"
                : "Version configuration loaded from the API."}
            </p>
            {rules.data?.length ? (
              <Badge variant="secondary">{rules.data.length} rules</Badge>
            ) : null}
            {form.data ? (
              <Badge variant="secondary">{form.data.sections.length} sections</Badge>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
