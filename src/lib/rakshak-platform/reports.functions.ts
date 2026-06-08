import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Returns aggregated, authenticated team report. Visible to:
 *  - team leader / team member
 *  - assigned mentor
 *  - assigned evaluator (profile match)
 *  - admin / authority roles
 * Authority response fields are stripped for non-privileged viewers.
 */
export const getTeamReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ teamId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: team } = await supabaseAdmin
      .from("rp_teams")
      .select(
        "id, team_name, college, city, state, current_phase, status, final_score, evaluated_phases, completion_percentage, created_at, team_leader_id, assigned_mentor_id, assigned_evaluator_id",
      )
      .eq("id", data.teamId)
      .maybeSingle();

    if (!team) throw new Error("Team not found");

    // Authorization
    const userId = context.userId;
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isAdmin = roleSet.has("cfi_admin") || roleSet.has("super_admin");
    const isAuthority = roleSet.has("authority");

    let isMember = team.team_leader_id === userId;
    if (!isMember) {
      const { data: mem } = await context.supabase
        .from("rp_team_members")
        .select("id")
        .eq("team_id", team.id)
        .eq("profile_id", userId)
        .maybeSingle();
      isMember = !!mem;
    }
    let isMentor = false;
    if (team.assigned_mentor_id) {
      const { data: mt } = await context.supabase
        .from("rp_mentors")
        .select("id")
        .eq("id", team.assigned_mentor_id)
        .eq("profile_id", userId)
        .maybeSingle();
      isMentor = !!mt;
    }
    const isEvaluator = team.assigned_evaluator_id === userId;

    const canView = isAdmin || isAuthority || isMember || isMentor || isEvaluator;
    if (!canView) throw new Error("Forbidden: you do not have access to this team report");

    const seesAuthorityDetail = isAdmin || isAuthority || isMember || isMentor;

    const [{ data: locations }, { data: submissions }, { data: reports }] = await Promise.all([
      supabaseAdmin.from("rp_locations").select(
        "id, location_name, address, city, state, latitude, longitude, issue_type, severity, is_final_selected, created_at",
      ).eq("team_id", data.teamId),
      supabaseAdmin.from("rp_submissions").select(
        "id, phase_number, title, summary, status, submitted_at",
      ).eq("team_id", data.teamId).order("phase_number"),
      supabaseAdmin.from("rp_authority_reports").select(
        seesAuthorityDetail
          ? "id, authority_name, authority_category, subject, status, sent_at, response_status, response_at"
          : "id, authority_name, authority_category, subject, status, sent_at",
      ).eq("team_id", data.teamId).order("created_at", { ascending: false }),
    ]);

    // Strip private team identifiers from response
    const { team_leader_id, assigned_mentor_id, assigned_evaluator_id, ...teamPublic } = team as any;

    return {
      team: teamPublic,
      locations: locations ?? [],
      submissions: submissions ?? [],
      reports: reports ?? [],
    };
  });
