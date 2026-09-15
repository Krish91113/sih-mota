import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthShell } from "@/components/mota/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { changePassword } from "@/api/auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Set a New Password | MoTA Scholarship Portal" }],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError(undefined);
    try {
      await changePassword(password);
      setDone(true);
      toast.success("Password updated");
    } catch (err: unknown) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Unable to update your password.",
      );
    }
  };

  if (done) {
    return (
      <AuthShell>
        <div className="mx-auto w-full max-w-md">
          <Card className="shadow-lift">
            <CardContent className="flex flex-col items-center p-8 text-center">
              <span className="rounded-full bg-leaf/10 p-4 text-leaf">
                <CheckCircle2 className="size-10" aria-hidden />
              </span>
              <h1 className="mt-5 text-2xl">Password updated</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your password has been changed. Use the new password next time you sign in.
              </p>
              <Button asChild className="mt-6">
                <Link to="/login">Go to login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-md">
        <Card className="shadow-lift">
          <CardContent className="p-6 sm:p-8">
            <p className="eyebrow">Account recovery</p>
            <h1 className="mt-2 text-2xl md:text-3xl">Set a new password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose a strong password you haven't used before on this portal.
            </p>
            <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
              <div>
                <Label htmlFor="np">New password</Label>
                <div className="relative mt-2">
                  <Input
                    id="np"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground"
                  >
                    {show ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Minimum 8 characters with at least one letter and one number.
                </p>
              </div>
              <div>
                <Label htmlFor="npc">Confirm new password</Label>
                <Input
                  id="npc"
                  type="password"
                  className="mt-2"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              {error ? (
                <p
                  role="alert"
                  className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                >
                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full">
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AuthShell>
  );
}
