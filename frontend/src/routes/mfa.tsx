import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BadgeCheck, ShieldCheck, ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/mfa")({
  head: () => ({
    meta: [{ title: "Two-step Verification | MoTA Scholarship Portal" }],
  }),
  component: Mfa,
});

function Mfa() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [verified, setVerified] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setVerified(true);
    toast.success("Step verified — action is now active");
    window.setTimeout(() => navigate({ to: "/officer" }), 900);
  };

  if (verified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm shadow-lift">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <span className="rounded-full bg-leaf/10 p-4 text-leaf">
              <BadgeCheck className="size-10" aria-hidden />
            </span>
            <h1 className="mt-5 text-xl font-semibold">Step verified</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The sensitive action is now unlocked for this session.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm shadow-lift">
        <CardContent className="p-6 sm:p-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            <ShieldCheck className="size-4" aria-hidden /> Two-step verification
          </p>
          <h1 className="mt-3 text-2xl">Confirm it's you</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This action is marked sensitive — for example, final submission or bank details change.
            Enter the 6-digit code from your authenticator app to continue.
          </p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div>
              <Label htmlFor="mfa-code">Authenticator code</Label>
              <Input
                id="mfa-code"
                className="mt-2 text-center text-lg font-semibold tracking-[0.4em]"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
              />
            </div>
            {error ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              >
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              Verify & continue
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldAlert className="size-3.5" aria-hidden /> Never share this code with anyone.
            </p>
            <p className="text-center text-sm">
              <Link
                to="/forgot-password"
                className="text-primary underline-offset-4 hover:underline"
              >
                Lost access to authenticator?
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
