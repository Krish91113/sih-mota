import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useRolesQuery } from "@/hooks/api/useUsers";
import type { Role } from "@/api/users";
import { FilePlus2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
export const Route = createFileRoute("/admin/roles")({
  head: () => ({ meta: [{ title: "Roles | Administration" }] }),
  component: AdminRoles,
});
const columns: Column<Role>[] = [
  {
    key: "name",
    header: "Role",
    sortValue: (r) => r.name,
    cell: (r) => (
      <span className="flex items-center gap-2 font-medium">
        <ShieldCheck className="size-4 text-primary" aria-hidden />
        {r.name}
      </span>
    ),
  },
  {
    key: "description",
    header: "Description",
    sortValue: (r) => r.description ?? "",
    cell: (r) => <span className="text-muted-foreground">{r.description ?? "—"}</span>,
  },
  {
    key: "is_active",
    header: "Status",
    sortValue: (r) => String(r.is_active),
    cell: (r) => <StatusBadge status={r.is_active ? "Active" : "Inactive"} />,
  },
];
function AdminRoles() {
  const query = useRolesQuery();
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading roles…</p>;
  if (query.isError)
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load roles.
      </p>
    );
  const data = query.data ?? [];
  return (
    <div>
      <PageHeader
        title="Roles"
        desc="Predefined role bundles that decide what each user can see and do."
        action={
          <Button onClick={() => toast.info("Role creation is not configured in this screen")}>
            <FilePlus2 className="size-4" aria-hidden /> Create role
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Roles" value={String(data.length)} icon={ShieldCheck} />
        <KpiCard
          label="Active roles"
          value={String(data.filter((r) => r.is_active).length)}
          icon={ShieldCheck}
        />
        <KpiCard
          label="System roles"
          value={String(data.filter((r) => r.is_system).length)}
          icon={ShieldCheck}
        />
      </div>
      {!data.length ? (
        <p className="mb-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No roles are configured.
        </p>
      ) : null}
      <DataTable
        data={data}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search roles"
        searchKeys={(r) => `${r.name} ${r.description ?? ""}`}
      />
    </div>
  );
}
