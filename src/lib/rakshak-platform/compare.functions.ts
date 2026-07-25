import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Evaluator/admin: compare submissions within a cohort for a given phase.
 * Returns per-team rows with submission metadata + averaged evaluator score
 * + rubric breakdown so the UI can show a side-by-side table.
 */
export const compareSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cohortId: string; phase: number }) =>
    z.object({ cohortId: z.string().uuid(), phase: z.number().int().min(0).max(4) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: roles } = await supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const ok = (roles ?? []).some((r: any) =>
      ["evaluator", "cfi_admin", "super_admin", "mentor"].includes(r.role));
    if (!ok) throw new Error("Forbidden");


    const { data: teams, error: tErr } = await supabase
      .from("rp_teams")
      .select("id, team_name, college, city, state")
      .eq("cohort_id", data.cohortId);
    if (tErr) throw tErr;
    const teamIds = (teams ?? []).map((t) => t.id);
    if (teamIds.length === 0) return { rows: [] };

    const { data: subs, error: sErr } = await supabase
      .from("rp_submissions")
      .select("id, team_id, title, summary, status, submitted_at")
      .in("team_id", teamIds)
      .eq("phase_number", data.phase)
      .order("submitted_at", { ascending: false });
    if (sErr) throw sErr;

    const subByTeam = new Map<string, any>();
    for (const s of subs ?? []) {
      if (!subByTeam.has(s.team_id)) subByTeam.set(s.team_id, s);
    }

    const submissionIds = Array.from(subByTeam.values()).map((s) => s.id);
    const evalsBySub = new Map<string, any[]>();
    if (submissionIds.length > 0) {
      const { data: evals, error: eErr } = await supabase
        .from("rp_evaluations")
        .select("submission_id, evaluator_id, total_score, weighted_score, rubric_scores, comments, status, submitted_at")
        .in("submission_id", submissionIds);
      if (eErr) throw eErr;
      for (const e of evals ?? []) {
        const arr = evalsBySub.get(e.submission_id) ?? [];
        arr.push(e);
        evalsBySub.set(e.submission_id, arr);
      }
    }

    const rows = (teams ?? []).map((t) => {
      const sub = subByTeam.get(t.id);
      const evals = sub ? evalsBySub.get(sub.id) ?? [] : [];
      const submitted = evals.filter((e) => e.status === "submitted");
      const avgTotal =
        submitted.length === 0
          ? null
          : submitted.reduce((a, e) => a + Number(e.total_score || 0), 0) / submitted.length;
      const avgWeighted =
        submitted.length === 0
          ? null
          : submitted.reduce((a, e) => a + Number(e.weighted_score || 0), 0) / submitted.length;

      const rubricSums: Record<string, { sum: number; n: number }> = {};
      for (const e of submitted) {
        const rs = (e.rubric_scores ?? {}) as Record<string, number>;
        for (const [k, v] of Object.entries(rs)) {
          const entry = rubricSums[k] ?? { sum: 0, n: 0 };
          entry.sum += Number(v) || 0;
          entry.n += 1;
          rubricSums[k] = entry;
        }
      }
      const rubricAvg: Record<string, number> = {};
      for (const [k, { sum, n }] of Object.entries(rubricSums)) rubricAvg[k] = sum / n;

      return {
        team_id: t.id,
        team_name: t.team_name,
        college: t.college,
        city: t.city,
        state: t.state,
        submission: sub
          ? { id: sub.id, title: sub.title, summary: sub.summary, status: sub.status, submitted_at: sub.submitted_at }
          : null,
        evaluator_count: submitted.length,
        avg_total: avgTotal,
        avg_weighted: avgWeighted,
        rubric_avg: rubricAvg,
      };
    });

    rows.sort((a, b) => (b.avg_weighted ?? -1) - (a.avg_weighted ?? -1));
    return { rows };
  });

/** Admin/evaluator: cohort dropdown source. */
export const listCohortsForCompare = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const ok = (roles ?? []).some((r: any) =>
      ["evaluator", "cfi_admin", "super_admin", "mentor"].includes(r.role));
    if (!ok) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("rp_cohorts")
      .select("id, name, year, region")
      .order("year", { ascending: false });
    if (error) throw error;
    return { cohorts: data ?? [] };
  });
