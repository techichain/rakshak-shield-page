import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Public leaderboard (no auth required). Returns ranked teams safe for public display.
 */
export const getLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((input: { cohortId?: string } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("rp_leaderboard_view")
      .select("*")
      .order("overall_rank", { ascending: true })
      .limit(200);
    if (data.cohortId) q = q.eq("cohort_id", data.cohortId);
    const { data: rows, error } = await q;
    if (error) throw error;

    const { data: cohorts } = await supabaseAdmin
      .from("rp_cohorts")
      .select("id, name, year, region")
      .order("year", { ascending: false });

    return { rows: rows ?? [], cohorts: cohorts ?? [] };
  });

/**
 * Evaluator queue: submissions that need scoring.
 * - If the signed-in user is assigned as the team's evaluator → those teams' submissions
 * - Plus any submission that has reached mentor_approved or under_admin_review and is not yet evaluated by this user
 */
export const getEvaluatorQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // assigned teams
    const { data: assignedTeams } = await supabase
      .from("rp_teams")
      .select("id, team_name, city, state, current_phase")
      .eq("assigned_evaluator_id", userId);
    const assignedTeamIds = (assignedTeams ?? []).map((t) => t.id);

    // submissions in review-ready states
    const { data: subs, error } = await supabase
      .from("rp_submissions")
      .select(`
        id, team_id, phase_number, title, summary, status, submitted_at, updated_at,
        rp_teams ( team_name, city, state, current_phase )
      `)
      .in("status", ["mentor_approved", "under_admin_review", "admin_approved", "completed"])
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw error;

    // existing evaluations by this user
    const submissionIds = (subs ?? []).map((s) => s.id);
    const { data: mine } = submissionIds.length
      ? await supabase
          .from("rp_evaluations")
          .select("id, submission_id, status, total_score, weighted_score")
          .eq("evaluator_id", userId)
          .in("submission_id", submissionIds)
      : { data: [] as any[] };

    const evalBySub = new Map<string, any>();
    (mine ?? []).forEach((e: any) => evalBySub.set(e.submission_id, e));

    const items = (subs ?? []).map((s: any) => ({
      ...s,
      assigned_to_me: assignedTeamIds.includes(s.team_id),
      my_evaluation: evalBySub.get(s.id) ?? null,
    }));

    return { items };
  });

/**
 * Fetch a submission + rubric + my evaluation for the scoring form.
 */
export const getSubmissionForScoring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { submissionId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: submission, error: subErr } = await supabase
      .from("rp_submissions")
      .select(`
        id, team_id, phase_number, title, summary, status, submitted_at,
        rp_teams ( id, team_name, city, state, college, current_phase ),
        rp_submission_files ( id, file_name, file_url, file_type, evidence_type, caption )
      `)
      .eq("id", data.submissionId)
      .single();
    if (subErr) throw subErr;

    const { data: rubric, error: rubErr } = await supabase
      .from("rp_rubrics")
      .select("*")
      .eq("phase_number", submission.phase_number)
      .single();
    if (rubErr) throw rubErr;

    const { data: myEval } = await supabase
      .from("rp_evaluations")
      .select("*")
      .eq("submission_id", data.submissionId)
      .eq("evaluator_id", userId)
      .maybeSingle();

    return { submission, rubric, myEval };
  });

/**
 * Save (draft) or submit an evaluation.
 */
export const upsertEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    submissionId: string;
    rubricScores: Record<string, number>;
    comments?: string;
    submit: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: submission, error: subErr } = await supabase
      .from("rp_submissions")
      .select("id, team_id, phase_number")
      .eq("id", data.submissionId)
      .single();
    if (subErr) throw subErr;

    const { data: rubric, error: rubErr } = await supabase
      .from("rp_rubrics")
      .select("criteria, max_total_score, phase_weight")
      .eq("phase_number", submission.phase_number)
      .single();
    if (rubErr) throw rubErr;

    const criteria = (rubric.criteria as Array<{ key: string; max_score: number }>) ?? [];
    let total = 0;
    for (const c of criteria) {
      const raw = Number(data.rubricScores[c.key] ?? 0);
      const clamped = Math.max(0, Math.min(c.max_score, raw));
      total += clamped;
    }
    const max = Number(rubric.max_total_score) || 100;
    const weight = Number(rubric.phase_weight) || 0;
    const weighted = Number(((total / max) * weight).toFixed(2));

    const payload: any = {
      submission_id: data.submissionId,
      team_id: submission.team_id,
      phase_number: submission.phase_number,
      evaluator_id: userId,
      rubric_scores: data.rubricScores,
      total_score: total,
      weighted_score: weighted,
      comments: data.comments ?? null,
      status: data.submit ? "submitted" : "draft",
      submitted_at: data.submit ? new Date().toISOString() : null,
    };

    const { data: row, error } = await supabase
      .from("rp_evaluations")
      .upsert(payload, { onConflict: "submission_id,evaluator_id" })
      .select()
      .single();
    if (error) throw error;
    return { evaluation: row };
  });
