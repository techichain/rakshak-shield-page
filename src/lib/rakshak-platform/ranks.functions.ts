import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Global per-phase ranking.
 *
 * Score signal: the average `weighted_score` of SUBMITTED rows in
 * `rp_evaluations` for that team + phase — the same field the existing
 * `rp_recompute_team_score` database function already aggregates, i.e. the
 * value the finalise-review flow actually populates. No new scoring model.
 */

async function ensureAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("rp_is_admin", { _user_id: userId });
  if (!isAdmin) throw new Error("Forbidden: admin only");
}

export type PhaseRankRow = {
  team_id: string;
  team_name: string;
  cohort_id: string | null;
  rank: number;
  score: number | null;
  computed_at: string;
};

export const computePhaseRanks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ phase_number: z.number().int().min(0).max(4) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phase = data.phase_number;

    const { data: teams, error: teamsErr } = await supabaseAdmin
      .from("rp_teams")
      .select("id, team_name, cohort_id, team_leader_id");
    if (teamsErr) throw teamsErr;
    if (!teams || teams.length === 0) return { ranked: 0, notified: 0 };

    const teamIds = teams.map((t: any) => t.id);

    const { data: evals, error: evalErr } = await supabaseAdmin
      .from("rp_evaluations")
      .select("team_id, weighted_score, status, phase_number")
      .eq("phase_number", phase)
      .eq("status", "submitted")
      .in("team_id", teamIds);
    if (evalErr) throw evalErr;

    const { data: progress } = await supabaseAdmin
      .from("rp_team_phase_progress")
      .select("team_id, submitted_at")
      .eq("phase_number", phase)
      .in("team_id", teamIds);
    const submittedAt = new Map<string, string | null>();
    for (const p of progress ?? []) submittedAt.set((p as any).team_id, (p as any).submitted_at);

    const agg = new Map<string, { sum: number; n: number }>();
    for (const e of evals ?? []) {
      const tid = (e as any).team_id as string;
      const v = Number((e as any).weighted_score ?? 0);
      const cur = agg.get(tid) ?? { sum: 0, n: 0 };
      cur.sum += v;
      cur.n += 1;
      agg.set(tid, cur);
    }

    const scored = teams
      .map((t: any) => {
        const a = agg.get(t.id);
        return {
          team: t,
          score: a && a.n > 0 ? a.sum / a.n : null,
          submitted_at: submittedAt.get(t.id) ?? null,
        };
      })
      .filter((r) => r.score !== null);

    if (scored.length === 0) return { ranked: 0, notified: 0 };

    scored.sort((a, b) => {
      if ((b.score as number) !== (a.score as number)) return (b.score as number) - (a.score as number);
      const at = a.submitted_at ? Date.parse(a.submitted_at) : Number.MAX_SAFE_INTEGER;
      const bt = b.submitted_at ? Date.parse(b.submitted_at) : Number.MAX_SAFE_INTEGER;
      if (at !== bt) return at - bt;
      return String(a.team.id).localeCompare(String(b.team.id));
    });

    const now = new Date().toISOString();
    const total = scored.length;
    const rows = scored.map((r, i) => ({
      cohort_id: r.team.cohort_id ?? null,
      phase_number: phase,
      team_id: r.team.id,
      rank: i + 1,
      score: r.score,
      computed_at: now,
      notified_at: now,
    }));

    const { error: upErr } = await supabaseAdmin
      .from("rp_phase_ranks")
      .upsert(rows, { onConflict: "phase_number,team_id" });
    if (upErr) throw upErr;

    // Notify each team leader + members of their rank.
    const { data: members } = await supabaseAdmin
      .from("rp_team_members")
      .select("team_id, profile_id")
      .in("team_id", scored.map((r) => r.team.id));

    const notifRows: any[] = [];
    for (const r of rows) {
      const team = scored.find((s) => s.team.id === r.team_id)!.team;
      const recipients = new Set<string>();
      if (team.team_leader_id) recipients.add(team.team_leader_id);
      for (const m of members ?? []) {
        if ((m as any).team_id === r.team_id && (m as any).profile_id)
          recipients.add((m as any).profile_id);
      }
      for (const rid of recipients) {
        notifRows.push({
          recipient_id: rid,
          title: `Phase ${phase} rank: #${r.rank} of ${total}`,
          message: `${team.team_name} is ranked #${r.rank} out of ${total} teams for Phase ${phase}${
            r.score != null ? ` with a score of ${Number(r.score).toFixed(2)}` : ""
          }.`,
          type: "phase_rank",
          related_entity_type: "rp_phase_ranks",
          related_entity_id: null,
          action_link: "/rakshak-platform/team",
        });
      }
    }

    let notified = 0;
    if (notifRows.length) {
      const { error: nErr } = await supabaseAdmin.from("rp_notifications").insert(notifRows);
      if (nErr) console.error("[ranks] notification insert failed", nErr.message);
      else notified = notifRows.length;
    }

    return { ranked: rows.length, notified };
  });

export const listPhaseRanks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        phase_number: z.number().int().min(0).max(4),
        team_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ranks, error } = await context.supabase
      .from("rp_phase_ranks")
      .select("team_id, cohort_id, rank, score, computed_at")
      .eq("phase_number", data.phase_number)
      .order("rank", { ascending: true });
    if (error) throw error;

    const ids = (ranks ?? []).map((r: any) => r.team_id);
    let names = new Map<string, string>();
    if (ids.length) {
      const { data: teams } = await context.supabase
        .from("rp_teams")
        .select("id, team_name")
        .in("id", ids);
      names = new Map((teams ?? []).map((t: any) => [t.id, t.team_name]));
    }

    const leaderboard: PhaseRankRow[] = (ranks ?? []).map((r: any) => ({
      team_id: r.team_id,
      team_name: names.get(r.team_id) ?? "Team",
      cohort_id: r.cohort_id,
      rank: r.rank,
      score: r.score,
      computed_at: r.computed_at,
    }));

    const own = data.team_id ? (leaderboard.find((r) => r.team_id === data.team_id) ?? null) : null;

    return { leaderboard, total: leaderboard.length, own };
  });
