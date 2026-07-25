import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth, rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { TeamUpdates } from "@/components/rakshak-platform/TeamUpdates";

export const Route = createFileRoute("/rakshak-platform/team/updates")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["team_leader", "team_member"]);
  },
  head: () => ({
    meta: [
      { title: "Share with us — Rakshak's Portal" },
      {
        name: "description",
        content:
          "Tell the programme team about your exam schedule, availability and anything else we should plan your deadlines around.",
      },
      { property: "og:title", content: "Share with us — Rakshak's Portal" },
      {
        property: "og:description",
        content:
          "Post exam schedules, availability windows and notes so mentors and the programme team can plan around them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamUpdatesPage,
});

function TeamUpdatesPage() {
  const navigate = useNavigate();
  const { loading, userId, isTeam } = useRPAuth();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      navigate({ to: "/rakshak-platform/auth" });
      return;
    }
    if (!isTeam) {
      navigate({ to: "/rakshak-platform/dashboard" });
      return;
    }
    void (async () => {
      const { data: led } = await supabase
        .from("rp_teams")
        .select("id")
        .eq("team_leader_id", userId)
        .maybeSingle();
      if (led?.id) {
        setTeamId(led.id);
      } else {
        const { data: m } = await supabase
          .from("rp_team_members")
          .select("team_id")
          .eq("profile_id", userId)
          .maybeSingle();
        setTeamId(m?.team_id ?? null);
      }
      setReady(true);
    })();
  }, [loading, userId, isTeam, navigate]);

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>My team</Eyebrow>
        <h1 className="mt-4 font-heading text-3xl sm:text-4xl font-bold leading-[1.05]">
          Share with us.
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Exam weeks, travel, availability or anything else that affects your work. Your mentor
          and the programme team see these updates and plan deadlines around them.
        </p>

        <div className="mt-8">
          {!ready ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : teamId ? (
            <TeamUpdates teamId={teamId} />
          ) : (
            <p className="text-sm text-muted-foreground">
              You are not linked to a team yet, so there is nothing to share here.
            </p>
          )}
        </div>
      </Section>
    </PlatformShell>
  );
}
