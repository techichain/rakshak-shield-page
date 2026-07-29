import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, isAfter, isBefore, parseISO, startOfDay, endOfDay } from "date-fns";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CalendarIcon, X, Trophy } from "lucide-react";
import { EmptyState } from "@/components/rakshak-platform/EmptyState";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  phase: z.string().optional(),
});

const ALL_PHASES_VALUE = "all-phases";


export const Route = createFileRoute("/rakshak-platform/admin/evaluator-leaderboard")({
  validateSearch: zodValidator(searchSchema),
  component: EvaluatorLeaderboard,
  errorComponent: ({ error }) => (
    <PlatformShell>
      <Section>
        <Eyebrow>Evaluator activity &amp; calibration</Eyebrow>
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-semibold text-red-700">Failed to load evaluator analytics</p>
          <p className="mt-1 text-sm text-red-600">{error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      </Section>
    </PlatformShell>
  ),
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
  const navigate = useNavigate({ from: "/rakshak-platform/admin/evaluator-leaderboard" });
  const search = Route.useSearch();
  const { loading, userId, isAdmin } = useRPAuth();
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [busy, setBusy] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const fromDate = search.from ? parseISO(search.from) : undefined;
  const toDate = search.to ? parseISO(search.to) : undefined;
  const phaseFilter = search.phase ? Number(search.phase) : undefined;

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    (async () => {
      setBusy(true);
      setFetchError(null);
      try {
        const { data, error: dbErr } = await supabase
          .from("rp_evaluations")
          .select("id, evaluator_id, submission_id, team_id, phase_number, total_score, status, submitted_at")
          .eq("status", "submitted")
          .order("submitted_at", { ascending: false })
          .limit(2000);
        if (dbErr) throw new Error(dbErr.message);
        const list = (data ?? []) as EvalRow[];
        setRows(list);
        const ids = Array.from(new Set(list.map((r) => r.evaluator_id).filter(Boolean) as string[]));
        if (ids.length) {
          const { data: profs, error: profErr } = await supabase
            .from("rp_profiles").select("id, full_name, email").in("id", ids);
          if (!profErr) setProfiles(Object.fromEntries((profs ?? []).map((p) => [p.id, p])));
        } else {
          setProfiles({});
        }
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Failed to load evaluations");
        setRows([]);
        setProfiles({});
      } finally {
        setBusy(false);
      }
    })();
  }, [loading, userId, isAdmin, navigate, reloadKey]);

  useRealtimeRefresh(
    "admin-evaluator-leaderboard-realtime",
    ["rp_evaluations"],
    () => setReloadKey((k) => k + 1),
    { enabled: !loading && !!userId && isAdmin },
  );




  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (phaseFilter !== undefined && r.phase_number !== phaseFilter) return false;
      if (fromDate && r.submitted_at) {
        if (isBefore(parseISO(r.submitted_at), startOfDay(fromDate))) return false;
      }
      if (toDate && r.submitted_at) {
        if (isAfter(parseISO(r.submitted_at), endOfDay(toDate))) return false;
      }
      return true;
    });
  }, [rows, fromDate, toDate, phaseFilter]);

  const setFilter = (patch: Partial<z.infer<typeof searchSchema>>) => {
    navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, ...patch }) });
  };

  const clearFilters = () => {
    navigate({ search: {} });
  };

  // Leaderboard aggregations (scoped to filteredRows)
  const byEvaluator = new Map<string, { count: number; sum: number; phases: Set<number> }>();
  filteredRows.forEach((r) => {
    if (!r.evaluator_id) return;
    const cur = byEvaluator.get(r.evaluator_id) ?? { count: 0, sum: 0, phases: new Set<number>() };
    cur.count++; cur.sum += Number(r.total_score); cur.phases.add(r.phase_number);
    byEvaluator.set(r.evaluator_id, cur);
  });
  const leaderboard = Array.from(byEvaluator.entries())
    .map(([id, v]) => ({ id, count: v.count, avg: v.sum / v.count, phases: v.phases.size }))
    .sort((a, b) => b.count - a.count);

  // Calibration: per submission, compute mean + max-min spread across evaluators (scoped to filteredRows)
  const bySubmission = new Map<string, EvalRow[]>();
  filteredRows.forEach((r) => {
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

  const hasActiveFilters = !!(search.from || search.to || search.phase);

  if (loading || busy) return <PlatformShell><Section><Loader2 className="animate-spin" /></Section></PlatformShell>;

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Evaluator activity &amp; calibration</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Evaluator activity<br /><span className="text-brand">&amp; calibration.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Who's scoring, and how consistently — not a ranking of evaluators.
        </p>

        {/* Filters */}
        <div className="mt-8 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">From</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !fromDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fromDate ? format(fromDate, "PP") : <span>Pick date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={(d) => setFilter({ from: d ? format(d, "yyyy-MM-dd") : undefined })}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">To</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !toDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {toDate ? format(toDate, "PP") : <span>Pick date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={(d) => setFilter({ to: d ? format(d, "yyyy-MM-dd") : undefined })}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Phase</label>
            <Select value={search.phase ?? ALL_PHASES_VALUE} onValueChange={(v) => setFilter({ phase: v === ALL_PHASES_VALUE ? undefined : v })}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All phases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PHASES_VALUE}>All phases</SelectItem>
                {[1, 2, 3, 4].map((p) => (
                  <SelectItem key={p} value={String(p)}>Phase {p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="mb-0.5">
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap gap-2">
            {search.from && <Badge variant="secondary">From {format(parseISO(search.from), "PP")}</Badge>}
            {search.to && <Badge variant="secondary">To {format(parseISO(search.to), "PP")}</Badge>}
            {search.phase && <Badge variant="secondary">Phase {search.phase}</Badge>}
          </div>
        )}

        {fetchError ? (
          <EmptyState
            className="mt-8"
            tone="card"
            icon={AlertTriangle}
            title="Couldn't load evaluator data"
            description={fetchError}
            action={{ label: "Try again", onClick: () => setReloadKey((k) => k + 1) }}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            className="mt-8"
            tone="card"
            icon={Trophy}
            title="No evaluations yet"
            description="Evaluator scores will appear here once submissions are reviewed."
          />
        ) : (
          <>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Stat label="Evaluators active" value={leaderboard.length} />
          <Stat label="Submitted scores (scoped)" value={filteredRows.length} />
          <Stat label="Avg score (scoped)" value={filteredRows.length ? (filteredRows.reduce((a, b) => a + Number(b.total_score), 0) / filteredRows.length).toFixed(1) : "—"} />
        </div>


        <h2 className="mt-14 font-heading text-2xl tracking-tight flex items-center gap-2">
          Evaluator activity
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          How many submissions each evaluator has scored, which phases they covered, and the average score they gave. This reflects workload and scoring tendency — it is not a measure of evaluator quality or a ranking.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">Evaluator</th><th className="p-3">Scores submitted</th><th className="p-3">Phases covered</th><th className="p-3">Avg score given</th></tr>
            </thead>
            <tbody>
              {leaderboard.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No submitted evaluations match the current filters.</td></tr>}
              {leaderboard.map((e) => {
                const p = profiles[e.id];
                return (
                  <tr key={e.id} className="border-t border-border">
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
          Submissions scored by two or more evaluators, ordered by how far apart their scores were. A large spread means evaluators disagreed — a signal to run a calibration/alignment session, not that anyone scored wrong.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">Submission</th><th className="p-3">Phase</th><th className="p-3">#Evals</th><th className="p-3">Min</th><th className="p-3">Max</th><th className="p-3">Spread</th><th className="p-3">Mean</th></tr>
            </thead>
            <tbody>
              {calibration.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No multi-evaluator submissions match the current filters.</td></tr>}
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
          </>
        )}
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
