import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { compareSubmissions, listCohortsForCompare } from "@/lib/rakshak-platform/compare.functions";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";

export const Route = createFileRoute("/rakshak-platform/evaluator/compare")({
  component: ComparePage,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return <PlatformShell><Section><p>{String(error)}</p></Section></PlatformShell>;
  },
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

function ComparePage() {
  const listCohorts = useServerFn(listCohortsForCompare);
  const runCompare = useServerFn(compareSubmissions);

  const { data: cohortsData } = useQuery({
    queryKey: ["rp-compare-cohorts"],
    queryFn: () => listCohorts(),
  });

  const [cohortId, setCohortId] = useState<string>("");
  const [phase, setPhase] = useState<number>(0);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["rp-compare", cohortId, phase],
    queryFn: () => runCompare({ data: { cohortId, phase } }),
    enabled: !!cohortId,
  });

  const rows = data?.rows ?? [];
  const allRubricKeys = Array.from(
    new Set(rows.flatMap((r: any) => Object.keys(r.rubric_avg ?? {}))),
  ).sort();

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Evaluator workspace</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Compare submissions
          <br /><span className="text-brand">side by side.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Pick a cohort and a phase to rank every team's submission by average evaluator score
          and rubric breakdown.
        </p>

        <div className="mt-8 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Cohort</span>
            <select
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              className="min-w-[16rem] rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="">Select cohort…</option>
              {(cohortsData?.cohorts ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.year})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Phase</span>
            <select
              value={phase}
              onChange={(e) => setPhase(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              {[0, 1, 2, 3, 4].map((p) => (
                <option key={p} value={p}>
                  Phase {p} — {PHASE_TITLES[p]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={!cohortId || isFetching}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
          >
            {isFetching ? "Comparing…" : "Refresh"}
          </button>
        </div>

        {!cohortId ? (
          <p className="mt-12 text-muted-foreground">Select a cohort to begin.</p>
        ) : rows.length === 0 ? (
          <p className="mt-12 text-muted-foreground">
            {isFetching ? "Loading…" : "No teams found in this cohort."}
          </p>
        ) : (
          <div className="mt-10 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Submissions comparison</caption>
              <thead className="bg-brand-lite text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Rank</th>
                  <th scope="col" className="px-4 py-3">Team</th>
                  <th scope="col" className="px-4 py-3">Submission</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Evaluators</th>
                  <th scope="col" className="px-4 py-3 text-right">Avg total</th>
                  <th scope="col" className="px-4 py-3 text-right">Avg weighted</th>
                  {allRubricKeys.map((k) => (
                    <th key={k} scope="col" className="px-4 py-3 text-right capitalize">
                      {k.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any, i: number) => (
                  <tr key={r.team_id} className="border-t border-border align-top">
                    <td className="px-4 py-3 font-mono">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.team_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[r.college, r.city, r.state].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.submission ? (
                        <Link
                          to="/rakshak-platform/evaluator/$submissionId"
                          params={{ submissionId: r.submission.id }}
                          className="text-brand hover:underline"
                        >
                          {r.submission.title || "Untitled"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">No submission</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-muted-foreground">
                      {r.submission?.status?.replace(/_/g, " ") ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{r.evaluator_count}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.avg_total == null ? "—" : r.avg_total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {r.avg_weighted == null ? "—" : r.avg_weighted.toFixed(2)}
                    </td>
                    {allRubricKeys.map((k) => (
                      <td key={k} className="px-4 py-3 text-right font-mono">
                        {r.rubric_avg?.[k] == null ? "—" : Number(r.rubric_avg[k]).toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
