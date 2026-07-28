/**
 * Renders an evaluation's rubric breakdown.
 * - New structured format: [{ key, label, score, max_score }] → per-criterion table.
 * - Legacy freeform / key→score map → single total.
 */
export function RubricScoreBreakdown({
  rubricScores,
  totalScore,
}: {
  rubricScores: unknown;
  totalScore?: number | null;
}) {
  const rows = Array.isArray(rubricScores)
    ? (rubricScores as Array<{ key: string; label: string; score: number; max_score: number; comment?: string }>)
    : [];


  if (rows.length === 0) {
    return (
      <p className="text-sm">
        Score: <span className="font-mono font-semibold">{Number(totalScore ?? 0)}</span>
      </p>
    );
  }

  const total = rows.reduce((s, r) => s + Number(r.score ?? 0), 0);
  const max = rows.reduce((s, r) => s + Number(r.max_score ?? 0), 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Criterion</th>
            <th className="px-3 py-2 text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border">
              <td className="px-3 py-1.5">
                {r.label}
                {r.comment && (
                  <div className="mt-0.5 text-xs text-muted-foreground whitespace-pre-wrap">{r.comment}</div>
                )}
              </td>
              <td className="px-3 py-1.5 text-right font-mono align-top">
                {Number(r.score ?? 0)} / {Number(r.max_score ?? 0)}
              </td>
            </tr>
          ))}

          <tr className="border-t border-border bg-muted/30 font-semibold">
            <td className="px-3 py-1.5">Total</td>
            <td className="px-3 py-1.5 text-right font-mono">
              {total} / {max}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
