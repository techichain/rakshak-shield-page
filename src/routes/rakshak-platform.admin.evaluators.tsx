import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { listEvaluatorsOverview } from "@/lib/rakshak-platform/evaluators.functions";
import { Loader2, Search, ChevronDown, ChevronRight, Users2 } from "lucide-react";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";

export const Route = createFileRoute("/rakshak-platform/admin/evaluators")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["cfi_admin", "super_admin"]);
  },
  component: AdminEvaluatorsPage,
});

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function AdminEvaluatorsPage() {
  const fetchOverview = useServerFn(listEvaluatorsOverview);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await fetchOverview({ data: {} } as any)) as any;
        if (!cancelled) setRows(res?.evaluators ?? []);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchOverview]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.full_name, r.email, r.organization]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Evaluators</Eyebrow>
        <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold flex items-center gap-2">
              <Users2 className="h-7 w-7 text-brand" /> Evaluators
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Roster of evaluators with reports evaluated, scores and free-text feedback comments.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, org…"
              className="pl-9 pr-3 h-10 rounded-full border border-border bg-background text-sm w-72"
            />
          </div>
        </div>

        {err && <p className="mt-6 text-sm text-red-600">{err}</p>}

        {busy ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading evaluators…
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? "No evaluators registered yet." : "No evaluators match your search."}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/30">
                    <th className="px-4 py-3 font-semibold w-8" />
                    <th className="px-4 py-3 font-semibold">Evaluator</th>
                    <th className="px-4 py-3 font-semibold">Organization</th>
                    <th className="px-4 py-3 font-semibold text-right">Teams assigned</th>
                    <th className="px-4 py-3 font-semibold text-right">Reports evaluated</th>
                    <th className="px-4 py-3 font-semibold text-right">Avg score</th>
                    <th className="px-4 py-3 font-semibold">Last evaluated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const isOpen = expanded === r.id;
                    return (
                      <>
                        <tr
                          key={r.id}
                          onClick={() => setExpanded(isOpen ? null : r.id)}
                          className="border-b border-border/60 hover:bg-muted/30 cursor-pointer"
                        >
                          <td className="px-4 py-3 align-top">
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="font-semibold">{r.full_name ?? "—"}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {r.email ?? "—"}
                              {r.phone ? ` · ${r.phone}` : ""}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-muted-foreground">
                            {r.organization ?? "—"}
                          </td>
                          <td className="px-4 py-3 align-top text-right font-semibold">
                            {r.teams_assigned}
                          </td>
                          <td className="px-4 py-3 align-top text-right font-semibold">
                            {r.evaluations_count}
                          </td>
                          <td className="px-4 py-3 align-top text-right">
                            {r.avg_score ?? "—"}
                          </td>
                          <td className="px-4 py-3 align-top text-muted-foreground">
                            {fmtDate(r.last_evaluation_at)}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={r.id + "-detail"} className="bg-muted/10">
                            <td />
                            <td colSpan={6} className="px-4 py-4">
                              <div className="grid gap-6 lg:grid-cols-2">
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Evaluations ({r.evaluations.length})
                                  </div>
                                  {r.evaluations.length === 0 ? (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      No evaluations recorded.
                                    </p>
                                  ) : (
                                    <ul className="mt-2 space-y-2">
                                      {r.evaluations.map((e: any) => (
                                        <li
                                          key={e.id}
                                          className="rounded-lg border border-border p-2 text-sm bg-card"
                                        >
                                          <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-muted-foreground">
                                            <span>
                                              <span className="font-semibold text-foreground">
                                                {e.team_name ?? "—"}
                                              </span>
                                              {" · Phase "}
                                              {e.phase_number}
                                              {PHASE_TITLES[e.phase_number]
                                                ? ` — ${PHASE_TITLES[e.phase_number]}`
                                                : ""}
                                            </span>
                                            <span>
                                              Score:{" "}
                                              <span className="font-semibold text-foreground">
                                                {e.weighted_score ?? e.total_score ?? "—"}
                                              </span>
                                              {" · "}
                                              {e.status ?? "—"}
                                              {" · "}
                                              {fmtDate(e.submitted_at ?? e.created_at)}
                                            </span>
                                          </div>
                                          {e.comments && (
                                            <p className="mt-1 whitespace-pre-line">
                                              {e.comments}
                                            </p>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Feedback comments on reports ({r.feedback_comments.length})
                                  </div>
                                  {r.feedback_comments.length === 0 ? (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      No free-text feedback comments posted.
                                    </p>
                                  ) : (
                                    <ul className="mt-2 space-y-2">
                                      {r.feedback_comments.map((f: any) => (
                                        <li
                                          key={f.id}
                                          className="rounded-lg border border-border p-2 text-sm bg-card"
                                        >
                                          <div className="text-[11px] text-muted-foreground">
                                            <span className="font-semibold text-foreground">
                                              {f.team_name ?? "—"}
                                            </span>
                                            {f.phase_number != null
                                              ? ` · Phase ${f.phase_number}`
                                              : ""}
                                            {" · "}
                                            {fmtDate(f.created_at)}
                                          </div>
                                          <p className="mt-1 whitespace-pre-line">
                                            {f.feedback_text}
                                          </p>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
