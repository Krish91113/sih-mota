import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useUsersQuery } from "@/hooks/api/useUsers";
import type { User } from "@/api/users";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users | Administration" }] }),
  component: AdminUsers,
});
const columns: Column<User>[] = [
  {
    key: "full_name",
    header: "Name",
    sortValue: (r) => r.full_name,
    cell: (r) => <span className="font-medium">{r.full_name}</span>,
  },
  {
    key: "role",
    header: "Role",
    sortValue: (r) => r.role,
    cell: (r) => (
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">{r.role}</span>
    ),
  },
  {
    key: "email",
    header: "Email",
    sortValue: (r) => r.email,
    cell: (r) => <span className="text-muted-foreground">{r.email}</span>,
    hideBelowMd: true,
  },
  {
    key: "created_at",
    header: "Created",
    sortValue: (r) => r.created_at,
    cell: (r) => <span className="text-muted-foreground">{r.created_at}</span>,
    hideBelowLg: true,
  },
];
function AdminUsers() {
  const query = useUsersQuery();
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading users…</p>;
  if (query.isError)
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load users.
      </p>
    );
  const data = query.data ?? [];
  return (
    <div>
      <PageHeader
        title="Users"
        desc="Every platform user across officer, committee, finance, admin and institution roles."
        action={
          <Button
            onClick={() =>
              toast.info(
                "User creation is available through the user API, but no create form is configured",
              )
            }
          >
            <UserPlus className="size-4" aria-hidden /> Add user
          </Button>
        }
      />
      {!data.length ? (
        <p className="mb-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No users are configured.
        </p>
      ) : null}
      <DataTable
        data={data}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search users by name, role or email"
        searchKeys={(r) => `${r.full_name} ${r.role} ${r.email}`}
      />
    </div>
  );
}
