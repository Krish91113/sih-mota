import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, KpiCard } from "@/components/mota/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useUsersQuery,
  useUserScopesQuery,
  useAddUserScopeMutation,
  useRemoveUserScopeMutation,
} from "@/hooks/api/useUsers";
import { Shield, User, Plus, Trash2, Globe, Building2, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface UserItem {
  id: string;
  email?: string;
  full_name?: string;
  role?: string;
}

export const Route = createFileRoute("/admin/scopes")({
  head: () => ({ meta: [{ title: "Scopes | Administration" }] }),
  component: AdminScopes,
});

function AdminScopes() {
  const usersQuery = useUsersQuery();
  const users: UserItem[] =
    (usersQuery.data as { data?: UserItem[] })?.data ||
    (Array.isArray(usersQuery.data) ? (usersQuery.data as UserItem[]) : []) ||
    [];

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const currentUserId = selectedUserId || (users[0]?.id ?? "");

  const scopesQuery = useUserScopesQuery(currentUserId);
  const addScopeMutation = useAddUserScopeMutation();
  const removeScopeMutation = useRemoveUserScopeMutation();

  const [scopeType, setScopeType] = useState("STATE");
  const [scopeValue, setScopeValue] = useState("");

  const rawScopes =
    (
      scopesQuery.data as {
        data?: Array<{
          id: string;
          scope_type: string;
          scope_value: string;
          resource?: string;
        }>;
      }
    )?.data ||
    (Array.isArray(scopesQuery.data) ? scopesQuery.data : []) ||
    [];
  const scopesList: Array<{
    id: string;
    scope_type: string;
    scope_value: string;
    resource?: string;
  }> = Array.isArray(rawScopes) ? rawScopes : [];

  const currentUser = users.find((u: UserItem) => u.id === currentUserId) || users[0];

  const handleAddScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      toast.error("Please select a user");
      return;
    }
    if (!scopeValue.trim()) {
      toast.error("Please enter a scope value");
      return;
    }
    try {
      await addScopeMutation.mutateAsync({
        userId: currentUserId,
        data: {
          scope_type: scopeType,
          scope_value: scopeValue.trim(),
        },
      });
      setScopeValue("");
      toast.success("Scope added to user");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to add scope";
      toast.error(errorMsg);
    }
  };

  const handleRemoveScope = async (scopeId: string) => {
    try {
      await removeScopeMutation.mutateAsync({
        userId: currentUserId,
        scopeId,
      });
      toast.success("Scope removed");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to remove scope";
      toast.error(errorMsg);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access scopes"
        desc="Data boundaries and regional/scheme restrictions assigned to officer and committee accounts."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total system users" value={String(users.length)} icon={User} />
        <KpiCard label="Selected user scopes" value={String(scopesList.length)} icon={Shield} />
        <KpiCard label="Active boundary type" value={scopeType} icon={Globe} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Select officer / user</CardTitle>
          </CardHeader>
          <CardContent className="p-3 max-h-96 overflow-y-auto space-y-1">
            {users.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">No users loaded.</p>
            ) : (
              users.map((u: UserItem) => {
                const isSelected = u.id === currentUserId;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={`flex w-full flex-col rounded-lg p-3 text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted/60 text-foreground"
                    }`}
                  >
                    <span className="font-semibold">{u.full_name || u.email}</span>
                    <span
                      className={
                        isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                      }
                    >
                      {u.role} · {u.email}
                    </span>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">
                Scopes for {currentUser?.full_name || currentUser?.email || "User"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {scopesList.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                  No data scope restrictions assigned. User operates under standard role
                  permissions.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {scopesList.map((sc) => (
                    <div
                      key={sc.id}
                      className="flex items-center justify-between rounded-lg border p-3 bg-card text-xs shadow-sm"
                    >
                      <div className="space-y-1">
                        <span className="font-semibold text-primary uppercase text-[10px] tracking-wide">
                          {sc.scope_type}
                        </span>
                        <p className="font-medium text-foreground">{sc.scope_value}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveScope(sc.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Assign new scope</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleAddScope} className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="stype">Scope type</Label>
                  <select
                    id="stype"
                    value={scopeType}
                    onChange={(e) => setScopeType(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="STATE">State (e.g. Jharkhand, Odisha)</option>
                    <option value="SCHEME">Scheme Code (e.g. NFST, NOS)</option>
                    <option value="INSTITUTION">Institution ID / Name</option>
                    <option value="DISTRICT">District</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="sval">Scope value</Label>
                  <Input
                    id="sval"
                    placeholder="e.g. Jharkhand, NFST"
                    value={scopeValue}
                    onChange={(e) => setScopeValue(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={addScopeMutation.isPending} className="w-full">
                    <Plus className="mr-1.5 size-4" />
                    {addScopeMutation.isPending ? "Assigning…" : "Assign scope"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
