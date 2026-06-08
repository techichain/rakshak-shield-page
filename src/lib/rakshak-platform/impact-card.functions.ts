import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public: data for the shareable impact card. Returns team summary,
 * final selected location, latest authority report status, and any
 * awarded badges. Used by /rakshak-platform/share/$teamId.
 */
export const getImpactCard = createServerFn({ method: "GET" })
  .inputValidator((input: { teamId: string }) =>
    z.object({ teamId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: team, error: tErr } = await supabaseAdmin
      .from("rp_teams")
      .select("id, team_name, college, city, state, current_phase, final_score, evaluated_phases, status, cohort_id, rp_cohorts(name, year)")
      .eq("id", data.teamId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!team) return { team: null };

    const { data: location } = await supabaseAdmin
      .from("rp_locations")
      .select("location_name, city, state, issue_type, severity, latitude, longitude")
      .eq("team_id", data.teamId)
      .eq("is_final_selected", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: authority } = await supabaseAdmin
      .from("rp_authority_reports")
      .select("authority_name, status, response_status, response_at, sent_at")
      .eq("team_id", data.teamId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: badges } = await supabaseAdmin
      .from("rp_team_badges")
      .select("badge_code, awarded_at, rp_badges(name, icon)")
      .eq("team_id", data.teamId)
      .order("awarded_at", { ascending: false });

    return {
      team,
      location: location ?? null,
      authority: authority ?? null,
      badges: badges ?? [],
    };
  });
