import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { PHASE_TITLES, STATUS_META } from "@/lib/rakshak-platform/constants";

export const Route = createFileRoute("/rakshak-platform/team")({
  component: TeamDashboard,
});

function TeamDashboard() {
  const navigate = useNavigate();
  const { loading, userId, isTeam } = useRPAuth();
  const [team, setTeam] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isTeam) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    (async () => {
      const { data: t } = await supabase
        .from("rp_teams")
        .select("*")
        .eq("team_leader_id", userId)
        .maybeSingle();
      setTeam(t);
      if (t) {
        const { data: p } = await supabase
          .from("rp_team_phase_progress")
          .select("*")
          .eq("team_id", t.id)
          .order("phase_number");
        setProgress(p ?? []);
      }
    })();
  }, [loading, userId, isTeam, navigate]);

  if (loading) return <PlatformShell><Section>Loading…</Section></PlatformShell>;

  if (!team) {
    return (
      <PlatformShell>
        <Section>
          <Eyebrow>My team</Eyebrow>
          <h1 className="mt-6 font-heading text-4xl font-bold leading-tight">
            No team assigned <span className="text-brand">yet.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-muted-foreground">
            You're registered as a team leader. A CFI admin will create your team and assign you a mentor.
            Once that's done your phase timeline will appear here.
          </p>
        </Section>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>My team</Eyebrow>
        <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          {team.team_name}
          <br />
          <span className="text-brand">Phase {team.current_phase} — {PHASE_TITLES[team.current_phase]}</span>
        </h1>
        <p className="mt-4 text-muted-foreground">{team.college} · {team.city}, {team.state}</p>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-7">
            <h2 className="font-heading text-xl font-semibold">Phase timeline</h2>
            <div className="mt-6 space-y-3">
              {[0,1,2,3,4].map((p) => {
                const row = progress.find((x) => x.phase_number === p);
                const meta = row ? STATUS_META[row.status as keyof typeof STATUS_META] : STATUS_META.not_started;
                return (
                  <div key={p} className={`flex items-center gap-4 p-4 rounded-xl border ${p === team.current_phase ? "border-brand bg-brand-lite" : "border-border"}`}>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-heading font-bold ${p < team.current_phase ? "bg-brand text-brand-foreground" : p === team.current_phase ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"}`}>
                      {p}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{PHASE_TITLES[p]}</div>
                      <div className="text-xs text-muted-foreground">{row?.completion_percentage ?? 0}% complete</div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${meta.tone}`}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-7">
            <h2 className="font-heading text-xl font-semibold">Next action</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Complete the Phase {team.current_phase} checklist and submit for mentor review.
            </p>
            <div className="mt-6 text-xs text-muted-foreground">Risk status</div>
            <div className="mt-1 font-semibold">{team.risk_status.replace("_"," ")}</div>
            {team.risk_reason && <p className="text-xs text-red-600 mt-1">{team.risk_reason}</p>}
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}
