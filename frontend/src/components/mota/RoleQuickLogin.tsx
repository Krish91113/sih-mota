import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, KeyRound, Loader2, LogIn } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { getMe, login } from "@/api/auth";
import { useAuth } from "@/lib/auth/AuthProvider";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoAccount } from "@/lib/auth/demoAccounts";
import { portalForRole, roleLabel } from "@/lib/auth/rolePortals";
import { cn } from "@/lib/utils";

/** Direct sign-in buttons for every seeded demo role. */
export function RoleQuickLogin({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const { setUser } = useAuth();

  async function signInAs(account: DemoAccount) {
    setPendingRole(account.role);
    try {
      await login(account.email, DEMO_PASSWORD);
      const profile = await getMe();
      setUser(profile);
      toast.success(`Signed in as ${roleLabel(profile.role)}`);
      await navigate({ to: portalForRole(profile.role) });
    } catch (err: unknown) {
      toast.error(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : `Could not sign in as ${roleLabel(account.role)}. Is the backend running and seeded?`,
      );
      setPendingRole(null);
    }
  }

  return (
    <section
      className={cn("rounded-lg border border-dashed bg-muted/40", className)}
      aria-label="Demo dashboard access"
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <span className="flex items-center gap-2">
          <KeyRound className="size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="block text-sm font-semibold">Open a dashboard</span>
            <span className="block text-xs text-muted-foreground">
              Choose a role to sign in instantly
            </span>
          </span>
        </span>
        <Badge variant="outline">Demo</Badge>
      </div>

      <div className="px-4 pt-3 pb-4">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => {
            const busy = pendingRole === account.role;
            return (
              <li key={account.role}>
                <button
                  type="button"
                  disabled={pendingRole !== null}
                  onClick={() => signInAs(account)}
                  aria-label={`Sign in as ${roleLabel(account.role)}`}
                  className="group flex w-full flex-col gap-1 rounded-md border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex items-center gap-2">
                    {busy ? (
                      <Loader2
                        className="size-3.5 shrink-0 animate-spin text-primary"
                        aria-hidden
                      />
                    ) : (
                      <LogIn
                        className="size-3.5 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      />
                    )}
                    <span className="text-sm font-medium">{roleLabel(account.role)}</span>
                  </span>
                  <span className="pl-[1.375rem] text-[11px] leading-snug text-muted-foreground">
                    {account.blurb}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
          <span>
            Demo accounts use a shared development password and are provisioned by
            <code className="ml-1 font-mono">backend/scripts/seed_demo_roles.py</code>. Hide this
            panel with <code className="ml-1 font-mono">VITE_DEMO_LOGIN=false</code>.
          </span>
        </p>
      </div>
    </section>
  );
}
