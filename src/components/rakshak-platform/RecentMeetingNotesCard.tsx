import { useEffect, useState } from "react";
import { formatMeetingWhen } from "@/lib/rakshak-platform/meeting-time";
import { useServerFn } from "@tanstack/react-start";
import { listMyMeetings } from "@/lib/rakshak-platform/meetings.functions";
import { ClipboardList, Loader2 } from "lucide-react";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function RecentMeetingNotesCard() {
  const fetchMeetings = useServerFn(listMyMeetings);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await fetchMeetings({ data: {} } as any)) as any;
        if (cancelled) return;
        const withNotes = (res?.meetings ?? [])
          .filter((m: any) => typeof m.notes === "string" && m.notes.trim().length > 0)
          .sort(
            (a: any, b: any) =>
              new Date(b.scheduled_start ?? 0).getTime() -
              new Date(a.scheduled_start ?? 0).getTime(),
          )
          .slice(0, 5);
        setItems(withNotes);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMeetings]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-brand" />
        <h2 className="font-heading text-lg font-semibold">Recent meeting notes</h2>
      </div>
      {busy ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No notes yet — admins post transcripts and notes after meetings.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((m: any) => (
            <li
              key={m.id}
              className="rounded-xl border border-amber-200 bg-amber-50/60 p-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-semibold text-sm">{m.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  {m.scheduled_start ? formatMeetingWhen(m.scheduled_start, m.scheduled_end) : ""}
                </div>
              </div>
              <p className="mt-1 text-sm whitespace-pre-line text-foreground/90">
                {m.notes}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
