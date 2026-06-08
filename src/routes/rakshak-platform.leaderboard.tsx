import { createFileRoute} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getLeaderboard } from "@/lib/rakshak-platform/evaluations.functions";
import { Trophy, MapPin } from "lucide-react";

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

function LeaderboardPage() {
  const fetchLeaderboard = useServerFn(getLeaderboard);
  const [cohortId, setCohortId] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["rp-leaderboard", cohortId],
    queryFn: () => fetchLeaderboard({ data: cohortId ? { cohortId } : undefined }),
  });

  const rows = data?.rows ?? [];
  const cohorts = data?.cohorts ?? [];
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Programme rankings</Eyebrow>
        <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          The teams making roads
          <br /><span className="text-brand">safer.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-muted-foreground">
          Weighted scores across all five phases of Project Rakshak. Higher rank = more measurable
          impact and stronger evaluator reviews.
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

        {isLoading ? (
          <p className="mt-12 text-sm text-muted-foreground">Loading rankings…</p>
        ) : rows.length === 0 ? (
          <p className="mt-12 text-sm text-muted-foreground">No scored teams yet — check back once evaluators submit reviews.</p>
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
                    <div className="text-xs text-muted-foreground">across {row.evaluated_phases} evaluated phases</div>
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
