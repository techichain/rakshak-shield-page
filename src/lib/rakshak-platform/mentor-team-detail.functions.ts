import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Mentor-scoped, read-only variant of getAdminTeamDetail. Query logic/shape is copied
// so the UI can render nearly identically. No writes / actions exposed.
export const getMentorTeamDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ team_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Must be a mentor
    const { data: isMentor } = await supabase.rpc("rp_has_role", {
      _user_id: userId,
      _role: "mentor",
    });
    if (!isMentor) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve this caller's mentor row and ensure they are THIS team's assigned mentor
    const { data: mentorRow } = await supabaseAdmin
      .from("rp_mentors")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();
    if (!mentorRow) throw new Error("Forbidden");

    const { data: team, error: teamErr } = await supabaseAdmin
      .from("rp_teams")
      .select(
        "*, leader:team_leader_id(id, full_name, email, phone), rp_mentors:assigned_mentor_id(id, profile_id, rp_profiles:profile_id(full_name, email, phone)), evaluator:assigned_evaluator_id(id, full_name, email, phone)",
      )
      .eq("id", data.team_id)
      .maybeSingle();
    if (teamErr) throw teamErr;
    if (!team) throw new Error("Team not found");
    if (team.assigned_mentor_id !== mentorRow.id) throw new Error("Forbidden");

    // Rank among all teams by final_score
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
