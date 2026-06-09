import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { supabase } from "@/integrations/supabase/client";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";

export const Route = createFileRoute("/rakshak-platform/dashboard")({
  component: DashboardRedirect,
});

type RoleChoice = "team" | "mentor" | "evaluator";

function DashboardRedirect() {
  const navigate = useNavigate();
  const {
    loading,
    userId,
    email,
    fullName,
    roles,
    isAdmin,
    isMentor,
    isTeam,
    isEvaluator,
    isAuthority,
    isFinance,
  } = useRPAuth();

  const [picking, setPicking] = useState<RoleChoice>("team");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (isAdmin) { navigate({ to: "/rakshak-platform/admin" }); return; }
    if (isMentor) { navigate({ to: "/rakshak-platform/mentor" }); return; }
    if (isTeam) { navigate({ to: "/rakshak-platform/team" }); return; }
    if (isEvaluator) { navigate({ to: "/rakshak-platform/evaluator" }); return; }
    if (isAuthority) { navigate({ to: "/rakshak-platform/authority" }); return; }
    if (isFinance) { navigate({ to: "/rakshak-platform/admin/finance" }); return; }
  }, [loading, userId, isAdmin, isMentor, isTeam, isEvaluator, isAuthority, isFinance, navigate]);

  async function chooseRole() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      if (picking === "evaluator") {
        const { error: e } = await supabase.from("rp_role_approvals").insert({
          user_id: userId,
          requested_role: "evaluator",
          status: "pending",
          notes: "Self-requested evaluator access after Google sign-in.",
        });
        if (e) throw e;
        setError("Evaluator access requested. A CFI admin will review it shortly.");
      } else {
        const dbRole = picking === "mentor" ? "mentor" : "team_leader";
        const { error: profileError } = await supabase
          .from("rp_profiles")
          .upsert({ id: userId, full_name: fullName ?? email ?? "Project Rakshak user", email: email ?? "" });
        if (profileError) throw profileError;

        const { error: e } = await supabase
          .from("rp_user_roles")
          .upsert({ user_id: userId, role: dbRole }, { onConflict: "user_id,role" });
        if (e) throw e;
        if (picking === "mentor") {
          const { error: mentorError } = await supabase
            .from("rp_mentors")
            .upsert({ profile_id: userId }, { onConflict: "profile_id" });
          if (mentorError) throw mentorError;
        }
        // Auth state listener in useRPAuth will refresh; force-navigate too.
        navigate({
          to: picking === "mentor" ? "/rakshak-platform/mentor" : "/rakshak-platform/team",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign role.");
    } finally {
      setBusy(false);
    }
  }

  const noRoleYet =
    !loading && userId && roles.length === 0;

  return (
    <PlatformShell>
      <Section>
        {loading || !userId ? (
          <p className="text-sm text-muted-foreground">Loading your workspace…</p>
        ) : noRoleYet ? (
          <div className="mx-auto max-w-md">
            <Eyebrow>One last step</Eyebrow>
            <h1 className="mt-6 font-heading text-3xl font-bold leading-tight tracking-tight">
              Pick your <span className="text-brand">workspace.</span>
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Signed in as {email}. Choose how you'll use Project Rakshak so we can take you to the right dashboard.
            </p>
            <div className="mt-6 grid gap-2">
              {(
                [
                  { v: "team", label: "Team lead", desc: "Lead a youth team running audits." },
                  { v: "mentor", label: "Mentor", desc: "Guide a team through the programme." },
                  { v: "evaluator", label: "Evaluator", desc: "Review submissions (requires admin approval)." },
                ] as { v: RoleChoice; label: string; desc: string }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setPicking(opt.v)}
                  className={`text-left rounded-xl border p-4 transition ${
                    picking === opt.v
                      ? "border-brand bg-brand/5"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  <div className="text-sm font-semibold">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={chooseRole}
              disabled={busy}
              className="mt-6 h-12 w-full rounded-full bg-brand text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              {busy ? "Setting up…" : "Continue"}
            </button>
            <p className="mt-4 text-xs text-muted-foreground">
              Need a different role?{" "}
              <Link to="/rakshak-platform" className="underline">
                Back to home
              </Link>
              .
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading your workspace…</p>
        )}
      </Section>
    </PlatformShell>
  );
}
