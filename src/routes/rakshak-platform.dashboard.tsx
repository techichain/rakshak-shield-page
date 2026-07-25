import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";

export const Route = createFileRoute("/rakshak-platform/dashboard")({
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const navigate = useNavigate();
  const {
    loading,
    userId,
    email,
    roles,
    isAdmin,
    isMentor,
    isTeam,
    isTeamLeader,
    isTeamMember,
    isEvaluator,
    isAuthority,
    isFinance,
  } = useRPAuth();

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (isAdmin) { navigate({ to: "/rakshak-platform/admin" }); return; }
    if (isMentor) { navigate({ to: "/rakshak-platform/mentor" }); return; }
    if (isTeamLeader) { navigate({ to: "/rakshak-platform/team" }); return; }
    if (isTeamMember) { navigate({ to: "/rakshak-platform/member" }); return; }
    if (isTeam) { navigate({ to: "/rakshak-platform/team" }); return; }
    if (isEvaluator) { navigate({ to: "/rakshak-platform/evaluator" }); return; }
    if (isAuthority) { navigate({ to: "/rakshak-platform/authority" }); return; }
    if (isFinance) { navigate({ to: "/rakshak-platform/admin" }); return; }
  }, [loading, userId, isAdmin, isMentor, isTeam, isTeamLeader, isTeamMember, isEvaluator, isAuthority, isFinance, navigate]);

  const noRoleYet = !loading && !!userId && roles.length === 0;


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
        ) : noRoleYet ? (
          <div className="mx-auto max-w-md space-y-4">
            <Eyebrow>No workspace assigned</Eyebrow>
            <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight">
              Your account has no <span className="text-brand">role</span> yet.
            </h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {email}. Access on Project Rakshak is issued by the CFI admin team — teams,
              leaders, members, mentors and evaluators are all set up centrally. Please contact your
              programme admin to have your role assigned to this login.
            </p>
            <Link
              to="/rakshak-platform"
              className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
            >
              Back to platform home
            </Link>
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
