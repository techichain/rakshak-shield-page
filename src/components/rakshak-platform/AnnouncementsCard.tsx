import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAnnouncements } from "@/lib/rakshak-platform/admin-meetings.functions";
import { formatMeetingWhen } from "@/lib/rakshak-platform/meeting-time";
import { Megaphone, Loader2, ExternalLink } from "lucide-react";

/** Read-only broadcast list for teams (Phase D2, Mode B). */
export function AnnouncementsCard() {
  const listFn = useServerFn(listAnnouncements);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await listFn({ data: { upcoming_only: true } } as any)) as any;
        if (!cancelled) setItems(res?.announcements ?? []);
      } catch {
        // enrichment only
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listFn]);

  if (!busy && items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-brand" />
        <h2 className="font-heading text-lg font-semibold">From the programme team</h2>
      </div>
      {busy ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((a) => (
            <li key={a.id} className="rounded-xl border border-brand/25 bg-brand-lite/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">{a.title}</div>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {a.kind === "expert_session" ? "Expert session" : "Programme meeting"}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {a.scheduled_start
                  ? formatMeetingWhen(a.scheduled_start, a.scheduled_end)
                  : "Time to be announced"}
                {a.host_name ? ` · ${a.host_name}` : ""}
              </div>
              {a.description && (
                <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">
                  {a.description}
                </p>
              )}
              {a.meeting_link && (
                <a
                  href={a.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-brand hover:underline"
                >
                  Join link <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
