import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { TimerOff, ShieldCheck, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/session-expired")({
  head: () => ({
    meta: [{ title: "Session Expired | MoTA Scholarship Portal" }],
  }),
  component: SessionExpired,
});

function SessionExpired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-lift">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-warn/15 text-warn">
          <TimerOff className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl">Your session has expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The session timed out after a period of inactivity. Any draft you were working on has been
          saved in the portal.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild>
            <Link to="/login">Sign in again</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Go to public portal</Link>
          </Button>
        </div>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-leaf" aria-hidden /> No application data was left
          behind.
        </p>
      </div>
    </div>
  );
}

export const ForbiddenHint = () => (
  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
    <AlertTriangle className="size-3.5" aria-hidden /> Access is limited to your assigned role and
    scope.
  </p>
);
