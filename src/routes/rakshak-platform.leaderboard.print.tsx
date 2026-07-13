import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { getLeaderboard } from "@/lib/rakshak-platform/evaluations.functions";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { Printer } from "lucide-react";

const search = z.object({
  cohortId: fallback(z.string().optional(), undefined),
  phase: fallback(z.string().optional(), undefined),
  from: fallback(z.string().optional(), undefined),
  to: fallback(z.string().optional(), undefined),
});

function toFilters(s: { cohortId?: string; phase?: string; from?: string; to?: string }) {
  return {
    cohortId: s.cohortId || undefined,
    phase: s.phase ? Number(s.phase) : null,
    submittedFrom: s.from ? new Date(s.from).toISOString() : null,
    submittedTo: s.to ? new Date(s.to + "T23:59:59").toISOString() : null,
  };
}

export const Route = createFileRoute("/rakshak-platform/leaderboard/print")({
  validateSearch: zodValidator(search),
  loaderDeps: ({ search: s }) => ({ cohortId: s.cohortId, phase: s.phase, from: s.from, to: s.to }),
  loader: ({ context, deps }) => {
    const filters = toFilters(deps);
    return context.queryClient.ensureQueryData({
      queryKey: ["rp-leaderboard-print", filters],
      queryFn: () => getLeaderboard({ data: filters as any }),
    });
  },
  component: PrintLeaderboard,
  pendingComponent: () => <div className="p-10 text-sm">Loading leaderboard…</div>,
  errorComponent: ({ error }) => <div className="p-10 text-sm text-red-600">Could not load leaderboard: {String(error)}</div>,
});

function PrintLeaderboard() {
  const { cohortId, phase, from, to } = Route.useSearch();
  const run = useServerFn(getLeaderboard);

  const filters = useMemo(() => toFilters({ cohortId, phase, from, to }), [cohortId, phase, from, to]);

  const { data } = useSuspenseQuery({
    queryKey: ["rp-leaderboard-print", filters],
    queryFn: () => run({ data: filters as any }),
  });

  const rows = data.rows ?? [];
  const scope = [
    phase ? `Phase ${phase} — ${PHASE_TITLES[Number(phase)]}` : "All phases",
    (from || to) ? `${from || "…"} → ${to || "…"}` : null,
    cohortId ? (data.cohorts?.find((c: any) => c.id === cohortId)?.name ?? "Cohort") : null,
  ].filter(Boolean).join(" · ");

  useEffect(() => { document.title = "Leaderboard · Rakshak"; }, []);

  return (
    <div className="bg-white text-black p-10 print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          table { font-size: 10pt; }
        }
        @page { margin: 1.5cm; }
      `}</style>
      <div className="no-print mb-6 flex items-center justify-between">
        <a href="/rakshak-platform/leaderboard" className="text-sm text-brand">← Back to leaderboard</a>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground">
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>
      <div className="border-b-2 border-black/80 pb-4 mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-black/60">Crashfree India · Project Rakshak</div>
        <h1 className="font-bold text-3xl mt-2">Cohort leaderboard</h1>
        <div className="text-sm text-black/70 mt-1">
          Generated {new Date().toLocaleString("en-IN")} · {rows.length} team{rows.length === 1 ? "" : "s"} · {scope}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-black/60">No teams in this scope.</p>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {["Rank", "Team", "College", "City", "State", "Cohort", "Phase", "Evaluated phases", "Score"].map((h) => (
                <th key={h} className="text-left border border-black/30 px-2 py-1 bg-black/5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.team_id} className="even:bg-black/[0.02]">
                <td className="border border-black/15 px-2 py-1">#{r.overall_rank}</td>
                <td className="border border-black/15 px-2 py-1 font-semibold">{r.team_name}</td>
                <td className="border border-black/15 px-2 py-1">{r.college ?? "—"}</td>
                <td className="border border-black/15 px-2 py-1">{r.city ?? "—"}</td>
                <td className="border border-black/15 px-2 py-1">{r.state ?? "—"}</td>
                <td className="border border-black/15 px-2 py-1">{r.cohort_name ?? "—"}</td>
                <td className="border border-black/15 px-2 py-1">{r.current_phase}</td>
                <td className="border border-black/15 px-2 py-1">{r.evaluated_phases}</td>
                <td className="border border-black/15 px-2 py-1 text-right font-mono font-semibold">{Number(r.final_score).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-10 text-xs text-black/50 border-t border-black/20 pt-4">
        Project Rakshak · Crashfree India · Standings reflect the filter scope shown above.
      </div>
    </div>
  );
}
