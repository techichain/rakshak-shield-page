import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { Captcha } from "@/components/rakshak-platform/Captcha";
import { verifyEmailDeliverable } from "@/lib/rakshak-platform/email-verify.functions";

const ROLE_OPTIONS = [
  { value: "team", label: "Team lead", dbRole: "team_leader" as const },
  { value: "mentor", label: "Mentor", dbRole: "mentor" as const },
  { value: "evaluator", label: "Evaluator", dbRole: "evaluator" as const },
  { value: "admin", label: "CFI Admin", dbRole: "cfi_admin" as const },
];

const searchSchema = z.object({
  mode: z.enum(["login", "register"]).default("login").catch("login"),
  role: z.enum(["team", "mentor", "evaluator", "admin"]).default("team").catch("team"),
});

export const Route = createFileRoute("/rakshak-platform/auth")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  component: AuthPage,
});

type Step = "email" | "otp" | "details";

function AuthPage() {
  const { mode, role } = Route.useSearch();
  const navigate = useNavigate();
  const verifyEmail = useServerFn(verifyEmailDeliverable);

  // Flow state
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Captcha
  const [captcha, setCaptcha] = useState("");
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const expectedCaptcha = useRef<number>(0);

  function resetFlow() {
    setStep("email");
    setOtpCode("");
    setPassword("");
    setFullName("");
    setInfo(null);
    setError(null);
  }

  const setMode = (m: "login" | "register") => {
    resetFlow();
    navigate({ to: "/rakshak-platform/auth", search: { mode: m, role } });
  };
  async function handleGoogleSignIn() {
    setError(null);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/rakshak-platform/dashboard",
      });
      if (result.error) throw result.error;
      if (result.redirected) {
        // Browser will redirect — flow continues on Google
        return;
      }
      // Tokens received and session set — user is authenticated
      navigate({ to: "/rakshak-platform/dashboard" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  const setRole = (r: typeof role) =>
    navigate({ to: "/rakshak-platform/auth", search: { mode, role: r } });

  function checkCaptcha(): boolean {
    const parsed = Number.parseInt(captcha.trim(), 10);
    if (!Number.isFinite(parsed) || parsed !== expectedCaptcha.current) {
      setCaptchaError("Incorrect answer. Please solve the new challenge.");
      return false;
    }
    return true;
  }

  // STEP 1 — send OTP to the entered email
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setCaptchaError(null);
    if (!checkCaptcha()) return;

    setBusy(true);
    try {
      const check = await verifyEmail({ data: { email } });
      if (!check.ok) {
        setError(check.reason);
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Register flow creates the user on successful OTP verification.
          // Login flow requires the account to already exist.
          shouldCreateUser: mode === "register",
          emailRedirectTo: `${window.location.origin}/rakshak-platform/dashboard`,
        },
      });
      if (error) throw error;
      setStep("otp");
      setInfo(`We've emailed a 6-digit verification code to ${email}. It expires in 10 minutes.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code.");
    } finally {
      setBusy(false);
    }
  }

  // STEP 2 — verify the code. On success: login → dashboard; register → details step.
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const token = otpCode.trim();
      if (!/^\d{6}$/.test(token)) {
        setError("Enter the 6-digit code from your email.");
        return;
      }
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (error) throw error;

      if (mode === "login") {
        navigate({ to: "/rakshak-platform/dashboard" });
      } else {
        // User is now created & signed in via OTP — finish onboarding.
        setStep("details");
        setInfo("Email verified. Set a password and finish creating your account.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  }

  // STEP 3 (register only) — set password, profile, role.
  async function handleCompleteRegistration(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      const { data: userRes, error: updErr } = await supabase.auth.updateUser({
        password,
        data: { name: fullName, rp_role: role },
      });
      if (updErr) throw updErr;
      const userId = userRes.user?.id;
      const dbRole = ROLE_OPTIONS.find((r) => r.value === role)?.dbRole ?? "team_leader";

      if (userId) {
        await supabase.from("rp_profiles").upsert({ id: userId, full_name: fullName, email });
        if (role === "evaluator" || role === "admin") {
          await supabase.from("rp_role_approvals").insert({
            user_id: userId,
            requested_role: dbRole,
            status: "pending",
            notes: `Self-requested ${dbRole} access at sign-up.`,
          });
        } else {
          await supabase.from("rp_user_roles").insert({ user_id: userId, role: dbRole });
          if (role === "mentor") {
            await supabase.from("rp_mentors").insert({ profile_id: userId });
          }
        }
      }

      if (role === "evaluator" || role === "admin") {
        await supabase.auth.signOut();
        setError(
          `Account created. Your ${role === "admin" ? "CFI Admin" : "Evaluator"} access request is pending super-admin approval.`,
        );
        setMode("login");
      } else {
        navigate({ to: "/rakshak-platform/dashboard" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish registration.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: mode === "register",
          emailRedirectTo: `${window.location.origin}/rakshak-platform/dashboard`,
        },
      });
      if (error) throw error;
      setInfo(`New code sent to ${email}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlatformShell>
      <Section>
        <div className="mx-auto max-w-md">
          <Eyebrow>
            {step === "details"
              ? "Almost there"
              : step === "otp"
                ? "Check your email"
                : mode === "login"
                  ? "Welcome back"
                  : "Join Project Rakshak"}
          </Eyebrow>
          <h1 className="mt-6 font-heading text-4xl font-bold leading-tight tracking-tight">
            {step === "details" ? (
              <>Set your <span className="text-brand">password.</span></>
            ) : step === "otp" ? (
              <>Verify your <span className="text-brand">email.</span></>
            ) : mode === "login" ? (
              <>Sign in to your <span className="text-brand">workspace.</span></>
            ) : (
              <>Create your <span className="text-brand">account.</span></>
            )}
          </h1>

          {step === "email" && (
            <div className="mt-8 inline-flex rounded-full border border-border p-1 text-sm">
              <button
                onClick={() => setMode("login")}
                className={`px-4 py-1.5 rounded-full transition ${mode === "login" ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}
              >Sign in</button>
              <button
                onClick={() => setMode("register")}
                className={`px-4 py-1.5 rounded-full transition ${mode === "register" ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}
              >Register</button>
            </div>
          )}

          {step === "email" && mode === "register" && (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value as typeof role)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${role === opt.value ? "bg-foreground text-background border-foreground" : "text-muted-foreground border-border hover:border-foreground/40"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {(role === "evaluator" || role === "admin") && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {role === "admin"
                    ? "CFI Admin accounts require approval. Your account will be created but access may be limited until a super admin verifies it."
                    : "Evaluator accounts are granted rubric and submission review access. A CFI admin may need to assign you to a cohort."}
                </p>
              )}
            </>
          )}

          {step === "email" && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={busy}
                className="mt-8 h-12 w-full rounded-full border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 inline-flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </button>

              <div className="mt-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">or continue with email</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
              <Field label="Email">
                <input
                  required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-card px-4 text-sm focus:outline-none focus:border-brand"
                />
              </Field>
              <Captcha
                value={captcha}
                onChange={setCaptcha}
                onChallenge={(n) => { expectedCaptcha.current = n; setCaptchaError(null); }}
                error={captchaError}
              />
              <p className="text-xs text-muted-foreground">
                We'll email you a 6-digit code to verify this address before {mode === "login" ? "signing in" : "creating your account"}.
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit" disabled={busy}
                className="h-12 w-full rounded-full bg-brand text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send verification code"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="mt-8 space-y-4">
              {info && <p className="text-sm text-muted-foreground">{info}</p>}
              <Field label="6-digit code">
                <input
                  required
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoFocus
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full h-12 rounded-xl border border-border bg-card px-4 text-center text-lg font-mono tracking-[0.4em] focus:outline-none focus:border-brand"
                />
              </Field>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit" disabled={busy}
                className="h-12 w-full rounded-full bg-brand text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
              >
                {busy ? "Verifying…" : mode === "login" ? "Verify and sign in" : "Verify email"}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={resetFlow}
                  className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  Use a different email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={busy}
                  className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          {step === "details" && (
            <form onSubmit={handleCompleteRegistration} className="mt-8 space-y-4">
              {info && <p className="text-sm text-green-600">{info}</p>}
              <Field label="Full name">
                <input
                  required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-card px-4 text-sm focus:outline-none focus:border-brand"
                />
              </Field>
              <Field label="Password">
                <input
                  required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-card px-4 text-sm focus:outline-none focus:border-brand"
                />
              </Field>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit" disabled={busy}
                className="h-12 w-full rounded-full bg-brand text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
              >
                {busy ? "Creating account…" : "Finish creating account"}
              </button>
            </form>
          )}
        </div>
      </Section>
    </PlatformShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium tracking-[0.2em] text-muted-foreground mb-2">{label.toUpperCase()}</span>
      {children}
    </label>
  );
}
