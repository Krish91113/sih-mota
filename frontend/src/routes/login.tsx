import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthShell } from "@/components/mota/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, LogIn, Phone, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useLoginMutation } from "@/hooks/api/useAuth";
import { requestOtp } from "@/api/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login | MoTA Scholarship & Fellowship Portal" },
      {
        name: "description",
        content: "Sign in to the MoTA scholarship and fellowship portal as an applicant or staff.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<"otp" | "password">("otp");
  const [login, setLogin] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const loginMutation = useLoginMutation();

  /** Map backend role to the portal route */
  function portalForRole(role: string): string {
    switch (role) {
      case "SUPER_ADMIN":
      case "SCHEME_MANAGER":
        return "/admin";
      case "VERIFICATION_OFFICER":
      case "SCRUTINY_OFFICER":
      case "GRIEVANCE_OFFICER":
      case "HELPDESK_AGENT":
        return "/officer";
      case "APPROVING_AUTHORITY":
        return "/approval";
      case "FINANCE_OFFICER":
        return "/finance";
      case "COMMITTEE_MEMBER":
      case "SELECTION_COMMITTEE_MEMBER":
        return "/committee";
      case "INSTITUTION_NODAL":
      case "INSTITUTION_NODAL_OFFICER":
        return "/institution";
      case "AUDITOR":
      case "MONITORING_ANALYST":
        return "/analytics";
      default:
        return "/portal";
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (login.trim().length === 0 || !login.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (method === "password" && !password) {
      setError("Please enter your password.");
      return;
    }

    if (method === "otp") {
      try {
        await requestOtp(login.trim().toLowerCase(), "login");
        toast.success("A verification code was sent to your email");
        navigate({
          to: "/otp-verify",
          search: { to: "portal", email: login.trim().toLowerCase() },
        });
      } catch (err: unknown) {
        setError(
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Unable to send the verification email.",
        );
      }
      return;
    }

    // Password login — call real backend
    try {
      await loginMutation.mutateAsync({
        email: login.trim().toLowerCase(),
        password,
      });
      toast.success("Signed in successfully");
      // Get user profile to determine portal
      const { getMe } = await import("@/api/auth");
      const profile = await getMe();
      navigate({ to: portalForRole(profile.role) });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Login failed. Please check your credentials.";
      setError(msg);
    }
  };

  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-md">
        <Card className="shadow-lift">
          <CardContent className="p-6 sm:p-8">
            <p className="eyebrow">Sign in</p>
            <h1 className="mt-2 text-2xl md:text-3xl">Login to your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in with your registered email address. Staff and officers are automatically
              routed to their respective workspace.
            </p>

            <div
              className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
              role="tablist"
              aria-label="Sign-in method"
            >
              <button
                type="button"
                role="tab"
                aria-selected={method === "password"}
                onClick={() => setMethod("password")}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${method === "password" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Password
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={method === "otp"}
                onClick={() => setMethod("otp")}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${method === "otp" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Email OTP
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
              <div>
                <Label htmlFor="login-id">Email address</Label>
                <Input
                  id="login-id"
                  type="email"
                  className="mt-2"
                  placeholder="name@example.com or admin@mota.gov.in"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  autoComplete="email"
                  aria-invalid={!!error}
                />
              </div>

              {method === "otp" ? (
                <p className="text-xs text-muted-foreground">
                  A 6-digit verification code will be sent to your email address via SMTP relay.
                </p>
              ) : (
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    className="mt-2"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
              )}

              {error ? (
                <p
                  role="alert"
                  className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                >
                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> {error}
                </p>
              ) : null}

              <label className="flex items-center gap-2 text-sm">
                <Checkbox defaultChecked />
                Keep me signed in on this device
              </label>

              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                <LogIn className="size-4" aria-hidden />{" "}
                {loginMutation.isPending
                  ? "Signing in…"
                  : method === "otp"
                    ? "Send OTP to email"
                    : "Sign in"}
              </Button>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
              <Link
                to="/forgot-password"
                className="text-primary underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
              <p className="text-muted-foreground">
                New applicant?{" "}
                <Link
                  to="/register"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Register here
                </Link>
              </p>
            </div>

            <div className="mt-6 flex items-start gap-2 rounded-lg border bg-accent/40 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p>
                Staff accounts additionally require multi-factor authentication. A fresh OTP is
                prompted before sensitive actions such as final submission or bank changes.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthShell>
  );
}
