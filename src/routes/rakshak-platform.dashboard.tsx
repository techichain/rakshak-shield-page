import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { onboardRPWorkspace } from "@/lib/rakshak-platform/onboarding.functions";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";

export const Route = createFileRoute("/rakshak-platform/dashboard")({
  component: DashboardRedirect,
});

type RoleChoice = "team" | "mentor" | "evaluator";

function DashboardRedirect() {
  const navigate = useNavigate();
  const onboardWorkspace = useServerFn(onboardRPWorkspace);
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
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [pendingChecked, setPendingChecked] = useState(false);

  useEffect(() => {
    if (loading || !userId) { setPendingChecked(true); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("rp_role_approvals")
        .select("requested_role,status")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setPendingRole((data?.requested_role as string) ?? null);
      setPendingChecked(true);
    })();
    return () => { cancelled = true; };
  }, [loading, userId]);

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
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Your sign-in session expired. Please sign in again.");
      const result = await onboardWorkspace({
        data: { role: picking, accessToken, fullName, email },
      });
      if (result.status === "pending_approval") {
        setError("Evaluator access requested. A CFI admin will review it shortly.");
      } else {
        navigate({ to: result.redirectTo });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign role.");
    } finally {
      setBusy(false);
    }
  }

  const noRoleYet = !loading && pendingChecked && !!userId && roles.length === 0 && !pendingRole;
  const awaitingApproval = !loading && pendingChecked && !!userId && roles.length === 0 && !!pendingRole;

  return (
    <PlatformShell>
      <Section>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading your workspace…</p>
        ) : !userId ? (
          <div className="mx-auto max-w-md space-y-4">
            <Eyebrow>Sign in required</Eyebrow>
            <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight">
              Open your <span className="text-brand">workspace.</span>
            </h1>
            <Link
              to="/rakshak-platform/auth"
              className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
            >
              Sign in
            </Link>
          </div>
        ) : awaitingApproval ? (
          <div className="mx-auto max-w-md space-y-4">
            <Eyebrow>Awaiting approval</Eyebrow>
            <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight">
              Your <span className="text-brand">{pendingRole}</span> access is pending.
            </h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {email}. A CFI admin needs to approve your {pendingRole} role before your workspace unlocks. You'll get access here as soon as it's approved.
            </p>
            <Link
              to="/rakshak-platform"
              className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
            >
              Back to platform home
            </Link>
          </div>
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
          <div className="mx-auto max-w-md space-y-4">
            <Eyebrow>Workspace access</Eyebrow>
            <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight">
              Your role is <span className="text-brand">active.</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {email}. Your assigned role is {roles.join(", ")}, but this role does not have a dedicated workspace yet.
            </p>
            <Link
              to="/rakshak-platform"
              className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
            >
              Go to platform home
            </Link>
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
