// Shared meeting date/time formatting for the Rakshak platform.
// All meeting surfaces render the exact date, the start–end time range and the
// computed duration using these helpers so the display stays consistent.

const LOCALE = "en-IN";

function toDate(v?: string | Date | null): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Tue 29 Jul 2026" */
export function formatMeetingDate(v?: string | Date | null): string {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "3:00 PM" */
export function formatMeetingTime(v?: string | Date | null): string {
  const d = toDate(v);
  if (!d) return "";
  return d.toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });
}

/** Minutes between start and end, or null when end is missing/invalid. */
export function meetingDurationMinutes(
  start?: string | Date | null,
  end?: string | Date | null,
): number | null {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return null;
  const mins = Math.round((e.getTime() - s.getTime()) / 60000);
  return mins > 0 ? mins : null;
}

/** "45 min" / "1 hr 30 min" / "2 hr" — empty string when duration is unknown. */
export function formatMeetingDuration(
  start?: string | Date | null,
  end?: string | Date | null,
): string {
  const mins = meetingDurationMinutes(start, end);
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** "3:00–3:45 PM" (or just the start time when end is missing). */
export function formatMeetingTimeRange(
  start?: string | Date | null,
  end?: string | Date | null,
): string {
  const s = toDate(start);
  if (!s) return "—";
  const e = toDate(end);
  if (!e || e.getTime() <= s.getTime()) return formatMeetingTime(s);
  return `${formatMeetingTime(s)}–${formatMeetingTime(e)}`;
}

/**
 * Full compact display: "Tue 29 Jul 2026 · 3:00–3:45 PM · 45 min".
 * Falls back to date + start time only when scheduled_end is missing.
 */
export function formatMeetingWhen(
  start?: string | Date | null,
  end?: string | Date | null,
): string {
  const s = toDate(start);
  if (!s) return "—";
  const parts = [formatMeetingDate(s), formatMeetingTimeRange(s, end)];
  const dur = formatMeetingDuration(s, end);
  if (dur) parts.push(dur);
  return parts.join(" · ");
}
