import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- helpers ----------
async function ensureTeamMembership(supabase: any, userId: string, teamId: string) {
  const { data: t } = await supabase
    .from("rp_teams")
    .select("id, team_leader_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!t) throw new Error("Team not found");
  if (t.team_leader_id === userId) return { isLeader: true, team: t };
  const { data: m } = await supabase
    .from("rp_team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("profile_id", userId)
    .maybeSingle();
  if (!m) throw new Error("Forbidden: not a team member");
  return { isLeader: false, team: t };
}

// ---------- listTeamPhases (kanban data) ----------
export const listTeamPhases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ team_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureTeamMembership(context.supabase, context.userId, data.team_id);
    const [progress, subs] = await Promise.all([
      context.supabase
        .from("rp_team_phase_progress")
        .select("*")
        .eq("team_id", data.team_id)
        .order("phase_number"),
      context.supabase
        .from("rp_submissions")
        .select("id, phase_number, title, status, submitted_at, revision_number, updated_at")
        .eq("team_id", data.team_id)
        .order("phase_number"),
    ]);
    if (progress.error) throw progress.error;
    if (subs.error) throw subs.error;

    // build per-phase row even if no progress row exists
    const map = new Map<number, any>();
    for (const p of progress.data ?? []) map.set(p.phase_number, p);
    const phases = [0, 1, 2, 3, 4].map((n) => ({
      phase_number: n,
      progress: map.get(n) ?? {
        team_id: data.team_id,
        phase_number: n,
        status: "not_started",
        completion_percentage: 0,
        is_at_risk: false,
      },
      submission: (subs.data ?? []).find((s: any) => s.phase_number === n) ?? null,
    }));
    return { phases };
  });

// ---------- getMyTeams (for kanban / picker) ----------
export const getMyTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ledRows } = await context.supabase
      .from("rp_teams")
      .select("id, team_name, current_phase, status")
      .eq("team_leader_id", context.userId);
    const { data: memberRows } = await context.supabase
      .from("rp_team_members")
      .select("rp_teams!inner(id, team_name, current_phase, status)")
      .eq("profile_id", context.userId);
    const memberTeams = (memberRows ?? [])
      .map((r: any) => r.rp_teams)
      .filter(Boolean);
    const seen = new Set<string>();
    const out: any[] = [];
    for (const t of [...(ledRows ?? []), ...memberTeams]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return { teams: out };
  });

// ---------- getSubmission ----------
export const getSubmissionDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ team_id: z.string().uuid(), phase_number: z.number().int().min(0).max(4) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureTeamMembership(context.supabase, context.userId, data.team_id);
    const { data: sub } = await context.supabase
      .from("rp_submissions")
      .select("*")
      .eq("team_id", data.team_id)
      .eq("phase_number", data.phase_number)
      .maybeSingle();
    let files: any[] = [];
    let feedback: any[] = [];
    if (sub) {
      const [f, fb] = await Promise.all([
        context.supabase
          .from("rp_submission_files")
          .select("*")
          .eq("submission_id", sub.id)
          .order("created_at", { ascending: false }),
        context.supabase
          .from("rp_feedback")
          .select("*, rp_profiles:author_id(full_name)")
          .eq("submission_id", sub.id)
          .order("created_at", { ascending: false }),
      ]);
      files = f.data ?? [];
      feedback = fb.data ?? [];
    }
    const { data: progress } = await context.supabase
      .from("rp_team_phase_progress")
      .select("*")
      .eq("team_id", data.team_id)
      .eq("phase_number", data.phase_number)
      .maybeSingle();
    return { submission: sub, files, feedback, progress };
  });

// ---------- upsertSubmission (draft) ----------
const UpsertInput = z.object({
  team_id: z.string().uuid(),
  phase_number: z.number().int().min(0).max(4),
  title: z.string().min(1).max(400),
  summary: z.string().max(8000).default(""),
});
export const upsertSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensureTeamMembership(context.supabase, context.userId, data.team_id);
    const { data: existing } = await context.supabase
      .from("rp_submissions")
      .select("id, status")
      .eq("team_id", data.team_id)
      .eq("phase_number", data.phase_number)
      .maybeSingle();
    if (existing) {
      const { error } = await context.supabase
        .from("rp_submissions")
        .update({
          title: data.title,
          summary: data.summary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw error;
      return { submission_id: existing.id };
    }
    const { data: row, error } = await context.supabase
      .from("rp_submissions")
      .insert({
        team_id: data.team_id,
        phase_number: data.phase_number,
        title: data.title,
        summary: data.summary,
        status: "draft",
        submitted_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    // mark phase progress started
    await context.supabase
      .from("rp_team_phase_progress")
      .upsert(
        {
          team_id: data.team_id,
          phase_number: data.phase_number,
          status: "draft",
          started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        },
        { onConflict: "team_id,phase_number" },
      );
    return { submission_id: row.id };
  });

// ---------- submitForReview ----------
export const submitForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ submission_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: sub } = await context.supabase
      .from("rp_submissions")
      .select("id, team_id, phase_number, status, revision_number")
      .eq("id", data.submission_id)
      .maybeSingle();
    if (!sub) throw new Error("Submission not found");
    await ensureTeamMembership(context.supabase, context.userId, sub.team_id);

    const nextStatus = sub.status === "changes_requested" ? "resubmitted" : "submitted";
    const nextRev =
      sub.status === "changes_requested" ? (sub.revision_number ?? 1) + 1 : sub.revision_number;

    const { error } = await context.supabase
      .from("rp_submissions")
      .update({
        status: nextStatus,
        submitted_at: new Date().toISOString(),
        submitted_by: context.userId,
        revision_number: nextRev,
        mentor_review_status: "pending",
      })
      .eq("id", sub.id);
    if (error) throw error;

    await context.supabase
      .from("rp_team_phase_progress")
      .upsert(
        {
          team_id: sub.team_id,
          phase_number: sub.phase_number,
          status: nextStatus,
          submitted_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          completion_percentage: 75,
        },
        { onConflict: "team_id,phase_number" },
      );

    // Notify mentor if assigned
    const { data: team } = await context.supabase
      .from("rp_teams")
      .select("team_name, assigned_mentor_id, rp_mentors:assigned_mentor_id(profile_id)")
      .eq("id", sub.team_id)
      .maybeSingle();
    const mentorProfile = (team as any)?.rp_mentors?.profile_id;
    if (mentorProfile) {
      await context.supabase.from("rp_notifications").insert({
        recipient_id: mentorProfile,
        type: "submission_for_review",
        title: `Phase ${sub.phase_number} submission ready`,
        message: `${(team as any)?.team_name ?? "A team"} submitted phase ${sub.phase_number}.`,
        action_link: `/rakshak-platform/mentor`,
        related_entity_type: "submission",
        related_entity_id: sub.id,
      });
    }
    return { ok: true, status: nextStatus };
  });

// ---------- attachSubmissionFile (record after client uploads to storage) ----------
export const attachSubmissionFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        submission_id: z.string().uuid(),
        file_name: z.string().min(1).max(400),
        file_type: z.string().max(120).optional(),
        file_url: z.string().min(1).max(2000),
        storage_path: z.string().max(2000).optional(),
        file_size: z.number().int().min(0).max(50 * 1024 * 1024).optional(),
        evidence_type: z.string().max(80).optional(),
        caption: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: sub } = await context.supabase
      .from("rp_submissions")
      .select("id, team_id")
      .eq("id", data.submission_id)
      .maybeSingle();
    if (!sub) throw new Error("Submission not found");
    await ensureTeamMembership(context.supabase, context.userId, sub.team_id);
    const { data: row, error } = await context.supabase
      .from("rp_submission_files")
      .insert({
        submission_id: sub.id,
        team_id: sub.team_id,
        file_name: data.file_name,
        file_type: data.file_type ?? null,
        file_url: data.file_url,
        storage_path: data.storage_path ?? null,
        file_size: data.file_size ?? null,
        evidence_type: data.evidence_type ?? null,
        caption: data.caption ?? null,
        uploaded_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { file: row };
  });

export const removeSubmissionFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ file_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: f } = await context.supabase
      .from("rp_submission_files")
      .select("id, team_id")
      .eq("id", data.file_id)
      .maybeSingle();
    if (!f) throw new Error("File not found");
    await ensureTeamMembership(context.supabase, context.userId, f.team_id);
    const { error } = await context.supabase
      .from("rp_submission_files")
      .delete()
      .eq("id", data.file_id);
    if (error) throw error;
    return { ok: true };
  });
