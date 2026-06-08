import { createFileRoute, Link, useNavigate, useServerFn } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { getEvaluatorQueue } from "@/lib/rakshak-platform/evaluations.functions";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { CheckCircle2, FileEdit, Star } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/evaluator/")({
  component: EvaluatorQueue,
});

function EvaluatorQueue() {
  const { loading, userId, isEvaluator, isAdmin } = useRPAuth();
  const navigate = useNavigate();
  const fetchQueue = useServerFn(getEvaluatorQueue);
  const allowed = isEvaluator || isAdmin;

  useEffect(() => {
    if (loading) return;
    if (!userId) navigate({ to: "/rakshak-platform/auth" });
    else if (!allowed) navigate({ to: "/rakshak-platform/dashboard" });
  }, [loading, userId, allowed, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["rp-evaluator-queue"],
    queryFn: () => fetchQueue(),
    enabled: !!userId && allowed,
  });

  const items = data?.items ?? [];
  const pending = items.filter((i) => !i.my_evaluation || i.my_evaluation.status === "draft");
  const done = items.filter((i) => i.my_evaluation?.status === "submitted");

  if (loading) return <PlatformShell><Section>Loading…</Section></PlatformShell>;

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Evaluator workspace</Eyebrow>
        <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          Submissions awaiting
          <br /><span className="text-brand">your score.</span>
        </h1>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <Stat label="To review" value={pending.length} icon={<FileEdit className="h-5 w-5" />} />
          <Stat label="Completed by you" value={done.length} icon={<CheckCircle2 className="h-5 w-5" />} />
          <Stat label="Total in pipeline" value={items.length} icon={<Star className="h-5 w-5" />} />
        </div>

        <h2 className="mt-12 font-heading text-2xl font-semibold">Pending</h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading queue…</p>
        ) : pending.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing waiting for you. 🎉</p>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {pending.map((i) => <QueueCard key={i.id} item={i} />)}
          </div>
        )}

        {done.length > 0 && (
          <>
            <h2 className="mt-16 font-heading text-2xl font-semibold">Completed</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {done.map((i) => <QueueCard key={i.id} item={i} />)}
            </div>
          </>
        )}
      </Section>
    </PlatformShell>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 font-heading text-3xl font-bold">{value}</div>
      </div>
      <span className="h-10 w-10 rounded-full bg-brand-lite text-brand flex items-center justify-center">{icon}</span>
    </div>
  );
}

function QueueCard({ item }: { item: any }) {
  const team = item.rp_teams;
  const e = item.my_evaluation;
  return (
    <Link
      to="/rakshak-platform/evaluator/$submissionId"
      params={{ submissionId: item.id }}
      className="block rounded-2xl border border-border bg-card p-5 hover:border-brand/40 transition"
    >
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Phase {item.phase_number} · {PHASE_TITLES[item.phase_number]}
        </div>
        {item.assigned_to_me && (
          <span className="text-xs font-semibold text-brand bg-brand-lite px-2 py-0.5 rounded-full">Assigned</span>
        )}
      </div>
      <div className="mt-2 font-heading text-lg font-semibold">{item.title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{team?.team_name} · {team?.city}, {team?.state}</div>
      {e && (
        <div className="mt-4 text-sm">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${e.status === "submitted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
            {e.status === "submitted" ? "Scored" : "Draft saved"}
          </span>
          <span className="ml-3 font-mono text-muted-foreground">{Number(e.total_score).toFixed(0)} / 100</span>
        </div>
      )}
    </Link>
  );
}
