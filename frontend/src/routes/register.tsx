import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthShell } from "@/components/mota/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, UserPlus, Info } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useRegisterMutation } from "@/hooks/api/useAuth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register as an Applicant | MoTA Scholarship Portal" },
      {
        name: "description",
        content:
          "Create an account to apply for MoTA scholarships and fellowships for Scheduled Tribe students.",
      },
    ],
  }),
  component: Register,
});

function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const registerMutation = useRegisterMutation();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!agree) {
      setError("You must accept the terms and privacy notice to continue.");
      return;
    }
    setError(undefined);

    const normalEmail = email.trim().toLowerCase();
    try {
      await registerMutation.mutateAsync({
        email: normalEmail,
        password,
        fullName: name.trim(),
      });
      toast.success("Verification code sent to your email!");
      navigate({
        to: "/otp-verify",
        search: { to: "register", email: normalEmail },
      });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Registration failed. Please try again.";
      setError(msg);
    }
  };

  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-md">
        <Card className="shadow-lift">
          <CardContent className="p-6 sm:p-8">
            <p className="eyebrow">Create account</p>
            <h1 className="mt-2 text-2xl md:text-3xl">Register as an applicant</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              One account lets you apply, upload documents and track every application.
            </p>

            <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
              <div>
                <Label htmlFor="reg-name">Full name</Label>
                <Input
                  id="reg-name"
                  className="mt-2"
                  placeholder="As per your certificate"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div>
                <Label htmlFor="reg-email">Email address</Label>
                <Input
                  id="reg-email"
                  type="email"
                  className="mt-2"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div>
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  type="password"
                  className="mt-2"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Minimum 8 characters, including a number and a letter.
                </p>
              </div>
              <div>
                <Label htmlFor="reg-confirm">Confirm password</Label>
                <Input
                  id="reg-confirm"
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

              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={agree}
                  onCheckedChange={(c) => setAgree(c === true)}
                  className="mt-0.5"
                />
                <span>
                  I accept the{" "}
                  <Link
                    to="/guidelines"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    terms of use
                  </Link>{" "}
                  and the{" "}
                  <Link
                    to="/guidelines"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    privacy notice
                  </Link>{" "}
                  and agree that my details will be used for processing my applications.
                </span>
              </label>

              <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                <UserPlus className="size-4" aria-hidden />{" "}
                {registerMutation.isPending ? "Creating account…" : "Register & verify OTP"}
              </Button>
            </form>

            <div className="mt-5 flex items-start gap-2 rounded-lg border bg-accent/40 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p>
                No application fee is charged. Your mobile number is verified with a one-time
                password before you can submit any application.
              </p>
            </div>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Already registered?{" "}
              <Link
                to="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </AuthShell>
  );
}
