/**
 * Single source of truth for admin-side team "health" clustering.
 *
 * Health score (0–100) is a blend of three weighted components:
 *   • Completion   40 pts — team completion_percentage / 100 * 40
 *   • Deadlines    30 pts — 30 minus 10 per overdue phase (floored at 0).
 *                           A phase is overdue when its deadline is in the past
 *                           and its status is not an approved/completed state.
 *   • Score/rank   30 pts — the team's percentile rank of evaluation score across
 *                           all teams * 30. Teams with no evaluated score yet are
 *                           treated as neutral (percentile 0.5) so they are not
 *                           punished for simply not having been scored.
 *
 * Buckets:
 *   on_track        health >= 70
 *   needs_attention health >= 45
 *   at_risk         health <  45
 * Hard demotions to at_risk (regardless of health):
 *   • any overdue phase deadline
 *   • an evaluated team sitting in the bottom quartile of scores (percentile < 0.25)
 */

export type ClusterKey = "on_track" | "needs_attention" | "at_risk";

export type HealthPhase = {
  phase_number?: number;
  status?: string | null;
  deadline?: string | null;
};

export type HealthInput = {
  id: string;
  completion_percentage?: number | null;
  /** Evaluation score for the team (final_score or summed weighted score). */
  score?: number | null;
  phases?: HealthPhase[] | null;
};

export type TeamHealth = {
  health: number;
  cluster: ClusterKey;
  overdue_count: number;
  score_percentile: number | null;
};

export const CLUSTER_META: Record<
  ClusterKey,
  { label: string; badge: string; header: string; dot: string; order: number }
> = {
  on_track: {
    label: "On track",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    header: "text-emerald-700",
    dot: "bg-emerald-500",
    order: 0,
  },
  needs_attention: {
    label: "Needs attention",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    header: "text-amber-700",
    dot: "bg-amber-500",
    order: 1,
  },
  at_risk: {
    label: "At risk",
    badge: "bg-red-50 text-red-700 border-red-200",
    header: "text-red-700",
    dot: "bg-red-500",
    order: 2,
  },
};

export const CLUSTER_ORDER: ClusterKey[] = ["on_track", "needs_attention", "at_risk"];

const DONE_STATUSES = new Set([
  "completed",
  "admin_approved",
  "mentor_approved",
]);

export function countOverduePhases(phases: HealthPhase[] | null | undefined, now = Date.now()): number {
  let n = 0;
  for (const p of phases ?? []) {
    if (!p?.deadline) continue;
    const t = new Date(p.deadline).getTime();
    if (!Number.isFinite(t)) continue;
    if (t < now && !DONE_STATUSES.has(String(p.status ?? ""))) n++;
  }
  return n;
}

/** Computes health + cluster for every team, using the cohort for score percentiles. */
export function computeTeamHealth(teams: HealthInput[], now = Date.now()): Map<string, TeamHealth> {
  const scored = teams
    .filter((t) => t.score != null && Number.isFinite(Number(t.score)) && Number(t.score) > 0)
    .map((t) => Number(t.score));
  const sorted = [...scored].sort((a, b) => a - b);

  const percentileOf = (score: number) => {
    if (sorted.length <= 1) return 0.5;
    const below = sorted.filter((s) => s < score).length;
    return below / (sorted.length - 1);
  };

  const out = new Map<string, TeamHealth>();
  for (const t of teams) {
    const completion = Math.max(0, Math.min(100, Number(t.completion_percentage ?? 0)));
    const overdue = countOverduePhases(t.phases, now);
    const hasScore = t.score != null && Number.isFinite(Number(t.score)) && Number(t.score) > 0;
    const pct = hasScore ? percentileOf(Number(t.score)) : null;

    const completionPts = (completion / 100) * 40;
    const deadlinePts = Math.max(0, 30 - overdue * 10);
    const scorePts = (pct ?? 0.5) * 30;

    const health = Math.round(completionPts + deadlinePts + scorePts);

    let cluster: ClusterKey =
      health >= 70 ? "on_track" : health >= 45 ? "needs_attention" : "at_risk";
    if (overdue > 0) cluster = "at_risk";
    if (hasScore && (pct ?? 1) < 0.25) cluster = "at_risk";

    out.set(t.id, { health, cluster, overdue_count: overdue, score_percentile: pct });
  }
  return out;
}
