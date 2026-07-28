import { createFileRoute, Link, useNavigate} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { getSubmissionForScoring, upsertEvaluation } from "@/lib/rakshak-platform/evaluations.functions";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { MessageThread } from "@/components/rakshak-platform/MessageThread";
import { ArrowLeft, Save, Send } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/evaluator/$submissionId")({
  component: ScoringPage,
});

interface Criterion {
  key: string;
  label: string;
  description?: string;
  max_score: number;
}

function ScoringPage() {
  const { submissionId } = Route.useParams();
  const { loading, userId, isEvaluator } = useRPAuth();
  const navigate = useNavigate();
  const fetchData = useServerFn(getSubmissionForScoring);
  const saveFn = useServerFn(upsertEvaluation);
  const allowed = isEvaluator;

  useEffect(() => {
    if (loading) return;
    if (!userId) navigate({ to: "/rakshak-platform/auth" });
    else if (!allowed) navigate({ to: "/rakshak-platform/dashboard" });
  }, [loading, userId, allowed, navigate]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["rp-scoring", submissionId],
    queryFn: () => fetchData({ data: { submissionId } }),
    enabled: !!userId && allowed,
  });

  // Admin-authored rubric template wins; otherwise fall back to the legacy
  // per-phase rubric; otherwise freeform scoring.
  const template = (data as any)?.template ?? null;
  const criteria = useMemo<Criterion[]>(
    () =>
      (((template?.criteria ?? data?.rubric?.criteria ?? []) as unknown) as Criterion[]),
    [template, data]
  );
  const hasRubric = criteria.length > 0;
  const [scores, setScores] = useState<Record<string, number>>({});
  const [freeformTotal, setFreeformTotal] = useState<number>(0);
  const [comments, setComments] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const initial: Record<string, number> = {};
    const raw = data.myEval?.rubric_scores;
    // Structured breakdown (new) or key→score map (legacy).
    const prev: Record<string, number> = Array.isArray(raw)
      ? Object.fromEntries((raw as any[]).map((r) => [r.key, Number(r.score ?? 0)]))
      : ((raw ?? {}) as Record<string, number>);
    criteria.forEach((c) => {
      initial[c.key] = Number(prev[c.key] ?? 0);
    });
    setScores(initial);
    setFreeformTotal(Number(data.myEval?.total_score ?? 0));
    setComments(data.myEval?.comments ?? "");
  }, [data, criteria]);

  const PHASE_WEIGHTS: Record<number, number> = { 0: 10, 1: 20, 2: 20, 3: 25, 4: 25 };
  const phaseNumber = Number(data?.submission?.phase_number ?? 0);
  const total = hasRubric
    ? criteria.reduce((sum, c) => sum + Math.min(c.max_score, Math.max(0, Number(scores[c.key] ?? 0))), 0)
    : freeformTotal;
  const max = hasRubric
    ? template
      ? criteria.reduce((s, c) => s + Number(c.max_score ?? 0), 0)
      : Number(data?.rubric?.max_total_score ?? 100)
    : 100;
  const weight = Number(data?.rubric?.phase_weight ?? PHASE_WEIGHTS[phaseNumber] ?? 20);
  const weighted = max > 0 ? (total / max) * weight : 0;

  const mutate = useMutation({
    mutationFn: (submit: boolean) =>
      saveFn({
        data: {
          submissionId,
          rubricScores: scores,
          ...(hasRubric ? {} : { freeformTotal }),
          comments,
          submit,
        },
      }),
    onSuccess: (_, submit) => {
      setSavedAt(new Date().toLocaleTimeString());
      refetch();
      if (submit) navigate({ to: "/rakshak-platform/evaluator" });
    },
  });

  if (loading || isLoading || !data) {
    return <PlatformShell hideMenu><Section>Loading submission…</Section></PlatformShell>;
  }

  const submission = data.submission;
  const team = submission.rp_teams;
  const files = submission.rp_submission_files ?? [];
  const isSubmitted = data.myEval?.status === "submitted";
  const history: any[] = Array.isArray((data.myEval as any)?.edit_history) ? ((data.myEval as any).edit_history as any[]) : [];
  const currentSubmittedTotal = isSubmitted ? Number(data.myEval?.total_score ?? 0) : null;

  return (
    <PlatformShell hideMenu>
      <Section>
        <Link to="/rakshak-platform/evaluator" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to queue
        </Link>
        <div className="mt-6">
          <Eyebrow>Score submission</Eyebrow>
          <h1 className="mt-4 font-heading text-3xl sm:text-4xl font-bold">{submission.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {team?.team_name} · Phase {submission.phase_number} — {PHASE_TITLES[submission.phase_number]}
          </p>
        </div>

        {(currentSubmittedTotal !== null || history.length > 0) && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Current submitted score</div>
                <div className="mt-1 font-heading text-3xl font-bold">
                  {currentSubmittedTotal !== null ? `${currentSubmittedTotal} / ${max}` : "— (draft)"}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                You can update the scores below and click <span className="font-semibold text-foreground">Update</span> anytime.
              </div>
            </div>
            {history.length > 0 && (
              <details className="mt-4">
                <summary className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer">
                  Change history ({history.length})
                </summary>
                <ul className="mt-3 space-y-1.5 text-xs">
                  {[...history].reverse().map((h, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 border-b border-border/50 pb-1.5 last:border-0">
                      <span className="text-muted-foreground">{new Date(h.at).toLocaleString()}</span>
                      <span className="font-mono">
                        {h.prev_total !== null && h.prev_total !== undefined ? `${h.prev_total} → ` : ""}
                        <span className="font-semibold text-foreground">{h.total_score}</span>
                        <span className="text-muted-foreground"> ({h.status})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            {submission.summary && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Team summary</div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{submission.summary}</p>
              </div>
            )}

            {files.length > 0 && (
              <div className="mt-6">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Evidence ({files.length})</div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {files.map((f: any) => (
                    <li key={f.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                      <div className="font-medium truncate">{f.file_name}</div>
                      <div className="text-xs text-muted-foreground">{f.evidence_type ?? f.file_type}</div>
                      {f.caption && <div className="mt-1 text-xs text-muted-foreground">{f.caption}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <SiteEvidencePanel locations={(data as any).locations ?? []} />
            <AnnexurePanel />


            <div className="mt-8">
              <MessageThread submissionId={submissionId} currentUserId={userId} />
            </div>


            <div className="mt-8">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {template
                  ? `Rubric — Phase ${phaseNumber} (v${template.version})`
                  : data.rubric
                    ? `Rubric — ${data.rubric.title}`
                    : "Scoring"}
              </div>
              {!template && data.rubric?.description && (
                <p className="mt-2 text-sm text-muted-foreground">{data.rubric.description}</p>
              )}
              {!hasRubric && (
                <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  No rubric defined for this phase yet. Enter an overall score out of 100.
                </p>
              )}
              <div className="mt-5 space-y-3">
                {hasRubric ? (
                  criteria.map((c) => (
                    <div key={c.key} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="font-heading text-sm font-semibold">{c.label}</div>
                        {c.description && <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={c.max_score}
                          step={1}
                          value={scores[c.key] ?? 0}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            const clamped = Math.max(0, Math.min(c.max_score, isNaN(v) ? 0 : v));
                            setScores((s) => ({ ...s, [c.key]: clamped }));
                          }}
                          className="rp-input w-20 text-right font-mono"
                        />
                        <span className="text-xs text-muted-foreground font-mono">/ {c.max_score}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-heading text-sm font-semibold">Overall score</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Freeform score for this submission.</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={freeformTotal}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setFreeformTotal(Math.max(0, Math.min(100, isNaN(v) ? 0 : v)));
                        }}
                        className="rp-input w-20 text-right font-mono"
                      />
                      <span className="text-xs text-muted-foreground font-mono">/ 100</span>
                    </div>
                  </div>
                )}
              </div>


              <div className="mt-6">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Comments & improvement notes
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={5}
                  className="rp-input mt-2 w-full"
                  placeholder="Why this score? What can the team improve? (Visible to admin, mentor, and this team's leader & members only.)"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Visible to admins, the team's mentor, and only this team's leader & members. Other teams cannot see it.
                </p>
              </div>
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 self-start">
            <div className="rounded-2xl border border-brand/30 bg-brand-lite p-6">
              <div className="text-xs uppercase tracking-wider text-brand">Score preview</div>
              <div className="mt-3 font-heading text-5xl font-bold">{total.toFixed(0)}</div>
              <div className="text-sm text-muted-foreground">out of {max}</div>
              {currentSubmittedTotal !== null && total !== currentSubmittedTotal && (
                <div className="mt-2 text-xs font-mono text-amber-700">
                  Change: {currentSubmittedTotal} → {total} ({total > currentSubmittedTotal ? "+" : ""}{total - currentSubmittedTotal})
                </div>
              )}
              <div className="mt-4 text-sm">
                Weighted contribution:
                <span className="ml-2 font-mono font-semibold">{weighted.toFixed(2)} / {weight}</span>
              </div>
              <div className="mt-6 space-y-2">
                <button
                  disabled={mutate.isPending}
                  onClick={() => mutate.mutate(false)}
                  className="w-full rounded-full border border-brand text-brand bg-background py-2 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" /> Save draft
                </button>
                <button
                  disabled={mutate.isPending}
                  onClick={() => mutate.mutate(true)}
                  className="w-full rounded-full bg-brand text-brand-foreground py-2 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> {isSubmitted ? "Update score" : "Submit evaluation"}
                </button>
                {savedAt && <p className="text-xs text-muted-foreground mt-2">Saved at {savedAt}</p>}
              </div>
            </div>
          </aside>
        </div>
      </Section>
    </PlatformShell>
  );
}

const SEV_TONE: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function SiteEvidencePanel({ locations }: { locations: any[] }) {
  if (!locations || locations.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        Site evidence ({locations.length})
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        GPS-verified sites for this phase. Severity is set by admins after review and is read-only here.
      </p>
      <ul className="mt-3 grid gap-2">
        {locations.map((l) => {
          const sevKey = (l.severity ?? "").toString().toLowerCase();
          const tone = SEV_TONE[sevKey] ?? "bg-muted text-muted-foreground border-border";
          const lat = l.latitude != null ? Number(l.latitude).toFixed(5) : "—";
          const lng = l.longitude != null ? Number(l.longitude).toFixed(5) : "—";
          return (
            <li key={l.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-heading text-sm font-semibold">{l.location_name ?? "Site"}</div>
                {l.severity && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${tone}`}>
                    {l.severity}
                  </span>
                )}
                {l.issue_type && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-muted text-muted-foreground border-border capitalize">
                    {String(l.issue_type).replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                GPS: <span className="font-mono">{lat}, {lng}</span>
                {(l.city || l.state) && (
                  <> · {[l.city, l.state].filter(Boolean).join(", ")}</>
                )}
              </div>
              {l.description && (
                <div className="mt-1 text-xs text-muted-foreground line-clamp-3">{l.description}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AnnexurePanel() {
  const entries = [
    { key: "A", title: "Annexure A — Site survey raw data" },
    { key: "B", title: "Annexure B — Stakeholder correspondence" },
    { key: "C", title: "Annexure C — Authority engagement log" },
  ];
  return (
    <div className="mt-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">Annexure</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Admins will be able to attach annexure documents here for evaluators to reference.
      </p>
      <ul className="mt-3 grid gap-2">
        {entries.map((e) => (
          <li
            key={e.key}
            className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-sm opacity-70"
          >
            <span className="font-medium text-muted-foreground">{e.title}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-background text-muted-foreground border-border">
              Not yet available
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

