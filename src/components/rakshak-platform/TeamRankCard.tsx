import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listPhaseRanks, type PhaseRankRow } from "@/lib/rakshak-platform/ranks.functions";
import { Trophy, Loader2 } from "lucide-react";

/** Phase E — "Your rank" widget. Renders nothing until a rank exists. */
export function TeamRankCard({ teamId, phaseNumber }: { teamId: string; phaseNumber: number }) {
  const listFn = useServerFn(listPhaseRanks);
  const [own, setOwn] = useState<PhaseRankRow | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await listFn({
          data: { phase_number: phaseNumber, team_id: teamId },
        } as any)) as any;
        if (!cancelled) {
          setOwn(res?.own ?? null);
          setTotal(res?.total ?? 0);
        }
      } catch {
        // enrichment only
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listFn, teamId, phaseNumber]);

  if (busy) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading rank…
        </div>
      </div>
    );
  }
  if (!own) return null;

  return (
    <div className="rounded-2xl border border-brand/30 bg-brand-lite/50 p-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-brand" />
        <h2 className="font-heading text-lg font-semibold">Your rank</h2>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-heading text-4xl text-brand">#{own.rank}</span>
        <span className="text-sm text-muted-foreground">of {total} teams · Phase {phaseNumber}</span>
      </div>
      {own.score != null && (
        <p className="mt-1 text-sm text-muted-foreground">
          Average evaluation score: {Number(own.score).toFixed(2)}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Published {new Date(own.computed_at).toLocaleDateString("en-IN")}
      </p>
    </div>
  );
}
