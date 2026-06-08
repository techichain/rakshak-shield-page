import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { Loader2, Award, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/evaluator-leaderboard")({
  component: EvaluatorLeaderboard,
});

type EvalRow = {
  id: string;
  evaluator_id: string | null;
  submission_id: string;
  team_id: string;
  phase_number: number;
  total_score: number;
  status: string;
  submitted_at: string | null;
};

function EvaluatorLeaderboard() {
  const navigate = useNavigate();
  const { loading, userId, isAdmin } = useRPAuth();
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    (async () => {
      const { data } = await supabase
        .from("rp_evaluations")
        .select("id, evaluator_id, submission_id, team_id, phase_number, total_score, status, submitted_at")
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .limit(2000);
      const list = (data ?? []) as EvalRow[];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.evaluator_id).filter(Boolean) as string[]));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("rp_profiles").select("id, full_name, email").in("id", ids);
        setProfiles(Object.fromEntries((profs ?? []).map((p) => [p.id, p])));
      }
      setBusy(false);
    })();
  }, [loading, userId, isAdmin, navigate]);

  // Leaderboard aggregations
  const byEvaluator = new Map<string, { count: number; sum: number; phases: Set<number> }>();
  rows.forEach((r) => {
    if (!r.evaluator_id) return;
    const cur = byEvaluator.get(r.evaluator_id) ?? { count: 0, sum: 0, phases: new Set<number>() };
    cur.count++; cur.sum += Number(r.total_score); cur.phases.add(r.phase_number);
    byEvaluator.set(r.evaluator_id, cur);
  });
  const leaderboard = Array.from(byEvaluator.entries())
    .map(([id, v]) => ({ id, count: v.count, avg: v.sum / v.count, phases: v.phases.size }))
    .sort((a, b) => b.count - a.count);

  // Calibration: per submission, compute mean + max-min spread across evaluators
  const bySubmission = new Map<string, EvalRow[]>();
  rows.forEach((r) => {
    const a = bySubmission.get(r.submission_id) ?? [];
    a.push(r); bySubmission.set(r.submission_id, a);
  });
  const calibration = Array.from(bySubmission.entries())
    .filter(([, list]) => list.length >= 2)
    .map(([sid, list]) => {
      const scores = list.map((x) => Number(x.total_score));
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      return { sid, n: scores.length, min, max, spread: max - min, mean, phase: list[0].phase_number };
    })
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 25);

  if (loading || busy) return <PlatformShell><Section><Loader2 className="animate-spin" /></Section></PlatformShell>;

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Evaluator analytics</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Who's scoring,<br /><span className="text-brand">and how consistently.</span>
        </h1>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Stat label="Evaluators active" value={leaderboard.length} />
          <Stat label="Submitted scores" value={rows.length} />
          <Stat label="Avg score" value={rows.length ? (rows.reduce((a, b) => a + Number(b.total_score), 0) / rows.length).toFixed(1) : "—"} />
        </div>

        <h2 className="mt-14 font-heading text-2xl tracking-tight flex items-center gap-2">
          <Award className="h-5 w-5 text-brand" /> Leaderboard
        </h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3 w-10">#</th><th className="p-3">Evaluator</th><th className="p-3">Scores</th><th className="p-3">Phases</th><th className="p-3">Avg score</th></tr>
            </thead>
            <tbody>
              {leaderboard.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No submitted evaluations yet.</td></tr>}
              {leaderboard.map((e, idx) => {
                const p = profiles[e.id];
                return (
                  <tr key={e.id} className="border-t border-border">
                    <td className="p-3 text-muted-foreground">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-medium">{p?.full_name ?? "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{p?.email}</div>
                    </td>
                    <td className="p-3">{e.count}</td>
                    <td className="p-3">{e.phases}</td>
                    <td className="p-3 font-mono">{e.avg.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h2 className="mt-14 font-heading text-2xl tracking-tight flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-brand" /> Calibration — biggest score spreads
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Submissions where two or more evaluators disagreed most. High spread suggests a calibration session is needed.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">Submission</th><th className="p-3">Phase</th><th className="p-3">#Evals</th><th className="p-3">Min</th><th className="p-3">Max</th><th className="p-3">Spread</th><th className="p-3">Mean</th></tr>
            </thead>
            <tbody>
              {calibration.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No submissions scored by more than one evaluator yet.</td></tr>}
              {calibration.map((c) => (
                <tr key={c.sid} className="border-t border-border">
                  <td className="p-3 font-mono text-xs">{c.sid.slice(0, 8)}…</td>
                  <td className="p-3">P{c.phase}</td>
                  <td className="p-3">{c.n}</td>
                  <td className="p-3 font-mono">{c.min.toFixed(1)}</td>
                  <td className="p-3 font-mono">{c.max.toFixed(1)}</td>
                  <td className={`p-3 font-mono ${c.spread >= 20 ? "text-red-600 font-semibold" : c.spread >= 10 ? "text-amber-600" : ""}`}>{c.spread.toFixed(1)}</td>
                  <td className="p-3 font-mono">{c.mean.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </PlatformShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-heading text-3xl font-bold">{value}</div>
    </div>
  );
}
