import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";

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

function AuthPage() {
  const { mode, role } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setMode = (m: "login" | "register") =>
    navigate({ to: "/rakshak-platform/auth", search: { mode: m, role } });
  const setRole = (r: typeof role) =>
    navigate({ to: "/rakshak-platform/auth", search: { mode, role: r } });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/rakshak-platform/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: fullName, rp_role: role },
            emailRedirectTo: `${window.location.origin}/rakshak-platform/dashboard`,
          },
        });
        if (error) throw error;
        const userId = data.user?.id;
        const dbRole = ROLE_OPTIONS.find((r) => r.value === role)?.dbRole ?? "team_leader";
        if (userId) {
          await supabase.from("rp_profiles").upsert({ id: userId, full_name: fullName, email });
          await supabase.from("rp_user_roles").insert({ user_id: userId, role: dbRole });
          if (role === "mentor") {
            await supabase.from("rp_mentors").insert({ profile_id: userId });
          }
        }
        if (data.session) {
          navigate({ to: "/rakshak-platform/dashboard" });
        } else {
          setError("Account created. Please check your email to confirm, then sign in.");
          setMode("login");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlatformShell>
      <Section>
        <div className="mx-auto max-w-md">
          <Eyebrow>{mode === "login" ? "Welcome back" : "Join Project Rakshak"}</Eyebrow>
          <h1 className="mt-6 font-heading text-4xl font-bold leading-tight tracking-tight">
            {mode === "login" ? (
              <>Sign in to your <span className="text-brand">workspace.</span></>
            ) : (
              <>Create your <span className="text-brand">account.</span></>
            )}
          </h1>

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

          {mode === "register" && (
            <div className="mt-4 inline-flex rounded-full border border-border p-1 text-xs ml-3">
              <button
                onClick={() => setRole("team")}
                className={`px-3 py-1 rounded-full transition ${role === "team" ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >As team lead</button>
              <button
                onClick={() => setRole("mentor")}
                className={`px-3 py-1 rounded-full transition ${role === "mentor" ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >As mentor</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "register" && (
              <Field label="Full name">
                <input
                  required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-card px-4 text-sm focus:outline-none focus:border-brand"
                />
              </Field>
            )}
            <Field label="Email">
              <input
                required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
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
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
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
