import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getLeaderboard } from "@/lib/rakshak-platform/evaluations.functions";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { Trophy, MapPin, Download, Printer } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/leaderboard")({
  head: () => ({
    meta: [
      { title: "Cohort Leaderboard — Project Rakshak" },
      { name: "description", content: "Live rankings of teams across the Project Rakshak road-safety programme." },
      { property: "og:title", content: "Cohort Leaderboard — Project Rakshak" },
      { property: "og:description", content: "Live rankings of teams across the Project Rakshak road-safety programme." },
    ],
  }),
  component: LeaderboardPage,
});

function toCsv(rows: any[]): string {
  if (rows.length === 0) return "";
  const cols = ["overall_rank", "team_name", "college", "city", "state", "cohort_name", "current_phase", "evaluated_phases", "final_score"];
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function LeaderboardPage() {
  const fetchLeaderboard = useServerFn(getLeaderboard);
  const [cohortId, setCohortId] = useState<string>("");
  const [phase, setPhase] = useState<string>("all"); // "all" | "0".."4"
  const [from, setFrom] = useState<string>(""); // yyyy-mm-dd
  const [to, setTo] = useState<string>("");

  const filters = useMemo(() => ({
    cohortId: cohortId || undefined,
    phase: phase === "all" ? null : Number(phase),
    submittedFrom: from ? new Date(from).toISOString() : null,
    submittedTo: to ? new Date(to + "T23:59:59").toISOString() : null,
  }), [cohortId, phase, from, to]);

  const { data, isLoading } = useQuery({
    queryKey: ["rp-leaderboard", filters],
    queryFn: () => fetchLeaderboard({ data: filters as any }),
  });

  const rows = data?.rows ?? [];
  const cohorts = data?.cohorts ?? [];
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  const scopeLabel = useMemo(() => {
    const parts: string[] = [];
    parts.push(phase === "all" ? "All phases" : `Phase ${phase} · ${PHASE_TITLES[Number(phase)]}`);
    if (from || to) parts.push(`${from || "…"} → ${to || "…"}`);
    if (cohortId) parts.push(cohorts.find((c: any) => c.id === cohortId)?.name ?? "Cohort");
    return parts.join(" · ");
  }, [phase, from, to, cohortId, cohorts]);

  function downloadCsv() {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rakshak-leaderboard-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  const printSearch = {
    cohortId: cohortId || undefined,
    phase: phase === "all" ? undefined : phase,
    from: from || undefined,
    to: to || undefined,
  };

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Programme rankings</Eyebrow>
        <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          The teams making roads
          <br /><span className="text-brand">safer.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          See how teams are ranking against each other across phases. Ranks update after evaluations are finalised.
        </p>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Weighted scores across all five phases of Project Rakshak. Filter by phase or evaluation window
          to recalibrate the standings, then export the result.
        </p>


        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setCohortId("")}
            className={`rounded-full border px-4 py-1.5 text-sm ${cohortId === "" ? "border-brand text-brand bg-brand-lite" : "border-border text-muted-foreground hover:border-brand/40"}`}
          >
            All cohorts
          </button>
          {cohorts.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setCohortId(c.id)}
              className={`rounded-full border px-4 py-1.5 text-sm ${cohortId === c.id ? "border-brand text-brand bg-brand-lite" : "border-border text-muted-foreground hover:border-brand/40"}`}
            >
              {c.name} · {c.year}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-foreground">Phase</label>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              className="mt-1 h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="all">All phases</option>
              {[0, 1, 2, 3, 4].map((p) => (
                <option key={p} value={String(p)}>Phase {p} — {PHASE_TITLES[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-foreground">Cohort start</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-10 rounded-lg border border-border bg-background px-3 text-sm" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-foreground">Deadline before</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-10 rounded-lg border border-border bg-background px-3 text-sm" />
          </div>

          {(phase !== "all" || from || to) && (
            <button
              onClick={() => { setPhase("all"); setFrom(""); setTo(""); }}
              className="h-10 rounded-full border border-border px-4 text-sm text-muted-foreground hover:border-brand/40"
            >
              Reset filters
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={downloadCsv}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <Link
              to="/rakshak-platform/leaderboard/print"
              search={printSearch}
              target="_blank"
              className="inline-flex items-center gap-2 h-10 rounded-full border border-border px-5 text-sm hover:border-brand/40"
            >
              <Printer className="h-4 w-4" /> PDF
            </Link>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">Scope: {scopeLabel}</p>

        {isLoading ? (
          <p className="mt-12 text-sm text-muted-foreground">Loading rankings…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            className="mt-12"
            icon={Trophy}
            title="No ranks yet for this phase"
            description="As teams complete this phase and are evaluated, the leaderboard will populate here."
          />

        ) : (
          <>
            {podium.length > 0 && (
              <div className="mt-12 grid gap-5 md:grid-cols-3">
                {podium.map((row: any, i: number) => (
                  <div
                    key={row.team_id}
                    className={`rounded-2xl border p-6 ${
                      i === 0 ? "border-brand bg-brand-lite" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Trophy className={`h-6 w-6 ${i === 0 ? "text-brand" : "text-muted-foreground"}`} />
                      <span className="text-3xl font-heading font-bold text-brand">#{row.overall_rank}</span>
                    </div>
                    <div className="mt-4 font-heading text-lg font-semibold">{row.team_name}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {row.city}, {row.state}
                    </div>
                    <div className="mt-4 text-3xl font-heading font-bold">{Number(row.final_score).toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">across {row.evaluated_phases} evaluated phase{row.evaluated_phases === 1 ? "" : "s"}</div>
                  </div>
                ))}
              </div>
            )}
            {rest.length > 0 && (
              <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3 hidden md:table-cell">Location</th>
                      <th className="px-4 py-3 hidden lg:table-cell">Cohort</th>
                      <th className="px-4 py-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((row: any) => (
                      <tr key={row.team_id} className="border-t border-border">
                        <td className="px-4 py-3 font-mono text-muted-foreground">#{row.overall_rank}</td>
                        <td className="px-4 py-3 font-medium">{row.team_name}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{row.city}, {row.state}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{row.cohort_name ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{Number(row.final_score).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Section>
    </PlatformShell>
  );
}
