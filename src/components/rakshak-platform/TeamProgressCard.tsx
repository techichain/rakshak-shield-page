import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { Loader2, Target } from "lucide-react";

type Badge = { label: string; cls: string };

function dayDiff(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** UX-1 — "Your progress" widget for a team's current phase. Reads existing tables only. */
export function TeamProgressCard({
  teamId,
  phaseNumber,
}: {
  teamId: string;
  phaseNumber: number;
}) {
  const [busy, setBusy] = useState(true);
  const [drafts, setDrafts] = useState(0);
  const [finals, setFinals] = useState(0);
  const [progress, setProgress] = useState<{
    deadline: string | null;
    overdue_at: string | null;
    deadline_reminder_sent_at: string | null;
    submitted_at: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [subs, prog] = await Promise.all([
        supabase
          .from("rp_submissions")
          .select("id,is_final")
          .eq("team_id", teamId)
          .eq("phase_number", phaseNumber),
        supabase
          .from("rp_team_phase_progress")
          .select("deadline,overdue_at,deadline_reminder_sent_at,submitted_at")
          .eq("team_id", teamId)
          .eq("phase_number", phaseNumber)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const rows = subs.data ?? [];
      setFinals(rows.filter((r) => r.is_final).length);
      setDrafts(rows.filter((r) => !r.is_final).length);
      setProgress((prog.data as typeof progress) ?? null);
      setBusy(false);
    })().catch(() => setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [teamId, phaseNumber]);

  if (busy) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your progress…
        </div>
      </div>
    );
  }

  const total = drafts + finals;
  const now = new Date();
  const deadline = progress?.deadline ? new Date(progress.deadline) : null;
  const days = deadline ? dayDiff(now, deadline) : null;

  let deadlineLine = "Deadline not set yet.";
  if (deadline && days !== null) {
    const formatted = deadline.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    deadlineLine =
      days < 0
        ? `Deadline: ${formatted}, overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
        : `Deadline: ${formatted}, in ${days} day${days === 1 ? "" : "s"}`;
  }

  const isOverdue =
    !!progress?.overdue_at ||
    (deadline !== null && days !== null && days < 0 && !progress?.submitted_at);
  const isNear =
    !isOverdue &&
    ((deadline !== null && days !== null && days <= 3) ||
      !!progress?.deadline_reminder_sent_at);

  const badge: Badge = isOverdue
    ? { label: "Overdue", cls: "bg-danger/10 text-danger border-danger/30" }
    : isNear
      ? { label: "Deadline near", cls: "bg-warning/10 text-warning border-warning/30" }
      : { label: "On track", cls: "bg-success/10 text-success border-success/30" };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-brand" />
          <div>
            <h2 className="font-heading text-lg font-semibold">Your progress</h2>
            <p className="text-xs text-muted-foreground">
              Phase {phaseNumber} — {PHASE_TITLES[phaseNumber] ?? "Current phase"}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="mt-4">
        <div className="font-heading text-3xl text-brand">
          {total} <span className="text-base text-foreground">submission{total === 1 ? "" : "s"} filed</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {drafts} draft{drafts === 1 ? "" : "s"} · {finals} final
        </p>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{deadlineLine}</p>
    </div>
  );
}
