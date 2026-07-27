import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { computePhaseRanks, listPhaseRanks } from "@/lib/rakshak-platform/ranks.functions";
import { Trophy, Loader2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/ranks")({
  component: AdminRanksPage,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return (
      <PlatformShell>
        <Section>
          <p role="alert" className="text-destructive">
            {String(error)}
          </p>
        </Section>
      </PlatformShell>
    );
  },
  notFoundComponent: () => (
    <PlatformShell>
      <Section>
        <p>Not found.</p>
      </Section>
    </PlatformShell>
  ),
});

const PHASES = [0, 1, 2, 3, 4];

function AdminRanksPage() {
  const listFn = useServerFn(listPhaseRanks);
  const computeFn = useServerFn(computePhaseRanks);
  const [phase, setPhase] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load(p: number) {
    setBusy(true);
    try {
      const res = (await listFn({ data: { phase_number: p } } as any)) as any;
      setRows(res?.leaderboard ?? []);
    } catch (e: any) {
      setMsg(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load(phase).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function recompute() {
    setRunning(true);
    setMsg(null);
    try {
      const res = (await computeFn({ data: { phase_number: phase } } as any)) as any;
      setMsg(`Ranked ${res.ranked} team(s); ${res.notified} notification(s) sent.`);
      await load(phase);
    } catch (e: any) {
      setMsg(String(e?.message ?? e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Recognition</Eyebrow>
        <h1 className="mt-3 font-heading text-3xl tracking-tight sm:text-4xl">
          Phase ranks.
          <br />
          <span className="text-brand">Across every team.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          Teams are ranked globally for each phase using the average of their submitted evaluation
          scores. Recomputing publishes the ranks and notifies each team.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground" htmlFor="phase-select">
            Showing
          </label>

          <select
            id="phase-select"
            value={phase}
            onChange={(e) => setPhase(Number(e.target.value))}
            className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm"
          >
            {PHASES.map((p) => (
              <option key={p} value={p}>
                Phase {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => recompute()}
            disabled={running}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Recompute &amp; publish
          </button>
        </div>

        {msg && (
          <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
            {msg}
          </p>
        )}

        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-brand" />
            <h2 className="font-heading text-lg font-semibold">Phase {phase} leaderboard</h2>
          </div>
          {busy ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No ranks published for this phase yet.
            </p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2">Rank</th>
                  <th className="py-2">Team</th>
                  <th className="py-2">Score</th>
                  <th className="py-2">Published</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.team_id} className="border-t border-border">
                    <td className="py-2 font-heading">#{r.rank}</td>
                    <td className="py-2">{r.team_name}</td>
                    <td className="py-2">{r.score != null ? Number(r.score).toFixed(2) : "—"}</td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(r.computed_at).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>
    </PlatformShell>
  );
}
