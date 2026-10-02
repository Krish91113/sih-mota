import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useCreateUserMutation, useUsersQuery } from "@/hooks/api/useUsers";
import type { User } from "@/api/users";
import { useState } from "react";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { humanizeField } from "@/lib/format";

export const Route = createFileRoute("/institution/users")({
  head: () => ({
    meta: [{ title: "Institution Users | Institution Portal" }],
  }),
  component: InstitutionUsers,
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
      <span className="inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
        {humanizeField(r.role)}
      </span>
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
    key: "is_active",
    header: "Status",
    sortValue: (r) => String(r.is_active),
    cell: (r) => (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          r.is_active ? "bg-leaf/10 text-leaf" : "bg-muted text-muted-foreground"
        }`}
      >
        {r.is_active ? "Active" : "Inactive"}
      </span>
    ),
  },
  {
    // `GET /users` returns created_at only — there is no last-login timestamp.
    key: "created_at",
    header: "Created",
    sortValue: (r) => r.created_at,
    cell: (r) => <span className="text-muted-foreground">{formatDate(r.created_at)}</span>,
    hideBelowLg: true,
  },
];

/**
 * Role codes accepted by `POST /users`, as listed by `GET /roles`.
 * These are backend codes, not display labels.
 */
const ROLES = ["INSTITUTION_NODAL_OFFICER", "VERIFICATION_OFFICER", "APPLICANT"] as const;

function InstitutionUsers() {
  const { data: institutionUsers = [], isLoading, isError } = useUsersQuery();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(ROLES[1]);
  const createUserMutation = useCreateUserMutation();

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading institution users…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load institution users.</p>;
  return (
    <div>
      <PageHeader
        title="Institution users"
        desc="People from your institution who can verify applicants and respond to clarifications."
        action={
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="size-4" aria-hidden /> Add user
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <KpiCard label="Total users" value={String(institutionUsers.length)} icon={Users} />
        <KpiCard
          label="Active"
          value={String(institutionUsers.filter((u) => u.is_active).length)}
          icon={ShieldCheck}
        />
      </div>

      <DataTable
        data={institutionUsers}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search name, email or role"
        searchKeys={(r) => `${r.full_name} ${r.email} ${r.role}`}
      />

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <Card className="w-full max-w-md shadow-lift" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="border-b border-dashed">
              <CardTitle className="text-lg">Invite institution user</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div>
                <Label className="text-sm">Full name</Label>
                <Input
                  className="mt-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Shweta Tirkey"
                />
              </div>
              <div>
                <Label className="text-sm">Official email</Label>
                <Input
                  className="mt-2"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@institution.ac.in"
                />
              </div>
              <div>
                <Label className="text-sm">Role</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${role === r ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground"}`}
                    >
                      {humanizeField(r)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!name.trim() || !email.trim() || createUserMutation.isPending}
                  onClick={() => {
                    const newEmail = email.trim();
                    createUserMutation.mutate(
                      { full_name: name.trim(), email: newEmail, role },
                      {
                        onSuccess: () => {
                          setOpen(false);
                          setName("");
                          setEmail("");
                          // `POST /users` provisions the account directly — it does
                          // not send an invitation email.
                          toast.success(`${newEmail} can now sign in`);
                        },
                        onError: () => toast.error(`Could not create ${newEmail}`),
                      },
                    );
                  }}
                >
                  {createUserMutation.isPending ? "Creating…" : "Create user"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
