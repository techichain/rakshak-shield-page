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
        "id, team_name, college, city, state, current_phase, status, risk_status, completion_percentage, final_score, evaluated_phases, team_leader_id, assigned_mentor_id, assigned_evaluator_id, leader:team_leader_id(id, full_name, email), rp_mentors:assigned_mentor_id(id, profile_id, rp_profiles:profile_id(full_name, email)), evaluator:assigned_evaluator_id(id, full_name, email)",
      )
      .order("final_score", { ascending: false, nullsFirst: false });
    if (error) throw error;

    const ids = (teams ?? []).map((t: any) => t.id);
    const { data: members } = ids.length
      ? await supabaseAdmin
          .from("rp_team_members")
          .select("team_id, full_name, email, role_in_team")
          .in("team_id", ids)
      : { data: [] as any[] };
    const membersByTeam = new Map<string, any[]>();
    for (const m of members ?? []) {
      const arr = membersByTeam.get(m.team_id) ?? [];
      arr.push(m);
      membersByTeam.set(m.team_id, arr);
    }

    // Rank by final_score (already sorted desc). Ties get same rank.
    let lastScore: number | null = null;
    let lastRank = 0;
    const ranked = (teams ?? []).map((t: any, i: number) => {
      const score = t.final_score == null ? -1 : Number(t.final_score);
      if (lastScore === null || score !== lastScore) {
        lastRank = i + 1;
        lastScore = score;
      }
      return {
        ...t,
        rank: t.final_score == null ? null : lastRank,
        members: membersByTeam.get(t.id) ?? [],
        member_count: (membersByTeam.get(t.id) ?? []).length,
      };
    });

    return { teams: ranked };
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
        "*, leader:team_leader_id(id, full_name, email, phone), rp_mentors:assigned_mentor_id(id, profile_id, rp_profiles:profile_id(full_name, email, phone)), evaluator:assigned_evaluator_id(id, full_name, email, phone)",
      )
      .eq("id", data.team_id)
      .maybeSingle();
    if (teamErr) throw teamErr;
    if (!team) throw new Error("Team not found");

    // compute rank among all teams by final_score
    const { data: allScores } = await supabaseAdmin
      .from("rp_teams")
      .select("id, final_score")
      .order("final_score", { ascending: false, nullsFirst: false });
    let rank: number | null = null;
    if (team.final_score != null && allScores) {
      let lastScore: number | null = null;
      let lastRank = 0;
      for (let i = 0; i < allScores.length; i++) {
        const s = allScores[i].final_score == null ? -1 : Number(allScores[i].final_score);
        if (lastScore === null || s !== lastScore) { lastRank = i + 1; lastScore = s; }
        if (allScores[i].id === team.id) { rank = lastRank; break; }
      }
    }

    const [members, progress, submissions, feedback, files, meetings, evaluations, locations] = await Promise.all([
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
        .select("*, rp_profiles:reviewer_id(full_name, email)")
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
      supabaseAdmin
        .from("rp_evaluations")
        .select("id, submission_id, phase_number, total_score, weighted_score, comments, status, submitted_at, evaluator:evaluator_id(id, full_name, email)")
        .eq("team_id", data.team_id)
        .order("phase_number"),
      supabaseAdmin
        .from("rp_locations")
        .select("id, phase_number, location_name, address, city, state, latitude, longitude, issue_type, severity, description, is_final_selected, drive_link, submitted_to_authority_at, authority_response, priority_rank")
        .eq("team_id", data.team_id)
        .order("phase_number")
        .order("priority_rank", { ascending: true, nullsFirst: false }),
    ]);

    const locRows = locations.data ?? [];
    const locIds = locRows.map((l: any) => l.id);
    const { data: photos } = locIds.length
      ? await supabaseAdmin
          .from("rp_location_photos")
          .select("id, location_id, file_name, storage_path, mime_type, caption, created_at, latitude, longitude")
          .in("location_id", locIds)
          .order("created_at", { ascending: false })
      : { data: [] as any[] };

    const photoRows = photos ?? [];
    const signedByPath: Record<string, string> = {};
    if (photoRows.length) {
      const paths = photoRows.map((p: any) => p.storage_path);
      const { data: signed } = await supabaseAdmin.storage
        .from("rp-submissions")
        .createSignedUrls(paths, 60 * 60);
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) signedByPath[s.path] = s.signedUrl;
      }
    }
    const photosWithUrls = photoRows.map((p: any) => ({
      ...p,
      signed_url: signedByPath[p.storage_path] ?? null,
    }));

    return {
      team: { ...team, rank },
      members: members.data ?? [],
      progress: progress.data ?? [],
      submissions: submissions.data ?? [],
      feedback: feedback.data ?? [],
      files: files.data ?? [],
      meetings: meetings.data ?? [],
      evaluations: evaluations.data ?? [],
      locations: locRows,
      location_photos: photosWithUrls,
    };
  });

export const addAdminRemark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      submission_id: z.string().uuid(),
      team_id: z.string().uuid(),
      phase_number: z.number().int().min(0).max(4),
      remark: z.string().trim().min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { error: fbErr } = await context.supabase.from("rp_feedback").insert({
      submission_id: data.submission_id,
      team_id: data.team_id,
      phase_number: data.phase_number,
      reviewer_id: context.userId,
      reviewer_role: "admin",
      feedback_text: data.remark,
      status: "open",
    });
    if (fbErr) throw fbErr;

    // Best-effort notify team leader + members (do not fail on notification error)
    try {
      const { data: team } = await context.supabase
        .from("rp_teams")
        .select("team_leader_id, team_name")
        .eq("id", data.team_id)
        .maybeSingle();
      const { data: members } = await context.supabase
        .from("rp_team_members")
        .select("profile_id")
        .eq("team_id", data.team_id);
      const ids = new Set<string>();
      if (team?.team_leader_id) ids.add(team.team_leader_id);
      for (const m of members ?? []) if (m.profile_id) ids.add(m.profile_id);
      const rows = Array.from(ids).map((r) => ({
        recipient_id: r,
        type: "admin_remark",
        title: `Admin remark on Phase ${data.phase_number}`,
        message: data.remark.slice(0, 240),
        action_link: `/rakshak-platform/team/phases`,
        related_entity_type: "submission",
        related_entity_id: data.submission_id,
      }));
      if (rows.length) await context.supabase.from("rp_notifications").insert(rows);
    } catch {
      // ignore
    }

    return { ok: true };
  });
