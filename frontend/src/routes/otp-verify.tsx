import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthShell } from "@/components/mota/AuthShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Loader, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { requestOtp, resendOtp, verifyOtp } from "@/api/auth";
import { useAuth } from "@/lib/auth/AuthProvider";

export const Route = createFileRoute("/otp-verify")({
  validateSearch: (search: Record<string, unknown>) => ({
    to: typeof search["to"] === "string" ? search["to"] : "portal",
    email: typeof search["email"] === "string" ? search["email"] : "",
  }),
  head: () => ({
    meta: [{ title: "Verify OTP | MoTA Scholarship Portal" }],
  }),
  component: OtpVerify,
});

function OtpVerify() {
  const { to, email } = Route.useSearch();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(120);
  const [verified, setVerified] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const t = window.setInterval(() => setCount((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, []);

  const mm = String(Math.floor(count / 60)).padStart(2, "0");
  const ss = String(count % 60).padStart(2, "0");

  const code = digits.join("");
  const complete = code.length === 6;

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    const next = [...digits];
    if (clean.length > 1) {
      clean
        .split("")
        .slice(0, 6)
        .forEach((c, j) => {
          next[j] = c;
        });
      setDigits(next);
      inputs.current[Math.min(5, clean.length)]?.focus();
      return;
    }
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!email) {
      setError("The verification email is missing. Please return to login and try again.");
      return;
    }
    if (!complete) {
      setError("Enter all six digits of the OTP.");
      return;
    }
    setLoading(true);
    try {
      const purpose =
        to === "register" ? "registration" : to === "password-reset" ? "password_reset" : "login";
      await verifyOtp(email, code, purpose);
      await refreshUser();
      setVerified(true);
      toast.success(
        to === "register"
          ? "Account created — welcome!"
          : to === "password-reset"
            ? "Email verified"
            : "Signed in successfully",
      );
      if (to === "password-reset") {
        window.setTimeout(() => navigate({ to: "/reset-password" }), 900);
      } else {
        const { getMe } = await import("@/api/auth");
        const profile = await getMe().catch(() => null);
        const role = profile?.role || "APPLICANT";
        let target = "/portal";
        if (role === "SUPER_ADMIN" || role === "SCHEME_MANAGER") target = "/admin";
        else if (
          role === "VERIFICATION_OFFICER" ||
          role === "SCRUTINY_OFFICER" ||
          role === "GRIEVANCE_OFFICER"
        )
          target = "/officer";
        else if (role === "APPROVING_AUTHORITY") target = "/approval";
        else if (role === "FINANCE_OFFICER") target = "/finance";
        else if (role === "COMMITTEE_MEMBER" || role === "SELECTION_COMMITTEE_MEMBER")
          target = "/committee";
        else if (role === "INSTITUTION_NODAL" || role === "INSTITUTION_NODAL_OFFICER")
          target = "/institution";
        else if (role === "AUDITOR" || role === "MONITORING_ANALYST") target = "/analytics";

        window.setTimeout(() => navigate({ to: target }), 900);
      }
    } catch (err: unknown) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "That OTP is not correct, or it has expired.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <AuthShell>
        <div className="mx-auto w-full max-w-md">
          <Card className="shadow-lift">
            <CardContent className="flex flex-col items-center p-8 text-center">
              <span className="rounded-full bg-leaf/10 p-4 text-leaf">
                <CheckCircle2 className="size-10" aria-hidden />
              </span>
              <h1 className="mt-5 text-2xl">Identity verified</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {to === "register"
                  ? "Your account is ready. Continue to your portal."
                  : "You are now signed in securely."}
              </p>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader className="size-3.5 animate-spin" aria-hidden /> Taking you to your portal…
              </p>
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
            <p className="eyebrow">Security check</p>
            <h1 className="mt-2 text-2xl md:text-3xl">Enter the one-time password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A 6-digit OTP was sent to{" "}
              <span className="font-medium text-foreground">
                {email || "your registered email"}
              </span>
              .
            </p>

            <form className="mt-7 space-y-5" onSubmit={submit}>
              <div
                role="group"
                aria-label="One-time password"
                className="flex justify-between gap-2"
              >
                {digits.map((d, i) => (
                  <Input
                    key={i}
                    ref={(el) => {
                      inputs.current[i] = el;
                    }}
                    value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKey(i, e)}
                    inputMode="numeric"
                    maxLength={6}
                    aria-label={`Digit ${i + 1}`}
                    aria-describedby="otp-help"
                    className="h-12 w-11 text-center text-lg font-semibold tabular-nums"
                  />
                ))}
              </div>
              <p id="otp-help" className="text-xs text-muted-foreground">
                The code expires in {mm}:{ss}. Resend a fresh code by email if it lapses.
              </p>

              {error ? (
                <p
                  role="alert"
                  className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                >
                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading || !complete}>
                {loading ? "Verifying…" : "Verify & continue"}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  disabled={count > 0}
                  onClick={async () => {
                    if (!email) return;
                    try {
                      const purpose =
                        to === "register"
                          ? "registration"
                          : to === "password-reset"
                            ? "password_reset"
                            : "login";
                      await resendOtp(email, purpose);
                      setCount(120);
                      setDigits(["", "", "", "", "", ""]);
                      inputs.current[0]?.focus();
                      toast.info("A new verification code has been sent to your email");
                    } catch (err: unknown) {
                      setError(
                        err && typeof err === "object" && "message" in err
                          ? String((err as { message: string }).message)
                          : "Unable to resend the verification email.",
                      );
                    }
                  }}
                  className="font-medium text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                >
                  Resend OTP {count > 0 ? `(${mm}:${ss})` : ""}
                </button>
                <Link
                  to="/login"
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  Change number
                </Link>
              </div>
            </form>

            <div className="mt-6 flex items-start gap-2 rounded-lg border bg-accent/40 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p>
                Your OTP is used only to verify this account action. For your safety, never share it
                — even with someone claiming to be from the helpdesk.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthShell>
  );
}
