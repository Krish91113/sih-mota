import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/mota/bits";
import { usePermissionsQuery } from "@/hooks/api/useUsers";
import { Check, Minus } from "lucide-react";
export const Route = createFileRoute("/admin/permissions")({
  head: () => ({ meta: [{ title: "Permissions | Administration" }] }),
  component: PermissionsMatrix,
});
function PermissionsMatrix() {
  const query = usePermissionsQuery();
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading permissions…</p>;
  if (query.isError)
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load permissions.
      </p>
    );
  const permissions = query.data ?? [];
  return (
    <div>
      <PageHeader
        title="Permissions matrix"
        desc="Permissions currently registered by the platform policy API."
      />
      {!permissions.length ? (
        <p className="mb-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No permissions are configured.
        </p>
      ) : null}
      <Card className="shadow-card">
        <CardHeader className="border-b border-dashed pb-3">
          <CardTitle className="text-base">{permissions.length} permissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                <th className="px-5 py-3">Resource</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Scope</th>
                <th className="px-5 py-3">State</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="px-5 py-3">{p.resource}</td>
                  <td className="px-5 py-3">{p.action}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.scope}</td>
                  <td className="px-5 py-3 text-leaf">
                    <Check className="size-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="mt-4 text-xs text-muted-foreground">
        <Minus className="mr-1 inline size-3" />
        Role-specific grant editing is not exposed by the current route API.
      </p>
    </div>
  );
}
