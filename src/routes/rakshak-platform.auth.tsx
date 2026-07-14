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

export const Route = createFileRoute("/rakshak-platform/auth")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const resolveLoginId = useServerFn(resolveLoginIdToEmail);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already signed in, bounce to dashboard (or redirect target).
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      const target = (redirect && redirect.startsWith("/")) ? redirect : "/rakshak-platform/dashboard";
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
      setError("Enter your login ID or email and password.");
      return;
    }
    setBusy(true);
    try {
      let email = value;
      if (!value.includes("@")) {
        const r: any = await resolveLoginId({ data: { login_id: value } });
        if (!r?.email) {
          setError("No account found for that login ID — check with your admin.");
          return;
        }
        email = r.email;
      }
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr) throw signErr;
      const target = (redirect && redirect.startsWith("/")) ? redirect : "/rakshak-platform/dashboard";
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
            Use the login ID and password issued to you by your programme admin. If you registered
            with a real email, you can sign in with that email instead.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <Field label="Login ID or email">
              <input
                required
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="TL0001 or you@example.com"
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
