import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import {
  createMeeting,
  cancelMeeting,
  rsvpMeeting,
  listMyMeetings,
  listInvitees,
  rescheduleMeeting,
} from "@/lib/rakshak-platform/meetings.functions";
import { Video, MapPin, Calendar, X, Check, HelpCircle, Bell, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/meetings")({
  component: MeetingsPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p>{String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

const TYPE_LABELS: Record<string, string> = {
  team_mentor: "Team ↔ Mentor",
  mentor_evaluator: "Mentor ↔ Evaluator",
  evaluator_team: "Evaluator ↔ Team",
  team_internal: "Team internal",
  other: "Other",
};

function MeetingsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMyMeetings);
  const create = useServerFn(createMeeting);
  const cancel = useServerFn(cancelMeeting);
  const rsvp = useServerFn(rsvpMeeting);
  const invitees = useServerFn(listInvitees);
  const reschedule = useServerFn(rescheduleMeeting);

  const { data } = useSuspenseQuery({ queryKey: ["rp-meetings"], queryFn: () => list() });

  const [teams, setTeams] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [type, setType] = useState<string>("team_mentor");
  const [view, setView] = useState<"upcoming" | "past" | "calendar">("upcoming");
  const [selected, setSelected] = useState<{ id: string; full_name: string }[]>([]);
  const [inviteeSearch, setInviteeSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    const term = inviteeSearch.trim();
    if (term.length < 2) { setSearchResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res: any = await invitees({ data: { search: term } });
        if (!cancelled) setSearchResults(res?.people ?? []);
      } catch { if (!cancelled) setSearchResults([]); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [inviteeSearch, invitees]);

  useEffect(() => {
    supabase.from("rp_teams").select("id, team_name").then(({ data }) => setTeams(data ?? []));
  }, []);

  const needsTeam = type === "team_mentor" || type === "evaluator_team" || type === "team_internal";

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const fd = new FormData(e.currentTarget);
    try {
      await create({
        data: {
          team_id: needsTeam ? String(fd.get("team_id")) : null,
          meeting_type: type as any,
          title: String(fd.get("title")),
          agenda: String(fd.get("agenda") || ""),
          scheduled_start: new Date(String(fd.get("scheduled_start"))).toISOString(),
          scheduled_end: new Date(String(fd.get("scheduled_end"))).toISOString(),
          meeting_link: String(fd.get("meeting_link") || ""),
          location: String(fd.get("location") || ""),
          status: "proposed",
          invitee_ids: selected.map((p) => p.id),
        },
      });
      (e.currentTarget as HTMLFormElement).reset();
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["rp-meetings"] });
    } catch (e: any) {
      setErr(e?.message ?? "Could not create meeting");
    } finally {
      setBusy(false);
    }
  }

  async function handleRsvp(meeting_id: string, r: "going" | "not_going" | "maybe") {
    await rsvp({ data: { meeting_id, rsvp: r } });
    qc.invalidateQueries({ queryKey: ["rp-meetings"] });
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancel this meeting?")) return;
    await cancel({ data: { id } });
    qc.invalidateQueries({ queryKey: ["rp-meetings"] });
  }

  const [reschedFor, setReschedFor] = useState<any | null>(null);
  const [reschedBusy, setReschedBusy] = useState(false);
  const [reschedErr, setReschedErr] = useState<string | null>(null);

  function toLocalInput(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function submitReschedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reschedFor) return;
    setReschedBusy(true); setReschedErr(null);
    const fd = new FormData(e.currentTarget);
    try {
      await reschedule({
        data: {
          id: reschedFor.id,
          scheduled_start: new Date(String(fd.get("scheduled_start"))).toISOString(),
          scheduled_end: new Date(String(fd.get("scheduled_end"))).toISOString(),
          reason: String(fd.get("reason") || "") || undefined,
        },
      });
      setReschedFor(null);
      qc.invalidateQueries({ queryKey: ["rp-meetings"] });
    } catch (e: any) {
      setReschedErr(e?.message ?? "Could not reschedule");
    } finally {
      setReschedBusy(false);
    }
  }

  function ics(m: any) {
    const fmt = (s: string) => new Date(s).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const body = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rakshak//EN",
      "BEGIN:VEVENT", `UID:${m.id}@rakshak`, `DTSTAMP:${fmt(new Date().toISOString())}`,
      `DTSTART:${fmt(m.scheduled_start)}`, `DTEND:${fmt(m.scheduled_end)}`,
      `SUMMARY:${String(m.title).replace(/\n/g, " ")}`,
      `DESCRIPTION:${String(m.agenda || "").replace(/\n/g, "\\n")}`,
      m.meeting_link ? `URL:${m.meeting_link}` : "",
      m.location ? `LOCATION:${m.location}` : "",
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${m.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  const now = Date.now();
  const meetings = data.meetings;
  const upcoming = useMemo(
    () => meetings.filter((m: any) => new Date(m.scheduled_start).getTime() >= now && m.status !== "cancelled")
            .sort((a: any, b: any) => +new Date(a.scheduled_start) - +new Date(b.scheduled_start)),
    [meetings, now],
  );
  const past = useMemo(
    () => meetings.filter((m: any) => new Date(m.scheduled_start).getTime() < now || m.status === "cancelled")
            .sort((a: any, b: any) => +new Date(b.scheduled_start) - +new Date(a.scheduled_start)),
    [meetings, now],
  );

  // Calendar grid (current month)
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const monthStart = cursor;
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const firstWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const cells: Array<{ date: Date | null; items: any[] }> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, items: [] });
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(cursor.getFullYear(), cursor.getMonth(), d);
    const dayItems = meetings.filter((m: any) => {
      const s = new Date(m.scheduled_start);
      return s.getFullYear() === day.getFullYear() && s.getMonth() === day.getMonth() && s.getDate() === d;
    });
    cells.push({ date: day, items: dayItems });
  }

  const visible = view === "upcoming" ? upcoming : view === "past" ? past : [];

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Meetings</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Mentor sessions.<br /><span className="text-brand">Team standups.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Schedule team-mentor calls, mentor-evaluator syncs, and evaluator-team reviews.
          Automatic email reminders fire 24h, 1h, and 30min before every meeting.
        </p>

        <form onSubmit={handleCreate} className="mt-10 rounded-2xl border border-border bg-background p-6">
          <h2 className="font-heading text-xl">Schedule a meeting</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select value={type} onChange={(e) => setType(e.target.value)} className="rp-input">
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {needsTeam ? (
              <select name="team_id" required className="rp-input">
                <option value="">Team…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
              </select>
            ) : (
              <div className="rp-input text-xs text-muted-foreground flex items-center">No team — invite people below.</div>
            )}
            <input name="title" required maxLength={200} placeholder="Title" className="rp-input" />
            <input name="meeting_link" type="url" placeholder="Meet/Zoom/Jitsi link" className="rp-input" />
            <input name="scheduled_start" type="datetime-local" required className="rp-input" />
            <input name="scheduled_end" type="datetime-local" required className="rp-input" />
            <input name="location" placeholder="Physical location (optional)" className="rp-input md:col-span-2" />
            <textarea name="agenda" rows={2} placeholder="Agenda" maxLength={4000} className="rp-input md:col-span-2" />
            <div className="md:col-span-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Invite (mentors / evaluators / members)</label>
              <input
                value={inviteeSearch}
                onChange={(e) => setInviteeSearch(e.target.value)}
                placeholder="Search by name…"
                className="rp-input mt-1"
              />
              {searchResults.length > 0 && (
                <div className="mt-1 max-h-40 overflow-auto rounded border border-border bg-card">
                  {searchResults
                    .filter((p) => !selected.some((s) => s.id === p.id))
                    .map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => { setSelected((s) => [...s, p]); setInviteeSearch(""); setSearchResults([]); }}
                        className="block w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                      >
                        {p.full_name}
                      </button>
                    ))}
                </div>
              )}
              {selected.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selected.map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs">
                      {p.full_name}
                      <button type="button" onClick={() => setSelected((s) => s.filter((x) => x.id !== p.id))} className="text-muted-foreground hover:text-foreground">×</button>
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Type at least 2 characters to search. Invitees receive email reminders.</p>
            </div>
          </div>

          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          <button type="submit" disabled={busy} className="mt-4 inline-flex items-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-60">
            <Calendar className="h-4 w-4" /> {busy ? "Saving…" : "Propose meeting"}
          </button>
        </form>

        <div className="mt-10 flex flex-wrap gap-2">
          {(["upcoming", "calendar", "past"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-wide ${view === v ? "border-brand bg-brand text-brand-foreground" : "border-border hover:border-brand/40"}`}
            >
              {v}
            </button>
          ))}
        </div>

        {view === "calendar" ? (
          <div className="mt-6 rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center justify-between">
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="text-sm text-muted-foreground hover:text-brand">← Prev</button>
              <h3 className="font-heading text-lg">{cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}</h3>
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="text-sm text-muted-foreground hover:text-brand">Next →</button>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-muted-foreground">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((c, i) => (
                <div key={i} className={`min-h-[88px] rounded-md border p-1 text-left text-xs ${c.date ? "border-border" : "border-transparent"}`}>
                  {c.date && <div className="text-muted-foreground">{c.date.getDate()}</div>}
                  <div className="mt-1 space-y-1">
                    {c.items.slice(0, 3).map((m: any) => (
                      <div key={m.id} className="truncate rounded bg-brand/10 px-1 py-0.5 text-[10px] text-brand">
                        {new Date(m.scheduled_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {m.title}
                      </div>
                    ))}
                    {c.items.length > 3 && <div className="text-[10px] text-muted-foreground">+{c.items.length - 3} more</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {visible.length === 0 && (
              <p className="text-sm text-muted-foreground">No {view} meetings.</p>
            )}
            {visible.map((m: any) => {
              const cancelled = m.status === "cancelled";
              return (
                <article key={m.id} className={`rounded-2xl border p-5 ${cancelled ? "border-border bg-muted/30 opacity-60" : "border-border bg-background"}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-heading text-lg">{m.title}</h3>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{TYPE_LABELS[m.meeting_type] ?? m.meeting_type}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.rp_teams?.team_name ? `${m.rp_teams.team_name} · ` : ""}
                        {new Date(m.scheduled_start).toLocaleString()} → {new Date(m.scheduled_end).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{m.status}</span>
                  </div>
                  {m.agenda && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{m.agenda}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                    {m.meeting_link && <a href={m.meeting_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline"><Video className="h-3.5 w-3.5" /> Join</a>}
                    {m.location && <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {m.location}</span>}
                    <button onClick={() => ics(m)} className="text-xs text-muted-foreground hover:text-brand">Add to calendar</button>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Bell className="h-3 w-3" /> reminders 24h · 1h · 30m</span>
                  </div>
                  {!cancelled && view === "upcoming" && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <button onClick={() => handleRsvp(m.id, "going")} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 hover:border-brand/40"><Check className="h-3 w-3" /> Going</button>
                      <button onClick={() => handleRsvp(m.id, "maybe")} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 hover:border-brand/40"><HelpCircle className="h-3 w-3" /> Maybe</button>
                      <button onClick={() => handleRsvp(m.id, "not_going")} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 hover:border-brand/40"><X className="h-3 w-3" /> Can't make it</button>
                      <button onClick={() => handleCancel(m.id)} className="ml-auto text-muted-foreground hover:text-red-600">Cancel meeting</button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
