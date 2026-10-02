import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";

export const Route = createFileRoute("/forbidden")({
  head: () => ({
    meta: [{ title: "Access Restricted | MoTA Scholarship Portal" }],
  }),
  component: Forbidden,
});

function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-lift">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldX className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl">403 — Not authorized</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have permission to view this screen. Every action is validated
          against your role and assigned scope; this restriction cannot be bypassed from the
          browser.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild>
            <Link to="/portal">Go to my portal</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/contact">Contact helpdesk</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
