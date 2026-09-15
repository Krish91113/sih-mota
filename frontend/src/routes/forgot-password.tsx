import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell } from "@/components/mota/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { forgotPassword } from "@/api/auth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Reset Password | MoTA Scholarship Portal" }],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Enter the email address registered with your account.");
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Unable to send the verification email.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-md">
        <Card className="shadow-lift">
          <CardContent className="p-6 sm:p-8">
            {sent ? (
              <div className="text-center">
                <span className="rounded-full bg-leaf/10 p-4 text-leaf">
                  <CheckCircle2 className="size-10" aria-hidden />
                </span>
                <h1 className="mt-5 text-2xl">Reset link and OTP sent</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  We have sent a one-time password to your registered email. The code is valid for 5
                  minutes.
                </p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button asChild>
                    <Link to="/otp-verify" search={{ to: "password-reset", email }}>
                      Enter OTP to reset
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/login">Back to login</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="eyebrow">Account recovery</p>
                <h1 className="mt-2 text-2xl md:text-3xl">Forgot your password?</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter the email address linked to your account. We will send a verification OTP.
                </p>
                <form className="mt-6 space-y-4" onSubmit={submit}>
                  <div>
                    <Label htmlFor="f-email">Registered email address</Label>
                    <Input
                      id="f-email"
                      className="mt-2"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Sending…" : "Send reset instructions"}
                  </Button>
                  <p className="text-center text-sm">
                    <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                      Back to login
                    </Link>
                  </p>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthShell>
  );
}
