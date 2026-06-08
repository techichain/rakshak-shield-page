import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section } from "@/components/rakshak-platform/Shell";

export const Route = createFileRoute("/rakshak-platform/dashboard")({
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const navigate = useNavigate();
  const { loading, userId, isAdmin, isMentor, isTeam } = useRPAuth();

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (isAdmin) { navigate({ to: "/rakshak-platform/admin" }); return; }
    if (isMentor) { navigate({ to: "/rakshak-platform/mentor" }); return; }
    if (isTeam) { navigate({ to: "/rakshak-platform/team" }); return; }
  }, [loading, userId, isAdmin, isMentor, isTeam, navigate]);

  return (
    <PlatformShell>
      <Section>
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </Section>
    </PlatformShell>
  );
}
