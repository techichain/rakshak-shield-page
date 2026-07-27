import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { EmptyState } from "@/components/rakshak-platform/EmptyState";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { getEvaluatorQueue } from "@/lib/rakshak-platform/evaluations.functions";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import {
  CheckCircle2, FileEdit, Star, Loader2, Search, FolderOpen,
  ArrowRight, ScanSearch, Clock, AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/evaluator/")({
  component: EvaluatorQueue,
});

type Tab = "pending" | "done";

function EvaluatorQueue() {
  const { loading, userId, isEvaluator } = useRPAuth();
  const navigate = useNavigate();
  const fetchQueue = useServerFn(getEvaluatorQueue);
  const allowed = isEvaluator;
  const [tab, setTab] = useState<Tab>("pending");
  const [q, setQ] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!userId) navigate({ to: "/rakshak-platform/auth" });
    else if (!allowed) navigate({ to: "/rakshak-platform/dashboard" });
  }, [loading, userId, allowed, navigate]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["rp-evaluator-queue"],
    queryFn: () => fetchQueue(),
    enabled: !!userId && allowed,
  });

  const items = data?.items ?? [];
  const pending = useMemo(
    () => items.filter((i: any) => !i.my_evaluation || i.my_evaluation.status === "draft"),
    [items],
  );
  const done = useMemo(
    () => items.filter((i: any) => i.my_evaluation?.status === "submitted"),
    [items],
  );

  const active = tab === "pending" ? pending : done;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return active.filter((i: any) => {
      if (onlyMine && !i.assigned_to_me) return false;
      if (!needle) return true;
      const t = i.rp_teams;
      return (
        i.title?.toLowerCase().includes(needle) ||
        t?.team_name?.toLowerCase().includes(needle) ||
        t?.city?.toLowerCase().includes(needle) ||
        t?.state?.toLowerCase().includes(needle)
      );
    });
  }, [active, q, onlyMine]);

  if (loading) {
    return (
      <PlatformShell hideMenu>
        <Section className="!py-16">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading workspace…
          </div>
        </Section>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell hideMenu>
      <Section className="!py-10 lg:!py-12">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Eyebrow>Evaluator workspace</Eyebrow>
          <div className="inline-flex items-center gap-3">
            <Link
              to="/rakshak-platform/evaluator/reports"
              className="rp-btn-secondary h-10"
            >
              <FolderOpen className="h-4 w-4" /> Browse all reports
            </Link>
            <Link
              to="/rakshak-platform/impact"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
            >
              Programme impact <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <h1 className="mt-4 font-heading text-3xl sm:text-4xl font-bold leading-[1.1]">
          Submissions awaiting <span className="text-brand">your score.</span>
        </h1>


        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat label="Pending your review" value={pending.length} icon={<FileEdit className="h-4 w-4" />} tone="amber" />
          <Stat label="Completed by you" value={done.length} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" />
          <Stat label="All reviewable submissions" value={items.length} icon={<Star className="h-4 w-4" />} tone="brand" />
        </div>

        {/* Tabs + filters */}
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
          <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
            <TabBtn active={tab === "pending"} onClick={() => setTab("pending")}>
              Pending <Pill>{pending.length}</Pill>
            </TabBtn>
            <TabBtn active={tab === "done"} onClick={() => setTab("done")}>
              Completed <Pill>{done.length}</Pill>
            </TabBtn>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground select-none cursor-pointer">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              Assigned to me
            </label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search team, title, city…"
                className="h-9 w-56 sm:w-64 rounded-full border border-border bg-card pl-8 pr-3 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="mt-6">
          {isLoading ? (
            <QueueSkeleton />
          ) : isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Could not load queue"
              description="Something went wrong fetching submissions. Try again — your scores are safe."
              action={{ label: "Retry", onClick: () => refetch() }}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={tab === "pending" ? CheckCircle2 : ScanSearch}
              title={
                q || onlyMine
                  ? "No submissions match your filters"
                  : tab === "pending"
                    ? "You're all caught up"
                    : "Nothing scored yet"
              }
              description={
                q || onlyMine
                  ? "Try clearing the search box or the assigned-to-me filter."
                  : tab === "pending"
                    ? "New submissions will appear here as teams send work for review."
                    : "Once you submit your first score it will show up here."
              }
              action={
                q || onlyMine
                  ? { label: "Clear filters", onClick: () => { setQ(""); setOnlyMine(false); } }
                  : tab === "done"
                    ? { label: "Go to pending", onClick: () => setTab("pending") }
                    : undefined
              }
            />
          ) : (
            <ul className="grid gap-2.5">
              {filtered.map((i: any) => <QueueRow key={i.id} item={i} />)}
            </ul>
          )}
        </div>
      </Section>
    </PlatformShell>
  );
}

function TabBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
        active ? "bg-brand text-brand-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-current/15 text-[10px] font-bold tabular-nums">
      {children}
    </span>
  );
}

function Stat({
  label, value, icon, tone,
}: { label: string; value: number; icon: React.ReactNode; tone: "amber" | "emerald" | "brand" }) {
  const tones = {
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    brand: "bg-brand-lite text-brand border-brand/20",
  } as const;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">{label}</div>
        <div className="mt-1 font-heading text-2xl font-bold tabular-nums">{value}</div>
      </div>
      <span className={`h-9 w-9 rounded-full grid place-items-center border ${tones[tone]}`}>{icon}</span>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <ul className="grid gap-2.5" aria-busy="true" aria-label="Loading queue">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="h-[88px] rounded-2xl border border-border bg-card animate-pulse"
        />
      ))}
    </ul>
  );
}

function QueueRow({ item }: { item: any }) {
  const team = item.rp_teams;
  const e = item.my_evaluation;
  const submitted = e?.status === "submitted";
  const draft = e?.status === "draft";
  return (
    <li>
      <Link
        to="/rakshak-platform/evaluator/$submissionId"
        params={{ submissionId: item.id }}
        className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:border-brand/40 hover:shadow-sm transition-all"
      >
        <div className="h-11 w-11 rounded-xl bg-brand-lite text-brand grid place-items-center shrink-0 font-heading text-sm font-bold">
          P{item.phase_number}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-sm sm:text-base font-semibold truncate">
              {team?.team_name ?? "Team"}
            </span>
            {item.assigned_to_me && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide text-brand bg-brand-lite border border-brand/20">
                Assigned
              </span>
            )}
            {submitted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> Scored
              </span>
            )}
            {draft && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">
                <Clock className="h-3 w-3" /> Draft saved
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground truncate">
            <span className="font-medium text-foreground/80">{item.title}</span>
            <span className="opacity-60"> · {PHASE_TITLES[item.phase_number]}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {e && (
            <span className="font-mono text-sm tabular-nums">
              <span className={submitted ? "text-foreground font-semibold" : "text-muted-foreground"}>
                {Number(e.total_score ?? 0).toFixed(0)}
              </span>
              <span className="text-muted-foreground/60"> / 100</span>
            </span>
          )}
          <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
        </div>
      </Link>
    </li>
  );
}
