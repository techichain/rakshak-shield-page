import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Returns aggregated, public-safe data needed to render a printable
 * team report at /rakshak-platform/reports/$teamId.
 */
export const getTeamReport = createServerFn({ method: "GET" })
  .inputValidator((d: { teamId: string }) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: team }, { data: locations }, { data: submissions }, { data: reports }] = await Promise.all([
      supabaseAdmin.from("rp_teams").select(
        "id, team_name, college, city, state, current_phase, status, final_score, evaluated_phases, completion_percentage, created_at"
      ).eq("id", data.teamId).maybeSingle(),
      supabaseAdmin.from("rp_locations").select(
        "id, location_name, address, city, state, latitude, longitude, issue_type, severity, is_final_selected, created_at"
      ).eq("team_id", data.teamId),
      supabaseAdmin.from("rp_submissions").select(
        "id, phase_number, title, summary, status, submitted_at"
      ).eq("team_id", data.teamId).order("phase_number"),
      supabaseAdmin.from("rp_authority_reports").select(
        "id, authority_name, authority_category, subject, status, sent_at, response_status, response_at"
      ).eq("team_id", data.teamId).order("created_at", { ascending: false }),
    ]);
    if (!team) throw new Error("Team not found");
    return {
      team,
      locations: locations ?? [],
      submissions: submissions ?? [],
      reports: reports ?? [],
    };
  });
