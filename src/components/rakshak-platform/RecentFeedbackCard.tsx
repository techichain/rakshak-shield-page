import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Loader2 } from "lucide-react";
import { listMyRecentFeedback } from "@/lib/rakshak-platform/mentor-resources.functions";
import { Link } from "@tanstack/react-router";

export function RecentFeedbackCard({ limit = 5 }: { limit?: number }) {
  const fetchFeedback = useServerFn(listMyRecentFeedback);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await fetchFeedback({ data: { limit } } as any)) as any;
        if (!cancelled) setItems(res?.feedback ?? []);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchFeedback, limit]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-brand" />
        <h2 className="font-heading text-lg font-semibold">Recent mentor & admin feedback</h2>
      </div>
      {busy ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No feedback yet. When your mentor or admin reviews a submission, comments will appear here.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((f) => (
            <li key={f.id} className="rounded-xl border border-border p-3">
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                <span className="font-semibold text-foreground">
                  {f.rp_profiles?.full_name ?? "Reviewer"}
                </span>
                <span>· {f.reviewer_role}</span>
                <span>· Phase {f.phase_number}</span>
                {f.team_name && <span>· {f.team_name}</span>}
                <span>· {new Date(f.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm mt-1 whitespace-pre-line">{f.feedback_text}</p>
              <Link
                to="/rakshak-platform/team/phases/$phase"
                params={{ phase: String(f.phase_number) }}
                className="text-xs text-brand hover:underline mt-1 inline-block"
              >
                Open phase →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
