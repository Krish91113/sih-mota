import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useSchemesQuery } from "@/hooks/api/useSchemes";
import type { Scheme } from "@/api/schemes";
import { FilePlus2 } from "lucide-react";
import { toast } from "sonner";
export const Route = createFileRoute("/admin/schemes")({
  head: () => ({ meta: [{ title: "Schemes & Versions | Administration" }] }),
  component: SchemesVersions,
});
const columns: Column<Scheme>[] = [
  {
    key: "code",
    header: "Code",
    sortValue: (r) => r.code,
    cell: (r) => (
      <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold">{r.code}</span>
    ),
  },
  {
    key: "name",
    header: "Scheme",
    sortValue: (r) => r.name,
    cell: (r) => <span className="font-medium">{r.name}</span>,
  },
  {
    key: "description",
    header: "Description",
    sortValue: (r) => r.description ?? "",
    cell: (r) => <span className="text-muted-foreground">{r.description ?? "—"}</span>,
    hideBelowMd: true,
  },
  {
    key: "active",
    header: "Status",
    sortValue: (r) => String(r.active),
    cell: (r) => <StatusBadge status={r.active ? "Active" : "Inactive"} />,
  },
];
function SchemesVersions() {
  const query = useSchemesQuery();
  const navigate = useNavigate();
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading schemes…</p>;
  if (query.isError)
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load schemes.
      </p>
    );
  const data = query.data ?? [];
  return (
    <div>
      <PageHeader
        title="Schemes & versions"
        desc="Configure the schemes, their versions and where each is in the publish pipeline."
        action={
          <Button onClick={() => toast.info("Scheme creation is not available in the current API")}>
            <FilePlus2 className="size-4" aria-hidden /> Clone a scheme
          </Button>
        }
      />
      {!data.length ? (
        <p className="mb-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No schemes are configured.
        </p>
      ) : null}
      <DataTable
        data={data}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search scheme, code or status"
        searchKeys={(r) => `${r.code} ${r.name} ${r.description ?? ""}`}
        onRowClick={(r) => navigate({ to: "/admin/schemes/$id", params: { id: r.id } })}
      />
    </div>
  );
}
