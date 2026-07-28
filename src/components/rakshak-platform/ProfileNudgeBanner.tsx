import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { UserCog, X } from "lucide-react";
import { getProfileCompletion } from "@/lib/rakshak-platform/profile.functions";

/**
 * Soft nudge shown on every role dashboard while the signed-in user's
 * profile is incomplete. Dismissal is per-session only (state, not storage)
 * so it returns on the next login.
 */
export function ProfileNudgeBanner({ userId }: { userId: string | null }) {
  const fetchCompletion = useServerFn(getProfileCompletion);
  const [pct, setPct] = useState<number | null>(null);
  const [done, setDone] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchCompletion({ data: { user_id: userId } })
      .then((r) => {
        if (cancelled) return;
        setPct(r.percentage);
        setDone(Boolean(r.completed_at));
      })
      .catch(() => {
        /* non-blocking nudge — stay silent on failure */
      });
    return () => {
      cancelled = true;
    };
  }, [userId, fetchCompletion]);

  if (!userId || dismissed || done || pct === null) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-r-xl border-l-4 border-brand bg-brand-lite px-4 py-3 text-sm">
      <UserCog className="h-4 w-4 shrink-0 text-brand" />
      <span className="flex-1">
        Your profile is <span className="font-semibold">{pct}% complete</span>. Fill in your
        details to help us stay connected.
      </span>
      <Link
        to="/rakshak-platform/profile"
        className="font-semibold text-brand hover:underline whitespace-nowrap"
      >
        → Complete profile
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="rounded-full p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
