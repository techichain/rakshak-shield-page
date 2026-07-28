import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { resolveLoginIdToEmail } from "@/lib/rakshak-platform/admin-credentials.functions";

const searchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/rakshak-platform/auth/")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  component: AuthPage,
});

// Only allow same-origin relative paths. Reject protocol-relative "//host"
// and Windows-style "/\host" which browsers may treat as external.
function safeRedirect(r: string | undefined): string {
  if (!r) return "/rakshak-platform/dashboard";
  if (!r.startsWith("/")) return "/rakshak-platform/dashboard";
  if (r.startsWith("//") || r.startsWith("/\\")) return "/rakshak-platform/dashboard";
  return r;
}


function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const resolveLoginId = useServerFn(resolveLoginIdToEmail);

  const [mode, setMode] = useState<"login_id" | "email">("login_id");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already signed in, bounce to dashboard (or redirect target).
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      const target = safeRedirect(redirect);
      navigate({ to: target, replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [redirect, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = identifier.trim();
    if (!value || !password) {
      setError(
        mode === "email"
          ? "Enter your email and password."
          : "Enter your login ID and password.",
      );
      return;
    }
    setBusy(true);
    try {
      let email = value;
      if (mode === "login_id") {
        const r: any = await resolveLoginId({ data: { login_id: value } });
        if (!r?.email) {
          setError("Login ID not recognized.");
          return;
        }
        email = r.email;
      }
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr) throw signErr;
      const target = safeRedirect(redirect);
      navigate({ to: target });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlatformShell>
      <Section>
        <div className="mx-auto max-w-md">
          <Eyebrow>Welcome back</Eyebrow>
          <h1 className="mt-6 font-heading text-4xl font-bold leading-tight tracking-tight">
            Sign in to your <span className="text-brand">workspace.</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {mode === "login_id"
              ? "Use the login ID and password issued to you by your programme admin."
              : "Sign in with the email address linked to your account."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <Field label={mode === "login_id" ? "Login ID" : "Email"}>
              <input
                required
                autoFocus
                type={mode === "login_id" ? "text" : "email"}
                autoComplete={mode === "login_id" ? "username" : "email"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={mode === "login_id" ? "priya.sharma.iitd" : "you@example.com"}
                className="w-full h-11 rounded-xl border border-border bg-card px-4 text-sm focus:outline-none focus:border-brand"
              />
            </Field>
            <Field label="Password">
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 rounded-xl border border-border bg-card px-4 text-sm focus:outline-none focus:border-brand"
              />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-full bg-brand text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login_id" ? "email" : "login_id");
                  setIdentifier("");
                  setError(null);
                }}
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-brand"
              >
                {mode === "login_id" ? "Or sign in with email" : "Back to login ID sign-in"}
              </button>
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Forgot your password? Contact your programme admin to reset it.
            </p>
          </form>
        </div>
      </Section>
    </PlatformShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium tracking-[0.2em] text-muted-foreground mb-2">
        {label.toUpperCase()}
      </span>
      {children}
    </label>
  );
}
