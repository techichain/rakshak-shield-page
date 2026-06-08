import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Cohort analytics — admin-only. Compares teams grouped by cohort_id.
export const getCohortAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // admin check
    const { data: roles } = await context.supabase
      .from("rp_user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) =>
      ["cfi_admin", "super_admin"].includes(r.role),
    );
    if (!isAdmin) throw new Error("Forbidden");

    const [cohortsQ, teamsQ, subsQ, evalsQ, locsQ] = await Promise.all([
      context.supabase.from("rp_cohorts").select("id, name, start_date, end_date, status"),
      context.supabase
        .from("rp_teams")
        .select(
          "id, team_name, cohort_id, current_phase, status, risk_status, final_score, evaluated_phases, created_at",
        ),
      context.supabase
        .from("rp_submissions")
        .select("team_id, phase_number, status, submitted_at, created_at"),
      context.supabase
        .from("rp_evaluations")
        .select("team_id, weighted_score, phase_number, status"),
      context.supabase.from("rp_locations").select("team_id, severity, is_final_selected"),
    ]);

    const cohorts = cohortsQ.data ?? [];
    const teams = teamsQ.data ?? [];
    const subs = subsQ.data ?? [];
    const evals = evalsQ.data ?? [];
    const locs = locsQ.data ?? [];

    const teamCohort = new Map<string, string | null>();
    for (const t of teams) teamCohort.set(t.id, t.cohort_id);

    // Per-cohort aggregates
    const summary = cohorts.map((c) => {
      const cTeams = teams.filter((t) => t.cohort_id === c.id);
      const teamIds = new Set(cTeams.map((t) => t.id));
      const cSubs = subs.filter((s) => teamIds.has(s.team_id));
      const cEvals = evals.filter((e) => teamIds.has(e.team_id) && e.status === "submitted");
      const cLocs = locs.filter((l) => teamIds.has(l.team_id));

      const phaseFunnel = [0, 1, 2, 3, 4].map((p) => ({
        phase: p,
        reached: cTeams.filter((t) => (t.current_phase ?? 0) >= p).length,
        approved: cSubs.filter(
          (s) =>
            s.phase_number === p &&
            ["admin_approved", "completed", "mentor_approved"].includes(s.status),
        ).length,
      }));

      const avgScore =
        cEvals.length === 0
          ? 0
          : cEvals.reduce((a, e) => a + Number(e.weighted_score ?? 0), 0) / cEvals.length;

      const atRisk = cTeams.filter((t) => t.risk_status === "at_risk").length;
      const active = cTeams.filter((t) => t.status === "active").length;
      const completed = cTeams.filter((t) => t.status === "completed").length;
      const dropped = cTeams.filter((t) => ["dropped", "disqualified"].includes(t.status)).length;
      const finalLocs = cLocs.filter((l) => l.is_final_selected).length;
      const criticalLocs = cLocs.filter((l) => l.severity === "critical").length;

      return {
        cohort: { id: c.id, name: c.name, status: c.status },
        teams_total: cTeams.length,
        teams_active: active,
        teams_completed: completed,
        teams_dropped: dropped,
        teams_at_risk: atRisk,
        submissions_total: cSubs.length,
        avg_score: Math.round(avgScore * 100) / 100,
        locations_total: cLocs.length,
        locations_final: finalLocs,
        locations_critical: criticalLocs,
        phase_funnel: phaseFunnel,
        completion_rate:
          cTeams.length === 0
            ? 0
            : Math.round((completed / cTeams.length) * 1000) / 10,
      };
    });

    // Score distribution buckets for all evaluated teams (cross-cohort)
    const scoreBuckets = [0, 20, 40, 60, 80].map((min) => {
      const max = min + 20;
      const count = teams.filter(
        (t) =>
          Number(t.final_score ?? 0) >= min && Number(t.final_score ?? 0) < max,
      ).length;
      return { range: `${min}-${max}`, count };
    });

    // Weekly cadence (last 12 weeks) per cohort — submission counts
    const now = Date.now();
    const weeks: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now - i * 7 * 86400000);
      weeks.push(`${d.getFullYear()}-W${String(Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)).padStart(2, "0")}`);
    }
    const weeklyCadence = weeks.map((wk) => {
      const point: any = { week: wk };
      for (const c of cohorts) {
        const teamIds = new Set(teams.filter((t) => t.cohort_id === c.id).map((t) => t.id));
        point[c.name] = subs.filter((s) => {
          if (!teamIds.has(s.team_id)) return false;
          const d = new Date(s.submitted_at ?? s.created_at);
          const k = `${d.getFullYear()}-W${String(Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)).padStart(2, "0")}`;
          return k === wk;
        }).length;
      }
      return point;
    });

    return { summary, scoreBuckets, weeklyCadence, cohortNames: cohorts.map((c) => c.name) };
  });

// Health summary of cron hooks for admins
export const getCronHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) =>
      ["cfi_admin", "super_admin"].includes(r.role),
    );
    if (!isAdmin) throw new Error("Forbidden");

    const { data: rows } = await context.supabase
      .from("rp_cron_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(200);

    const byHook = new Map<string, any[]>();
    for (const r of rows ?? []) {
      const arr = byHook.get(r.hook_name) ?? [];
      arr.push(r);
      byHook.set(r.hook_name, arr);
    }
    const summary = Array.from(byHook.entries()).map(([hook, runs]) => {
      const last = runs[0];
      const ok = runs.filter((r) => r.status === "ok").length;
      const fail = runs.length - ok;
      const expected: Record<string, number> = {
        "admin-digest": 7 * 24 * 3600 * 1000,
        "meeting-reminders": 5 * 60 * 1000,
      };
      const window = expected[hook] ?? 24 * 3600 * 1000;
      const sinceLast = last ? Date.now() - new Date(last.started_at).getTime() : null;
      const isStale = sinceLast !== null && sinceLast > window * 2;
      return {
        hook,
        total_runs: runs.length,
        ok_count: ok,
        fail_count: fail,
        success_rate: runs.length ? Math.round((ok / runs.length) * 1000) / 10 : 0,
        last_run_at: last?.started_at ?? null,
        last_status: last?.status ?? null,
        last_duration_ms: last?.duration_ms ?? null,
        last_error: last?.error_message ?? null,
        is_stale: isStale,
        avg_duration_ms:
          runs.length === 0
            ? 0
            : Math.round(
                runs.reduce((a, r) => a + (r.duration_ms ?? 0), 0) / runs.length,
              ),
      };
    });
    return { summary, recent: (rows ?? []).slice(0, 30) };
  });
