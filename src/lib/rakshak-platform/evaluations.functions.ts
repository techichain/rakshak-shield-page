import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Public leaderboard (no auth). Optional filters: cohortId, phase (0–4),
 * submittedFrom / submittedTo (ISO). When phase or date is set we recompute
 * standings from rp_evaluations instead of using the materialised view.
 */
export const getLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((input: {
    cohortId?: string;
    phase?: number | null;
    submittedFrom?: string | null;
    submittedTo?: string | null;
  } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cohorts } = await supabaseAdmin
      .from("rp_cohorts")
      .select("id, name, year, region")
      .order("year", { ascending: false });

    const hasPhase = data.phase !== undefined && data.phase !== null;
    const hasDate = !!(data.submittedFrom || data.submittedTo);

    if (!hasPhase && !hasDate) {
      let q = supabaseAdmin
        .from("rp_leaderboard_view")
        .select("*")
        .order("overall_rank", { ascending: true })
        .limit(200);
      if (data.cohortId) q = q.eq("cohort_id", data.cohortId);
      const { data: rows, error } = await q;
      if (error) throw error;
      return { rows: rows ?? [], cohorts: cohorts ?? [], filters: data };
    }

    let eq = supabaseAdmin
      .from("rp_evaluations")
      .select("team_id, phase_number, weighted_score, submitted_at, status")
      .eq("status", "submitted");
    if (hasPhase) eq = eq.eq("phase_number", data.phase as number);
    if (data.submittedFrom) eq = eq.gte("submitted_at", data.submittedFrom);
    if (data.submittedTo) eq = eq.lte("submitted_at", data.submittedTo);
    const { data: evals, error: evErr } = await eq;
    if (evErr) throw evErr;

    const best = new Map<string, number>();
    for (const e of evals ?? []) {
      const k = `${e.team_id}|${e.phase_number}`;
      const w = Number(e.weighted_score) || 0;
      if (w > (best.get(k) ?? -Infinity)) best.set(k, w);
    }
    const agg = new Map<string, { score: number; phases: Set<number> }>();
    for (const [k, w] of best) {
      const [teamId, p] = k.split("|");
      const cur = agg.get(teamId) ?? { score: 0, phases: new Set<number>() };
      cur.score += w;
      cur.phases.add(Number(p));
      agg.set(teamId, cur);
    }

    const teamIds = Array.from(agg.keys());
    if (teamIds.length === 0) return { rows: [], cohorts: cohorts ?? [], filters: data };

    let tq = supabaseAdmin
      .from("rp_teams")
      .select("id, team_name, city, state, college, cohort_id, current_phase, rp_cohorts(name)")
      .in("id", teamIds);
    if (data.cohortId) tq = tq.eq("cohort_id", data.cohortId);
    const { data: teams, error: tErr } = await tq;
    if (tErr) throw tErr;

    const rows = (teams ?? [])
      .map((t: any) => {
        const a = agg.get(t.id)!;
        return {
          team_id: t.id,
          team_name: t.team_name,
          city: t.city,
          state: t.state,
          college: t.college,
          cohort_id: t.cohort_id,
          cohort_name: t.rp_cohorts?.name ?? null,
          current_phase: t.current_phase,
          final_score: Number(a.score.toFixed(2)),
          evaluated_phases: a.phases.size,
          cohort_rank: 0,
          overall_rank: 0,
        };
      })
      .sort((a, b) => b.final_score - a.final_score)
      .slice(0, 200)
      .map((r, i) => ({ ...r, overall_rank: i + 1 }));

    const byCohort = new Map<string, number>();
    for (const r of rows) {
      const k = r.cohort_id ?? "_";
      const next = (byCohort.get(k) ?? 0) + 1;
      byCohort.set(k, next);
      r.cohort_rank = next;
    }

    return { rows, cohorts: cohorts ?? [], filters: data };
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
      .select("id, team_name, current_phase")
      .eq("assigned_evaluator_id", userId);
    const assignedTeamIds = (assignedTeams ?? []).map((t) => t.id);

    // submissions in review-ready states
    const { data: subs, error } = await supabase
      .from("rp_submissions")
      .select(`
        id, team_id, phase_number, title, summary, status, submitted_at, updated_at,
        rp_teams ( team_name, current_phase )
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
          .select("id, submission_id, status, total_score, weighted_score, updated_at, edit_history")
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
  .inputValidator((input: unknown) =>
    z.object({ submissionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: submission, error: subErr } = await supabase
      .from("rp_submissions")
      .select(`
        id, team_id, phase_number, title, summary, status, submitted_at,
        rp_teams ( id, team_name, current_phase ),
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
  .inputValidator((input: unknown) =>
    z.object({
      submissionId: z.string().uuid(),
      rubricScores: z.record(
        z.string().min(1).max(80),
        z.number().min(0).max(1000),
      ),
      comments: z.string().max(4000).optional(),
      submit: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorization: only evaluator / mentor / cfi_admin / super_admin may score.
    const { data: roles, error: rolesErr } = await supabase
      .from("rp_user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesErr) throw rolesErr;
    const allowed = new Set(["evaluator", "mentor", "cfi_admin", "super_admin"]);
    const ok = (roles ?? []).some((r: any) => allowed.has(r.role));
    if (!ok) throw new Error("Forbidden: evaluator role required");

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

    // Fetch existing eval to build history entry (allows re-submission with change log).
    const { data: existing } = await supabase
      .from("rp_evaluations")
      .select("id, total_score, weighted_score, edit_history, status")
      .eq("submission_id", data.submissionId)
      .eq("evaluator_id", userId)
      .maybeSingle();

    const prevHistory: any[] = Array.isArray(existing?.edit_history) ? (existing!.edit_history as any[]) : [];
    const changed = !existing || Number(existing.total_score ?? -1) !== total || Number(existing.weighted_score ?? -1) !== weighted;
    const newHistory = changed
      ? [
          ...prevHistory,
          {
            at: new Date().toISOString(),
            by: userId,
            total_score: total,
            weighted_score: weighted,
            status: data.submit ? "submitted" : "draft",
            prev_total: existing ? Number(existing.total_score ?? 0) : null,
          },
        ].slice(-50)
      : prevHistory;

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
      submitted_at: data.submit ? new Date().toISOString() : (existing?.status === "submitted" ? new Date().toISOString() : null),
      edit_history: newHistory,
    };

    const { data: row, error } = await supabase
      .from("rp_evaluations")
      .upsert(payload, { onConflict: "submission_id,evaluator_id" })
      .select()
      .single();
    if (error) throw error;
    return { evaluation: row };
  });
