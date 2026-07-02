import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("rp_is_admin", { _user_id: userId });
  if (!data) throw new Error("Admin only");
}

export const listTeamsAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: teams, error } = await supabaseAdmin
      .from("rp_teams")
      .select(
        "id, team_name, college, city, state, current_phase, status, risk_status, final_score, evaluated_phases, team_leader_id, assigned_mentor_id, leader:team_leader_id(id, full_name, email), rp_mentors:assigned_mentor_id(id, profile_id, rp_profiles:profile_id(full_name, email))",
      )
      .order("team_name");
    if (error) throw error;
    // member counts
    const ids = (teams ?? []).map((t: any) => t.id);
    const { data: counts } = ids.length
      ? await supabaseAdmin
          .from("rp_team_members")
          .select("team_id")
          .in("team_id", ids)
      : { data: [] as any[] };
    const memberCount = new Map<string, number>();
    for (const r of counts ?? []) {
      memberCount.set(r.team_id, (memberCount.get(r.team_id) ?? 0) + 1);
    }
    return {
      teams: (teams ?? []).map((t: any) => ({
        ...t,
        member_count: memberCount.get(t.id) ?? 0,
      })),
    };
  });

export const getAdminTeamDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ team_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: team, error: teamErr } = await supabaseAdmin
      .from("rp_teams")
      .select(
        "*, leader:team_leader_id(id, full_name, email, phone), rp_mentors:assigned_mentor_id(id, profile_id, rp_profiles:profile_id(full_name, email, phone))",
      )
      .eq("id", data.team_id)
      .maybeSingle();
    if (teamErr) throw teamErr;
    if (!team) throw new Error("Team not found");

    const [members, progress, submissions, feedback, files, meetings] = await Promise.all([
      supabaseAdmin
        .from("rp_team_members")
        .select("id, full_name, email, role_in_team, phone, profile_id, joined_at")
        .eq("team_id", data.team_id)
        .order("full_name"),
      supabaseAdmin
        .from("rp_team_phase_progress")
        .select("*")
        .eq("team_id", data.team_id)
        .order("phase_number"),
      supabaseAdmin
        .from("rp_submissions")
        .select("*")
        .eq("team_id", data.team_id)
        .order("phase_number"),
      supabaseAdmin
        .from("rp_feedback")
        .select("*, rp_profiles:reviewer_id(full_name)")
        .eq("team_id", data.team_id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("rp_submission_files")
        .select("*")
        .eq("team_id", data.team_id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("rp_meetings")
        .select("*, rp_meeting_attendees(profile_id, rsvp, rp_profiles(full_name, email))")
        .eq("team_id", data.team_id)
        .order("scheduled_start", { ascending: false }),
    ]);

    return {
      team,
      members: members.data ?? [],
      progress: progress.data ?? [],
      submissions: submissions.data ?? [],
      feedback: feedback.data ?? [],
      files: files.data ?? [],
      meetings: meetings.data ?? [],
    };
  });
