import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth, rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { EvidenceRepository } from "@/components/rakshak-platform/EvidenceRepository";

export const Route = createFileRoute("/rakshak-platform/team/evidence")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["team_leader", "team_member"]);
  },
  head: () => ({
    meta: [
      { title: "Evidence & records — Rakshak's Portal" },
      {
        name: "description",
        content:
          "Keep your team's crash data, RTI requests, FIRs, police complaints and media coverage in one place, with the documents attached.",
      },
      { property: "og:title", content: "Evidence & records — Rakshak's Portal" },
      {
        property: "og:description",
        content:
          "Your team's filed records and supporting documents, all in one repository.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamEvidence,
});

function TeamEvidence() {
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
          Evidence &amp; records.
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Keep every piece of paperwork your team collects or files — crash data, RTI requests,
          FIRs, police complaints and media coverage — together with the documents that back it up.
          Your mentor and the programme team can see this list.
        </p>

        <div className="mt-8">
          {!ready ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : teamId ? (
            <EvidenceRepository teamId={teamId} />
          ) : (
            <p className="text-sm text-muted-foreground">
              You are not linked to a team yet, so there is nothing to store here.
            </p>
          )}
        </div>
      </Section>
    </PlatformShell>
  );
}
