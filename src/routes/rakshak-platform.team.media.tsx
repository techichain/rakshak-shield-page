import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth, rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { MediaGallery } from "@/components/rakshak-platform/MediaGallery";

export const Route = createFileRoute("/rakshak-platform/team/media")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["team_leader", "team_member"]);
  },
  head: () => ({
    meta: [
      { title: "Site media — Rakshak's Portal" },
      {
        name: "description",
        content:
          "Every photo and video your team has captured on site, in one gallery, linked to locations and phases.",
      },
      { property: "og:title", content: "Site media — Rakshak's Portal" },
      {
        property: "og:description",
        content: "Your team's site photos and videos, together in one gallery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamMedia,
});

function TeamMedia() {
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
          Site media.
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Photos and videos from your audits, together in one gallery. Tag anything to a location or
          a phase so it is easy to find later. Your mentor and the programme team can see this.
        </p>

        <div className="mt-8">
          {!ready ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : teamId ? (
            <MediaGallery teamId={teamId} />
          ) : (
            <p className="text-sm text-muted-foreground">
              You are not linked to a team yet, so there is nothing to show here.
            </p>
          )}
        </div>
      </Section>
    </PlatformShell>
  );
}
