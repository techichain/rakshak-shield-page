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

// ---------- document slots ----------
// A phase can hold up to three submission "slots":
//   draft questionnaire | draft report | final submission
// Slot identity = (document_type, is_final). Legacy rows default to
// ('report', false) so they land in the "Draft report" slot untouched.
export const DOCUMENT_TYPES = ["questionnaire", "report", "other"] as const;
const DocumentTypeSchema = z.enum(DOCUMENT_TYPES);

// ---------- getSubmission ----------
export const getSubmissionDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        team_id: z.string().uuid(),
        phase_number: z.number().int().min(0).max(4),
        document_type: DocumentTypeSchema.optional(),
        is_final: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureTeamMembership(context.supabase, context.userId, data.team_id);
    let q = context.supabase
      .from("rp_submissions")
      .select("*")
      .eq("team_id", data.team_id)
      .eq("phase_number", data.phase_number);
    if (data.document_type) q = q.eq("document_type", data.document_type);
    if (data.is_final !== undefined) q = q.eq("is_final", data.is_final);
    // A phase may now hold several slot rows; prefer the final one, then the
    // most recently touched, so single-submission callers keep working.
    const { data: rows } = await q
      .order("is_final", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1);
    const sub = (rows ?? [])[0] ?? null;
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

// ---------- getPhaseSubmissionSlots ----------
// Everything the per-phase team view needs: the three slots with their
// submission row, files and feedback, plus the phase progress row.
export const getPhaseSubmissionSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ team_id: z.string().uuid(), phase_number: z.number().int().min(0).max(4) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureTeamMembership(context.supabase, context.userId, data.team_id);

    const { data: subs } = await context.supabase
      .from("rp_submissions")
      .select("*")
      .eq("team_id", data.team_id)
      .eq("phase_number", data.phase_number)
      .order("updated_at", { ascending: false });

    const rows = subs ?? [];
    const ids = rows.map((s: any) => s.id);
    let files: any[] = [];
    let feedback: any[] = [];
    if (ids.length) {
      const [f, fb] = await Promise.all([
        context.supabase
          .from("rp_submission_files")
          .select("*")
          .in("submission_id", ids)
          .order("created_at", { ascending: false }),
        context.supabase
          .from("rp_feedback")
          .select("*, rp_profiles:author_id(full_name)")
          .in("submission_id", ids)
          .order("created_at", { ascending: false }),
      ]);
      files = f.data ?? [];
      feedback = fb.data ?? [];
    }

    const pick = (documentType: string, isFinal: boolean) =>
      rows.find((s: any) => s.document_type === documentType && !!s.is_final === isFinal) ?? null;

    const build = (
      key: "draft_questionnaire" | "draft_report" | "final",
      documentType: "questionnaire" | "report",
      isFinal: boolean,
    ) => {
      const submission = pick(documentType, isFinal);
      return {
        key,
        document_type: documentType,
        is_final: isFinal,
        submission,
        files: submission ? files.filter((f: any) => f.submission_id === submission.id) : [],
        feedback: submission ? feedback.filter((f: any) => f.submission_id === submission.id) : [],
      };
    };

    const { data: progress } = await context.supabase
      .from("rp_team_phase_progress")
      .select("*")
      .eq("team_id", data.team_id)
      .eq("phase_number", data.phase_number)
      .maybeSingle();

    return {
      slots: [
        build("draft_questionnaire", "questionnaire", false),
        build("draft_report", "report", false),
        build("final", "report", true),
      ],
      // Any extra rows (e.g. document_type 'other') so nothing is hidden.
      others: rows.filter(
        (s: any) =>
          !(s.document_type === "questionnaire" && !s.is_final) &&
          !(s.document_type === "report" && !s.is_final) &&
          !(s.document_type === "report" && s.is_final),
      ),
      progress,
    };
  });

// ---------- upsertSubmission (draft) ----------
const UpsertInput = z.object({
  team_id: z.string().uuid(),
  phase_number: z.number().int().min(0).max(4),
  title: z.string().min(1).max(400),
  summary: z.string().max(8000).default(""),
  document_type: DocumentTypeSchema.default("report"),
  is_final: z.boolean().default(false),
});
export const upsertSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensureTeamMembership(context.supabase, context.userId, data.team_id);
    const { data: existingRows } = await context.supabase
      .from("rp_submissions")
      .select("id, status")
      .eq("team_id", data.team_id)
      .eq("phase_number", data.phase_number)
      .eq("document_type", data.document_type)
      .eq("is_final", data.is_final)
      .order("updated_at", { ascending: false })
      .limit(1);
    const existing = (existingRows ?? [])[0] ?? null;
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
        document_type: data.document_type,
        is_final: data.is_final,
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

// ---------- Mentor / Admin review cascade ----------

async function getRecipientIds(supabase: any, teamId: string) {
  const { data: team } = await supabase
    .from("rp_teams")
    .select("team_leader_id, team_name")
    .eq("id", teamId)
    .maybeSingle();
  const { data: members } = await supabase
    .from("rp_team_members")
    .select("profile_id")
    .eq("team_id", teamId);
  const ids = new Set<string>();
  if (team?.team_leader_id) ids.add(team.team_leader_id);
  for (const m of members ?? []) if (m.profile_id) ids.add(m.profile_id);
  return { recipients: Array.from(ids), teamName: team?.team_name ?? "Your team" };
}

const ReviewInput = z.object({
  submission_id: z.string().uuid(),
  decision: z.enum(["approve", "request_changes"]),
  comment: z.string().max(4000).optional(),
});

// Mentor approves or requests changes. On approve -> under_admin_review.
export const mentorReviewSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReviewInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: sub } = await context.supabase
      .from("rp_submissions")
      .select("id, team_id, phase_number, status")
      .eq("id", data.submission_id)
      .maybeSingle();
    if (!sub) throw new Error("Submission not found");

    // verify caller is the team's mentor (or admin)
    const { data: team } = await context.supabase
      .from("rp_teams")
      .select("assigned_mentor_id, rp_mentors:assigned_mentor_id(profile_id)")
      .eq("id", sub.team_id)
      .maybeSingle();
    const mentorProfileId = (team as any)?.rp_mentors?.profile_id;
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => ["cfi_admin", "super_admin"].includes(r.role));
    if (mentorProfileId !== context.userId && !isAdmin) {
      throw new Error("Forbidden: not the assigned mentor");
    }

    const approve = data.decision === "approve";
    const newStatus = approve ? "mentor_approved" : "changes_requested";

    const { error } = await context.supabase
      .from("rp_submissions")
      .update({
        status: newStatus,
        mentor_review_status: approve ? "approved" : "changes_requested",
      })
      .eq("id", sub.id);
    if (error) throw error;

    if (data.comment?.trim()) {
      await context.supabase.from("rp_feedback").insert({
        submission_id: sub.id,
        team_id: sub.team_id,
        phase_number: sub.phase_number,
        reviewer_id: context.userId,
        reviewer_role: "mentor",
        feedback_text: data.comment,
        status: approve ? "resolved" : "open",
      });
    }

    await context.supabase
      .from("rp_team_phase_progress")
      .upsert(
        {
          team_id: sub.team_id,
          phase_number: sub.phase_number,
          status: newStatus,
          last_activity_at: new Date().toISOString(),
          completion_percentage: approve ? 85 : 60,
        },
        { onConflict: "team_id,phase_number" },
      );

    const { recipients, teamName } = await getRecipientIds(context.supabase, sub.team_id);
    const title = approve
      ? `Mentor approved Phase ${sub.phase_number} — awaiting admin review`
      : `Mentor requested changes on Phase ${sub.phase_number}`;
    const rows = recipients.map((r) => ({
      recipient_id: r,
      type: approve ? "mentor_approved" : "changes_requested",
      title,
      message: data.comment ?? null,
      action_link: `/rakshak-platform/team/phases`,
      related_entity_type: "submission",
      related_entity_id: sub.id,
    }));
    if (rows.length) await context.supabase.from("rp_notifications").insert(rows);

    if (approve) {
      const { data: admins } = await context.supabase
        .from("rp_user_roles").select("user_id").in("role", ["cfi_admin", "super_admin"]);
      const adminRows = (admins ?? []).map((a: any) => ({
        recipient_id: a.user_id,
        type: "needs_admin_review",
        title: `Admin review needed: ${teamName} — Phase ${sub.phase_number}`,
        message: data.comment ?? null,
        action_link: `/rakshak-platform/admin/reviews`,
        related_entity_type: "submission",
        related_entity_id: sub.id,
      }));
      if (adminRows.length) await context.supabase.from("rp_notifications").insert(adminRows);
    }

    // Best-effort WhatsApp notify (inert until credentials configured)
    try {
      const { notifyTeamWhatsApp } = await import("./whatsapp.server");
      const body = approve
        ? `Mentor approved Phase ${sub.phase_number} for ${teamName}. Awaiting admin review.${data.comment ? ` Note: ${data.comment.slice(0, 200)}` : ""}`
        : `Mentor requested changes on Phase ${sub.phase_number} for ${teamName}.${data.comment ? ` ${data.comment.slice(0, 200)}` : ""}`;
      await notifyTeamWhatsApp({ team_id: sub.team_id, body });
    } catch (e) {
      console.error("[mentorReviewSubmission] whatsapp notify failed", e);
    }

    return { ok: true, status: newStatus };
  });


// Admin approves -> admin_approved, unlocks next phase. Or requests changes.
export const adminReviewSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReviewInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => ["cfi_admin", "super_admin"].includes(r.role));
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { data: sub } = await context.supabase
      .from("rp_submissions")
      .select("id, team_id, phase_number, status")
      .eq("id", data.submission_id)
      .maybeSingle();
    if (!sub) throw new Error("Submission not found");

    const approve = data.decision === "approve";
    const newStatus = approve ? "admin_approved" : "changes_requested";

    const { error } = await context.supabase
      .from("rp_submissions")
      .update({
        status: newStatus,
        admin_review_status: approve ? "approved" : "changes_requested",
      })
      .eq("id", sub.id);
    if (error) throw error;

    if (data.comment?.trim()) {
      await context.supabase.from("rp_feedback").insert({
        submission_id: sub.id,
        team_id: sub.team_id,
        phase_number: sub.phase_number,
        reviewer_id: context.userId,
        reviewer_role: "admin",
        feedback_text: data.comment,
        status: approve ? "resolved" : "open",
      });
    }

    await context.supabase
      .from("rp_team_phase_progress")
      .upsert(
        {
          team_id: sub.team_id,
          phase_number: sub.phase_number,
          status: approve ? "completed" : "changes_requested",
          completed_at: approve ? new Date().toISOString() : null,
          last_activity_at: new Date().toISOString(),
          completion_percentage: approve ? 100 : 60,
        },
        { onConflict: "team_id,phase_number" },
      );

    // Phase cascade: unlock next phase on approve
    if (approve) {
      const nextPhase = Math.min(sub.phase_number + 1, 4);
      const { data: team } = await context.supabase
        .from("rp_teams")
        .select("current_phase")
        .eq("id", sub.team_id)
        .maybeSingle();
      if (team && (team.current_phase ?? 0) < nextPhase) {
        await context.supabase
          .from("rp_teams")
          .update({ current_phase: nextPhase, updated_at: new Date().toISOString() })
          .eq("id", sub.team_id);
      }
      if (sub.phase_number < 4) {
        await context.supabase
          .from("rp_team_phase_progress")
          .upsert(
            {
              team_id: sub.team_id,
              phase_number: nextPhase,
              status: "not_started",
              completion_percentage: 0,
              last_activity_at: new Date().toISOString(),
            },
            { onConflict: "team_id,phase_number" },
          );
      }
    }

    const { recipients, teamName } = await getRecipientIds(context.supabase, sub.team_id);
    const title = approve
      ? sub.phase_number < 4
        ? `Phase ${sub.phase_number} approved — Phase ${sub.phase_number + 1} unlocked`
        : `Phase 4 approved — Project complete`
      : `Admin requested changes on Phase ${sub.phase_number}`;
    const rows = recipients.map((r) => ({
      recipient_id: r,
      type: approve ? "admin_approved" : "changes_requested",
      title,
      message: data.comment ?? `${teamName} — Phase ${sub.phase_number}`,
      action_link: `/rakshak-platform/team/phases`,
      related_entity_type: "submission",
      related_entity_id: sub.id,
    }));
    if (rows.length) await context.supabase.from("rp_notifications").insert(rows);

    // Best-effort WhatsApp notify (inert until credentials configured)
    try {
      const { notifyTeamWhatsApp } = await import("./whatsapp.server");
      const body = approve
        ? sub.phase_number < 4
          ? `Congrats! Phase ${sub.phase_number} approved for ${teamName}. Phase ${sub.phase_number + 1} is now unlocked.`
          : `Congrats! Phase 4 approved for ${teamName}. Project complete.`
        : `Admin requested changes on Phase ${sub.phase_number} for ${teamName}.${data.comment ? ` ${data.comment.slice(0, 200)}` : ""}`;
      await notifyTeamWhatsApp({ team_id: sub.team_id, body });
    } catch (e) {
      console.error("[adminReviewSubmission] whatsapp notify failed", e);
    }

    return { ok: true, status: newStatus };
  });


// List pending submissions for the current mentor (status submitted/resubmitted/under_mentor_review)
export const listMentorPendingReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: mentor } = await context.supabase
      .from("rp_mentors").select("id").eq("profile_id", context.userId).maybeSingle();
    if (!mentor) return { items: [] };
    const { data: teams } = await context.supabase
      .from("rp_teams").select("id, team_name").eq("assigned_mentor_id", mentor.id);
    const teamIds = (teams ?? []).map((t: any) => t.id);
    if (teamIds.length === 0) return { items: [] };
    const { data: subs } = await context.supabase
      .from("rp_submissions")
      .select("id, team_id, phase_number, title, summary, status, submitted_at, revision_number")
      .in("team_id", teamIds)
      .in("status", ["submitted", "resubmitted", "under_mentor_review"])
      .order("submitted_at", { ascending: false });
    const nameById = new Map((teams ?? []).map((t: any) => [t.id, t.team_name]));
    return { items: (subs ?? []).map((s: any) => ({ ...s, team_name: nameById.get(s.team_id) })) };
  });

// List pending admin reviews (mentor_approved)
export const listAdminPendingReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => ["cfi_admin", "super_admin"].includes(r.role));
    if (!isAdmin) throw new Error("Forbidden");
    const { data: subs } = await context.supabase
      .from("rp_submissions")
      .select("id, team_id, phase_number, title, summary, status, submitted_at, revision_number, rp_teams:team_id(team_name, college, city)")
      .eq("status", "mentor_approved")
      .order("submitted_at", { ascending: false });
    return { items: subs ?? [] };
  });

// ---------- getSubmissionTimeline ----------
// Returns ordered audit-log events + feedback comments for a submission.
// Allowed: team members, the team's assigned mentor, or any admin.
export const getSubmissionTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ submission_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: sub } = await context.supabase
      .from("rp_submissions")
      .select("id, team_id, phase_number")
      .eq("id", data.submission_id)
      .maybeSingle();
    if (!sub) throw new Error("Submission not found");

    // permission: member, mentor, or admin
    const [{ data: roles }, { data: team }, { data: member }] = await Promise.all([
      context.supabase.from("rp_user_roles").select("role").eq("user_id", context.userId),
      context.supabase
        .from("rp_teams")
        .select("team_leader_id, rp_mentors:assigned_mentor_id(profile_id)")
        .eq("id", sub.team_id)
        .maybeSingle(),
      context.supabase
        .from("rp_team_members")
        .select("id")
        .eq("team_id", sub.team_id)
        .eq("profile_id", context.userId)
        .maybeSingle(),
    ]);
    const isAdmin = (roles ?? []).some((r: any) =>
      ["cfi_admin", "super_admin"].includes(r.role));
    const isMentor = (team as any)?.rp_mentors?.profile_id === context.userId;
    const isMember =
      !!member || (team as any)?.team_leader_id === context.userId;
    if (!isAdmin && !isMentor && !isMember) throw new Error("Forbidden");

    // Audit log + feedback need to bypass RLS (audit table is admin-only by policy)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: audits }, { data: feedback }] = await Promise.all([
      supabaseAdmin
        .from("rp_audit_logs")
        .select("id, action, actor_id, actor_role, new_value, old_value, created_at")
        .eq("entity_type", "rp_submissions")
        .eq("entity_id", sub.id)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("rp_feedback")
        .select("id, reviewer_id, reviewer_role, feedback_text, status, created_at")
        .eq("submission_id", sub.id)
        .order("created_at", { ascending: true }),
    ]);

    // resolve actor names in one query
    const actorIds = new Set<string>();
    (audits ?? []).forEach((a: any) => a.actor_id && actorIds.add(a.actor_id));
    (feedback ?? []).forEach((f: any) => f.reviewer_id && actorIds.add(f.reviewer_id));
    let nameMap = new Map<string, string>();
    if (actorIds.size) {
      const { data: profs } = await supabaseAdmin
        .from("rp_profiles")
        .select("id, full_name")
        .in("id", Array.from(actorIds));
      nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name as string]));
    }

    const events = [
      ...(audits ?? []).map((a: any) => ({
        kind: "status" as const,
        id: `a_${a.id}`,
        at: a.created_at,
        actor_id: a.actor_id,
        actor_name: a.actor_id ? nameMap.get(a.actor_id) ?? "Unknown" : "System",
        actor_role: a.actor_role ?? null,
        action: a.action as string,
        from_status: a.new_value?.status ? a.old_value?.status ?? null : null,
        to_status: a.new_value?.status ?? null,
        title: a.new_value?.title ?? null,
      })),
      ...(feedback ?? []).map((f: any) => ({
        kind: "comment" as const,
        id: `f_${f.id}`,
        at: f.created_at,
        actor_id: f.reviewer_id,
        actor_name: f.reviewer_id ? nameMap.get(f.reviewer_id) ?? "Reviewer" : "Reviewer",
        actor_role: f.reviewer_role ?? null,
        action: `comment_${f.status ?? "open"}`,
        text: f.feedback_text as string,
      })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return { events };
  });

// ---------- getTeamPhaseTimeline ----------
// Per-phase summary for the team dashboard's expandable timeline:
// submission (title/summary/submitted_at), feedback (mentor+evaluator+admin),
// and evaluator scores. Team members only.
export const getTeamPhaseTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ team_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureTeamMembership(context.supabase, context.userId, data.team_id);
    const { data: subs } = await context.supabase
      .from("rp_submissions")
      .select("id, phase_number, title, summary, status, submitted_at, updated_at, created_at")
      .eq("team_id", data.team_id)
      .order("phase_number");
    const submissionIds = (subs ?? []).map((s: any) => s.id);

    let feedback: any[] = [];
    let evaluations: any[] = [];
    if (submissionIds.length) {
      const [fb, ev] = await Promise.all([
        context.supabase
          .from("rp_feedback")
          .select("id, submission_id, reviewer_role, reviewer_id, feedback_text, phase_number, created_at, rp_profiles:reviewer_id(full_name)")
          .in("submission_id", submissionIds)
          .order("created_at", { ascending: false }),
        context.supabase
          .from("rp_evaluations")
          .select("id, submission_id, evaluator_id, status, total_score, weighted_score, comments, updated_at, evaluator:evaluator_id(full_name)")
          .in("submission_id", submissionIds),
      ]);
      feedback = fb.data ?? [];
      evaluations = ev.data ?? [];
    }

    const byPhase = new Map<number, any>();
    for (let n = 0; n <= 4; n++) {
      byPhase.set(n, { phase_number: n, submission: null, feedback: [], evaluations: [] });
    }
    for (const s of subs ?? []) {
      const row = byPhase.get(s.phase_number);
      if (row) row.submission = s;
    }
    for (const f of feedback) {
      const s = (subs ?? []).find((x: any) => x.id === f.submission_id);
      if (!s) continue;
      const row = byPhase.get(s.phase_number);
      if (row) row.feedback.push(f);
    }
    for (const e of evaluations) {
      const s = (subs ?? []).find((x: any) => x.id === e.submission_id);
      if (!s) continue;
      const row = byPhase.get(s.phase_number);
      if (row) row.evaluations.push(e);
    }

    return { phases: Array.from(byPhase.values()) };
  });
