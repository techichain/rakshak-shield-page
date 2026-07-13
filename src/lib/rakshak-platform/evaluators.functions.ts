import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only: full roster of evaluators with their evaluations and
 * free-text feedback comments on team reports.
 */
export const listEvaluatorsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("rp_is_admin", {
      _user_id: context.userId,
    });
    if (!isAdmin) throw new Error("Admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRows, error: rolesErr } = await supabaseAdmin
      .from("rp_user_roles")
      .select("user_id")
      .eq("role", "evaluator");
    if (rolesErr) throw rolesErr;
    const evaluatorIds = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
    if (evaluatorIds.length === 0) return { evaluators: [] as any[] };

    const [profilesRes, evalsRes, feedbackRes, teamsRes] = await Promise.all([
      supabaseAdmin
        .from("rp_profiles")
        .select("id, full_name, email, phone, organization")
        .in("id", evaluatorIds),
      supabaseAdmin
        .from("rp_evaluations")
        .select(
          "id, evaluator_id, team_id, submission_id, phase_number, total_score, weighted_score, comments, status, submitted_at, created_at",
        )
        .in("evaluator_id", evaluatorIds),
      supabaseAdmin
        .from("rp_feedback")
        .select("id, reviewer_id, team_id, phase_number, feedback_text, created_at")
        .in("reviewer_id", evaluatorIds)
        .eq("reviewer_role", "evaluator"),
      supabaseAdmin
        .from("rp_teams")
        .select("id, team_name, assigned_evaluator_id"),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (evalsRes.error) throw evalsRes.error;
    if (feedbackRes.error) throw feedbackRes.error;
    if (teamsRes.error) throw teamsRes.error;

    const teamsById = new Map<string, string>();
    const assignedCount = new Map<string, number>();
    for (const t of teamsRes.data ?? []) {
      teamsById.set(t.id, t.team_name ?? "");
      if (t.assigned_evaluator_id) {
        assignedCount.set(
          t.assigned_evaluator_id,
          (assignedCount.get(t.assigned_evaluator_id) ?? 0) + 1,
        );
      }
    }

    const evalsBy = new Map<string, any[]>();
    for (const e of evalsRes.data ?? []) {
      const arr = evalsBy.get(e.evaluator_id) ?? [];
      arr.push({ ...e, team_name: teamsById.get(e.team_id) ?? null });
      evalsBy.set(e.evaluator_id, arr);
    }
    const fbBy = new Map<string, any[]>();
    for (const f of feedbackRes.data ?? []) {
      const arr = fbBy.get(f.reviewer_id) ?? [];
      arr.push({ ...f, team_name: teamsById.get(f.team_id) ?? null });
      fbBy.set(f.reviewer_id, arr);
    }

    const evaluators = (profilesRes.data ?? []).map((p) => {
      const evals = (evalsBy.get(p.id) ?? []).sort(
        (a, b) =>
          new Date(b.submitted_at ?? b.created_at ?? 0).getTime() -
          new Date(a.submitted_at ?? a.created_at ?? 0).getTime(),
      );
      const scored = evals
        .map((e) => Number(e.weighted_score ?? e.total_score))
        .filter((n) => Number.isFinite(n));
      const avg_score = scored.length
        ? Math.round((scored.reduce((s, n) => s + n, 0) / scored.length) * 10) / 10
        : null;
      const last_evaluation_at =
        evals.length > 0 ? (evals[0].submitted_at ?? evals[0].created_at ?? null) : null;
      const feedback_comments = (fbBy.get(p.id) ?? []).sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
      );
      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        organization: p.organization,
        teams_assigned: assignedCount.get(p.id) ?? 0,
        evaluations_count: evals.length,
        avg_score,
        last_evaluation_at,
        evaluations: evals,
        feedback_comments,
      };
    });

    evaluators.sort((a, b) => (b.evaluations_count ?? 0) - (a.evaluations_count ?? 0));
    return { evaluators };
  });
