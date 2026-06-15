import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth, rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { TEAM_STATUS_META, PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { ReviewPanel } from "@/components/rakshak-platform/ReviewPanel";
import { MentorCreateTeamPanel } from "@/components/rakshak-platform/MentorCreateTeamPanel";
import { EmptyState } from "@/components/rakshak-platform/EmptyState";
import { Loader2, UsersRound } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/mentor/")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["mentor"]);
  },
  component: MentorDashboard,
});

function MentorDashboard() {
  const navigate = useNavigate();
  const { loading, userId, isMentor } = useRPAuth();
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isMentor) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    (async () => {
      const { data: mentor } = await supabase.from("rp_mentors").select("id").eq("profile_id", userId).maybeSingle();
      if (!mentor) return;
      const { data } = await supabase
        .from("rp_teams")
        .select("id, team_name, college, city, state, current_phase, status, risk_status, completion_percentage")
        .eq("assigned_mentor_id", mentor.id);
      setTeams(data ?? []);
    })();
  }, [loading, userId, isMentor, navigate]);

  if (loading) {
    return (
      <PlatformShell>
        <Section className="!py-16">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading mentor workspace…
          </div>
        </Section>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Mentor workspace</Eyebrow>
        <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          Your assigned
          <br /><span className="text-brand">teams.</span>
        </h1>
        {teams.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              icon={UsersRound}
              title="No teams assigned yet"
              description="An admin will assign teams to you shortly. You can also propose a new team below using a verified team leader's email."
            />
          </div>
        ) : (
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">

          {teams.map((t) => {
            const meta = TEAM_STATUS_META[t.status as keyof typeof TEAM_STATUS_META];
            return (
              <div key={t.id} className="rounded-2xl border border-border bg-card p-6 hover:border-brand/40 transition">
                <div className="font-heading text-lg font-semibold">{t.team_name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t.college} · {t.city}</div>
                <div className="mt-4 text-sm">Phase {t.current_phase} — {PHASE_TITLES[t.current_phase]}</div>
                <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-brand" style={{ width: `${t.completion_percentage}%` }} />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${meta?.tone ?? ""}`}>{meta?.label}</span>
                  <span className={`text-xs ${t.risk_status === "at_risk" ? "text-red-600" : "text-muted-foreground"}`}>{t.risk_status.replace("_"," ")}</span>
                </div>
              </div>
            );
          })}
        </div>
        )}



        <div className="mt-12">
          <MentorCreateTeamPanel />
        </div>

        <div className="mt-16 border-t border-border pt-12">
          <ReviewPanel role="mentor" />
        </div>
      </Section>
    </PlatformShell>
  );
}
