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

  const criteria = useMemo<Criterion[]>(
    () => ((data?.rubric?.criteria ?? []) as unknown as Criterion[]),
    [data]
  );
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const initial: Record<string, number> = {};
    const prev = (data.myEval?.rubric_scores ?? {}) as Record<string, number>;
    criteria.forEach((c) => {
      initial[c.key] = Number(prev[c.key] ?? 0);
    });
    setScores(initial);
    setComments(data.myEval?.comments ?? "");
  }, [data, criteria]);

  const total = criteria.reduce((sum, c) => sum + Math.min(c.max_score, Math.max(0, Number(scores[c.key] ?? 0))), 0);
  const max = Number(data?.rubric?.max_total_score ?? 100);
  const weight = Number(data?.rubric?.phase_weight ?? 0);
  const weighted = max > 0 ? (total / max) * weight : 0;

  const mutate = useMutation({
    mutationFn: (submit: boolean) =>
      saveFn({ data: { submissionId, rubricScores: scores, comments, submit } }),
    onSuccess: (_, submit) => {
      setSavedAt(new Date().toLocaleTimeString());
      refetch();
      if (submit) navigate({ to: "/rakshak-platform/evaluator" });
    },
  });

  if (loading || isLoading || !data) {
    return <PlatformShell><Section>Loading submission…</Section></PlatformShell>;
  }

  const submission = data.submission;
  const team = submission.rp_teams;
  const files = submission.rp_submission_files ?? [];
  const isSubmitted = data.myEval?.status === "submitted";
  const history: any[] = Array.isArray((data.myEval as any)?.edit_history) ? ((data.myEval as any).edit_history as any[]) : [];
  const currentSubmittedTotal = isSubmitted ? Number(data.myEval?.total_score ?? 0) : null;

  return (
    <PlatformShell>
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
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Rubric — {data.rubric.title}</div>
              <p className="mt-2 text-sm text-muted-foreground">{data.rubric.description}</p>
              <div className="mt-5 space-y-3">
                {criteria.map((c) => (
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
                ))}
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
