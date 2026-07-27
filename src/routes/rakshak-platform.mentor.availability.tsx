import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { formatMeetingWhen } from "@/lib/rakshak-platform/meeting-time";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { createMentorSlot, listMySlots, cancelMentorSlot } from "@/lib/rakshak-platform/mentor-sessions.functions";
import { useRPAuth, rpRequireRole } from "@/lib/rakshak-platform/auth";
import { Calendar, Video, X, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/mentor/availability")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["mentor"]);
  },
  component: AvailabilityPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p className="text-red-600">{error instanceof Error ? error.message : (typeof error === "object" && error && "message" in (error as any) ? String((error as any).message) : "Something went wrong.")}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Build "HH:MM" starts between windowStart and windowEnd at the given step (minutes). */
function buildTimeOptions(windowStart: string, windowEnd: string, stepMinutes: number) {
  const toMin = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const start = toMin(windowStart);
  const end = toMin(windowEnd);
  const out: string[] = [];
  if (!Number.isFinite(start) || !Number.isFinite(end) || stepMinutes <= 0) return out;
  for (let t = start; t + stepMinutes <= end; t += stepMinutes) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return out;
}

function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function AvailabilityPage() {
  const navigate = useNavigate();
  const { loading, userId, isMentor } = useRPAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listMySlots);
  const createFn = useServerFn(createMentorSlot);
  const cancelFn = useServerFn(cancelMentorSlot);

  useEffect(() => {
    if (loading) return;
    if (!userId) navigate({ to: "/rakshak-platform/auth" });
    else if (!isMentor) navigate({ to: "/rakshak-platform/dashboard" });
  }, [loading, userId, isMentor, navigate]);

  const { data } = useSuspenseQuery({
    queryKey: ["rp-my-slots"],
    queryFn: () => listFn(),
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // --- picker state ---
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [dates, setDates] = useState<string[]>([]);
  const [duration, setDuration] = useState(60);
  const [windowStart, setWindowStart] = useState("10:00");
  const [windowEnd, setWindowEnd] = useState("18:00");
  const [times, setTimes] = useState<string[]>([]);
  const [capacity, setCapacity] = useState(1);
  const [notes, setNotes] = useState("");

  const timeOptions = useMemo(
    () => buildTimeOptions(windowStart, windowEnd, duration),
    [windowStart, windowEnd, duration],
  );

  // Drop any selected times that no longer exist in the current window/duration.
  useEffect(() => {
    setTimes((prev) => prev.filter((t) => timeOptions.includes(t)));
  }, [timeOptions]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lead = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    return out;
  }, [cursor]);

  const totalSlots = dates.length * times.length;

  function toggleDate(key: string) {
    setDates((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]));
  }
  function toggleTime(t: string) {
    setTimes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function publish() {
    if (dates.length === 0) { setErr("Pick at least one date."); return; }
    if (times.length === 0) { setErr("Pick at least one time slot."); return; }
    setBusy(true);
    setErr(null);
    setProgress({ done: 0, total: totalSlots });

    const combos: { starts: Date; ends: Date }[] = [];
    for (const dkey of [...dates].sort()) {
      for (const t of [...times].sort()) {
        const [y, mo, da] = dkey.split("-").map(Number);
        const [h, mi] = t.split(":").map(Number);
        const starts = new Date(y, mo - 1, da, h, mi, 0, 0);
        const ends = new Date(starts.getTime() + duration * 60_000);
        combos.push({ starts, ends });
      }
    }

    let ok = 0;
    const failures: string[] = [];
    for (const c of combos) {
      try {
        // Reuses the existing single-slot server function; signature unchanged.
        await createFn({
          data: {
            starts_at: c.starts.toISOString(),
            ends_at: c.ends.toISOString(),
            capacity,
            notes,
          },
        });
        ok += 1;
      } catch (e: any) {
        failures.push(`${c.starts.toLocaleString()} — ${e?.message ?? "failed"}`);
      }
      setProgress({ done: ok + failures.length, total: combos.length });
    }

    await qc.invalidateQueries({ queryKey: ["rp-my-slots"] });
    setBusy(false);
    setProgress(null);

    if (ok > 0) {
      setDates([]);
      setTimes([]);
      setNotes("");
      toast.success(`Published ${ok} slot${ok === 1 ? "" : "s"}`);
    }
    if (failures.length) {
      const msg = `${failures.length} slot${failures.length === 1 ? "" : "s"} could not be published. ${failures[0]}`;
      setErr(msg);
      toast.error(msg);
    }
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this slot? It stays in your history as cancelled.")) return;
    await cancelFn({ data: { slot_id: id } });
    qc.invalidateQueries({ queryKey: ["rp-my-slots"] });
  }

  if (!isMentor) return null;

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Mentor · Availability</Eyebrow>
        <h1 className="text-3xl font-extrabold mb-2">Your bookable 1:1 slots</h1>
        <p className="text-muted-foreground mb-6">Pick the dates you're free, choose the times that work on those dates, and publish them all in one go. Teams can then book any open slot.</p>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="rp-card p-5 space-y-5 lg:col-span-1">
            <h3 className="font-semibold">Publish availability</h3>

            {/* Step 1 — dates */}
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">1 · Pick dates</div>
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                  className="rounded-full border border-border p-1 hover:border-brand/40"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <div className="text-sm font-medium">
                  {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
                </div>
                <button
                  type="button"
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                  className="rounded-full border border-border p-1 hover:border-brand/40"
                  aria-label="Next month"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-muted-foreground">
                {DAY_LABELS.map((d) => <div key={d}>{d}</div>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {cells.map((d, i) => {
                  if (!d) return <div key={`e${i}`} />;
                  const key = ymd(d);
                  const past = d.getTime() < today.getTime();
                  const selected = dates.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={past}
                      onClick={() => toggleDate(key)}
                      aria-pressed={selected}
                      className={`h-8 rounded-md border text-xs transition-colors ${
                        past
                          ? "border-transparent text-muted-foreground/40 cursor-not-allowed"
                          : selected
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-border hover:border-brand/40"
                      }`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {dates.length === 0 ? "No dates selected." : `${dates.length} date${dates.length === 1 ? "" : "s"} selected.`}
                {dates.length > 0 && (
                  <button type="button" onClick={() => setDates([])} className="ml-2 text-brand hover:underline">Clear</button>
                )}
              </div>
            </div>

            {/* Step 2 — times */}
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">2 · Pick time slots</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="block text-xs">
                  <span className="text-muted-foreground">Length</span>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="rp-input w-full mt-1"
                  >
                    {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="text-muted-foreground">From</span>
                  <input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} className="rp-input w-full mt-1" />
                </label>
                <label className="block text-xs">
                  <span className="text-muted-foreground">To</span>
                  <input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} className="rp-input w-full mt-1" />
                </label>
              </div>
              {timeOptions.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">No slots fit in this window — widen it or pick a shorter length.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {timeOptions.map((t) => {
                    const selected = times.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTime(t)}
                        aria-pressed={selected}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          selected ? "border-brand bg-brand text-brand-foreground" : "border-border hover:border-brand/40"
                        }`}
                      >
                        {fmtTime(t)}
                      </button>
                    );
                  })}
                </div>
              )}
              {times.length > 0 && (
                <button type="button" onClick={() => setTimes([])} className="mt-2 text-xs text-brand hover:underline">Clear times</button>
              )}
            </div>

            {/* Step 3 — details */}
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">3 · Details</div>
              <label className="block text-sm">
                <span className="text-muted-foreground">Capacity per slot</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={capacity}
                  onChange={(e) => setCapacity(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  className="rp-input w-full mt-1"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Notes (optional)</span>
                <input
                  maxLength={400}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rp-input w-full mt-1"
                  placeholder="e.g. Office hours · ask anything"
                />
              </label>
            </div>

            {err && <p className="text-red-600 text-sm">{err}</p>}
            <button
              type="button"
              onClick={publish}
              disabled={busy || totalSlots === 0}
              className="rp-btn-primary w-full disabled:opacity-60"
            >
              {busy
                ? `Publishing… ${progress ? `${progress.done}/${progress.total}` : ""}`
                : totalSlots === 0
                  ? "Publish availability"
                  : `Publish availability (${totalSlots} slot${totalSlots === 1 ? "" : "s"})`}
            </button>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="rp-card p-5">
              <h3 className="font-semibold mb-3">Upcoming bookings</h3>
              {data.bookings.length === 0 ? (
                <p className="text-muted-foreground text-sm">No bookings yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.bookings.map((b: any) => (
                    <li key={b.id} className="py-3 flex items-center gap-3 flex-wrap">
                      <Calendar className="size-4 text-muted-foreground" />
                      <div className="flex-1 min-w-[200px]">
                        <div className="font-medium">{b.title}</div>
                        <div className="text-xs text-muted-foreground">{formatMeetingWhen(b.scheduled_start, b.scheduled_end)} {b.rp_teams?.team_name ? `· ${b.rp_teams.team_name}` : ""}</div>
                      </div>
                      <Link to="/rakshak-platform/session/$id" params={{ id: b.id }} className="rp-btn-primary inline-flex items-center gap-1 text-sm">
                        <Video className="size-4" /> Join session
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rp-card p-5">
              <h3 className="font-semibold mb-3">Your slots</h3>
              {data.slots.length === 0 ? (
                <p className="text-muted-foreground text-sm">No slots published yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.slots.map((s: any) => (
                    <li key={s.id} className="py-3 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[220px]">
                        <div className="font-medium">{new Date(s.starts_at).toLocaleString()} → {new Date(s.ends_at).toLocaleTimeString()}</div>
                        <div className="text-xs text-muted-foreground">{s.booked_count}/{s.capacity} booked · {s.status}{s.notes ? ` · ${s.notes}` : ""}</div>
                      </div>
                      {s.status !== "cancelled" && (
                        <button onClick={() => cancel(s.id)} className="text-muted-foreground hover:text-red-600 text-sm inline-flex items-center gap-1">
                          <X className="size-4" /> Cancel
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}
