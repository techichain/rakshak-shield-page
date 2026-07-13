import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { EmptyState } from "@/components/rakshak-platform/EmptyState";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { listAllReportsForEvaluator } from "@/lib/rakshak-platform/evaluations.functions";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, ScanSearch, Loader2 } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/evaluator/reports")({
  component: EvaluatorReports,
});

function EvaluatorReports() {
  const { loading, userId, isEvaluator } = useRPAuth();
  const navigate = useNavigate();
  const fetchAll = useServerFn(listAllReportsForEvaluator);
  const allowed = isEvaluator;
  const [phase, setPhase] = useState<number>(0);

  useEffect(() => {
    if (loading) return;
    if (!userId) navigate({ to: "/rakshak-platform/auth" });
    else if (!allowed) navigate({ to: "/rakshak-platform/dashboard" });
  }, [loading, userId, allowed, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["rp-evaluator-all-reports"],
    queryFn: () => fetchAll(),
    enabled: !!userId && allowed,
  });

  const items = data?.items ?? [];
  const phases = [0, 1, 2, 3, 4];

  const byPhase = useMemo(
    () => items.filter((i: any) => i.phase_number === phase),
    [items, phase],
  );

  if (loading || isLoading) {
    return (
      <PlatformShell>
        <Section className="!py-16">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading reports…
          </div>
        </Section>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell>
      <Section className="!py-10 lg:!py-12">
        <Link to="/rakshak-platform/evaluator" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to queue
        </Link>
        <div className="mt-6">
          <Eyebrow>Browse reports</Eyebrow>
          <h1 className="mt-4 font-heading text-3xl sm:text-4xl font-bold leading-[1.1]">
            All reports, <span className="text-brand">phase by phase.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every team's submission across the programme. See what you've already scored and jump into anything that has a rubric.
          </p>
        </div>

        <div className="mt-8 inline-flex flex-wrap gap-1 rounded-full border border-border bg-card p-1 shadow-sm">
          {phases.map((p) => {
            const count = items.filter((i: any) => i.phase_number === p).length;
            const active = p === phase;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPhase(p)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  active ? "bg-brand text-brand-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Phase {p}
                <span className="inline-flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-current/15 text-[10px] font-bold tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">{PHASE_TITLES[phase]}</p>

        <div className="mt-6">
          {byPhase.length === 0 ? (
            <EmptyState
              icon={ScanSearch}
              title="No reports in this phase yet"
              description="As teams submit work for this phase, it will show up here."
            />
          ) : (
            <ul className="grid gap-2.5">
              {byPhase.map((r: any) => <ReportRow key={r.id} item={r} />)}
            </ul>
          )}
        </div>
      </Section>
    </PlatformShell>
  );
}

function ReportRow({ item }: { item: any }) {
  const e = item.my_evaluation;
  const submitted = e?.status === "submitted";
  const draft = e?.status === "draft";
  const scored = submitted || draft;
  const scoreText = scored
    ? `Your score: ${Number(e.total_score ?? 0).toFixed(0)}`
    : "Not yet scored";
  const canOpen = item.has_rubric;

  const inner = (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="h-11 w-11 rounded-xl bg-brand-lite text-brand grid place-items-center shrink-0 font-heading text-sm font-bold">
        P{item.phase_number}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-heading text-sm sm:text-base font-semibold truncate">
            {item.team_name}
          </span>
          {submitted && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="h-3 w-3" /> Scored
            </span>
          )}
          {draft && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">
              <Clock className="h-3 w-3" /> Draft
            </span>
          )}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-muted text-muted-foreground border-border capitalize">
            {String(item.status ?? "").replace(/_/g, " ")}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground truncate">
          <span className="font-medium text-foreground/80">{item.title}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`font-mono text-xs tabular-nums ${scored ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
          {scoreText}
        </span>
        {canOpen && <ArrowRight className="h-4 w-4 text-muted-foreground/50" />}
      </div>
    </div>
  );

  if (!canOpen) {
    return (
      <li className="opacity-70" title="No rubric available for this phase yet.">
        {inner}
      </li>
    );
  }
  return (
    <li>
      <Link
        to="/rakshak-platform/evaluator/$submissionId"
        params={{ submissionId: item.id }}
        className="block hover:[&>div]:border-brand/40 hover:[&>div]:shadow-sm transition-all"
      >
        {inner}
      </Link>
    </li>
  );
}
