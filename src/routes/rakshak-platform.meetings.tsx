import { createFileRoute, redirect } from "@tanstack/react-router";
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
  rescheduleMeeting,
  notifyMeetingConfirmed,
  listMentorPendingBookings,
  respondToMentorBooking,
  createMentorAllTeamsMeeting,
} from "@/lib/rakshak-platform/meetings.functions";
import { Video, MapPin, Calendar, X, Check, HelpCircle, Bell, CalendarClock } from "lucide-react";
import { toast } from "sonner";

function formatErr(e: unknown): string {
  if (!e) return "Something went wrong.";
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const o = e as any;
    if (typeof o.message === "string") return o.message;
    if (typeof o.error === "string") return o.error;
    try { return JSON.stringify(o); } catch { return "Unknown error"; }
  }
  return String(e);
}

export const Route = createFileRoute("/rakshak-platform/meetings")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/rakshak-platform/auth" as any });
    }
  },
  component: MeetingsPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p className="text-red-600">{formatErr(error)}</p></Section></PlatformShell>
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
  const createAllTeams = useServerFn(createMentorAllTeamsMeeting);
  const cancel = useServerFn(cancelMeeting);
  const rsvp = useServerFn(rsvpMeeting);
  const reschedule = useServerFn(rescheduleMeeting);
  const notify = useServerFn(notifyMeetingConfirmed);

  const { data } = useSuspenseQuery({ queryKey: ["rp-meetings"], queryFn: () => list() });
  const listPending = useServerFn(listMentorPendingBookings);
  const respondBooking = useServerFn(respondToMentorBooking);
  const { data: pendingData } = useSuspenseQuery({
    queryKey: ["rp-mentor-pending"],
    queryFn: () => listPending(),
  });

  const [teams, setTeams] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [type, setType] = useState<string>("team_mentor");
  const [view, setView] = useState<"upcoming" | "past" | "calendar">("upcoming");
  const [extraEmailsText, setExtraEmailsText] = useState("");
  const [rsvpState, setRsvpState] = useState<Record<string, string>>({});
  const [myId, setMyId] = useState<string | null>(null);
  const [isTeamLeaderOnly, setIsTeamLeaderOnly] = useState(false);
  const [isMentor, setIsMentor] = useState(false);
  const [myTeamsAsMentor, setMyTeamsAsMentor] = useState<any[]>([]);
  const [pendingBusy, setPendingBusy] = useState<string | null>(null);
  const userTimezone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"; }
    catch { return "Asia/Kolkata"; }
  }, []);


  useEffect(() => {
    supabase.from("rp_teams").select("id, team_name").then(({ data }) => setTeams(data ?? []));
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setMyId(uid);
      if (uid) {
        const { data: roles } = await supabase.from("rp_user_roles").select("role").eq("user_id", uid);
        const rs = (roles ?? []).map((r: any) => r.role);
        const privileged = rs.some((r: string) => ["admin", "super_admin", "mentor", "evaluator"].includes(r));
        setIsTeamLeaderOnly(rs.includes("team_leader") && !privileged);
        const mentor = rs.includes("mentor");
        setIsMentor(mentor);
        if (mentor) {
          const { data: mrow } = await supabase
            .from("rp_mentors").select("id").eq("profile_id", uid).maybeSingle();
          if (mrow?.id) {
            const { data: mteams } = await supabase
              .from("rp_teams").select("id, team_name").eq("assigned_mentor_id", mrow.id);
            setMyTeamsAsMentor(mteams ?? []);
          }
        }
      }
    });
  }, []);

  async function respondPending(meeting_id: string, decision: "approved" | "declined") {
    const reason =
      decision === "declined"
        ? (prompt("Optional: tell the team why you're declining") ?? undefined)
        : undefined;
    setPendingBusy(meeting_id);
    try {
      await respondBooking({ data: { meeting_id, decision, reason } });
      toast.success(decision === "approved" ? "Approved — Meet link sent to the team" : "Request declined");
      qc.invalidateQueries({ queryKey: ["rp-mentor-pending"] });
      qc.invalidateQueries({ queryKey: ["rp-meetings"] });
    } catch (e) {
      toast.error(formatErr(e));
    } finally {
      setPendingBusy(null);
    }
  }

  const needsTeam = type === "team_mentor" || type === "evaluator_team" || type === "team_internal";

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const teamIdRaw = needsTeam ? String(fd.get("team_id") || "") : "";
      const isAllTeamsMentor =
        isMentor && type === "team_mentor" && teamIdRaw === "__all__";

      if (isAllTeamsMentor) {
        const res = await createAllTeams({
          data: {
            title: String(fd.get("title")),
            agenda: String(fd.get("agenda") || ""),
            scheduled_start: new Date(String(fd.get("scheduled_start"))).toISOString(),
            scheduled_end: new Date(String(fd.get("scheduled_end"))).toISOString(),
          },
        });
        form.reset();
        setExtraEmailsText("");
        qc.invalidateQueries({ queryKey: ["rp-meetings"] });
        toast.success(
          `Meeting scheduled — invites sent to ${res.attendees_count} people across ${res.teams_count} teams`,
        );
        return;
      }

      const extraEmails = extraEmailsText
        .split(/[,\n;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      // Light client-side validation; server re-validates with Zod.
      const invalid = extraEmails.filter((e) => !/.+@.+\..+/.test(e));
      if (invalid.length) {
        throw new Error(`Invalid email${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}`);
      }
      await create({
        data: {
          team_id: needsTeam ? teamIdRaw : null,
          meeting_type: type as any,
          title: String(fd.get("title")),
          agenda: String(fd.get("agenda") || ""),
          scheduled_start: new Date(String(fd.get("scheduled_start"))).toISOString(),
          scheduled_end: new Date(String(fd.get("scheduled_end"))).toISOString(),
          meeting_link: String(fd.get("meeting_link") || ""),
          location: String(fd.get("location") || ""),
          status: "proposed",
          invitee_ids: [],
          extra_emails: extraEmails,
        },
      });
      form.reset();
      setExtraEmailsText("");
      qc.invalidateQueries({ queryKey: ["rp-meetings"] });
      if (extraEmails.length) {
        toast.success(`Meeting created — invites sent to ${extraEmails.length} email(s). Check their inbox (and spam folder) for the calendar invite with Accept/Decline buttons.`);
      } else {
        toast.success("Meeting created successfully");
      }
    } catch (e: any) {
      setErr(e?.message ?? "Could not create meeting");
    } finally {
      setBusy(false);
    }
  }

  async function handleRsvp(meeting_id: string, r: "going" | "not_going" | "maybe") {
    try {
      await rsvp({ data: { meeting_id, rsvp: r } });
      setRsvpState((s) => ({ ...s, [meeting_id]: r }));
      toast.success(
        r === "going"
          ? "✅ Marked as Going — attendees notified"
          : r === "maybe"
          ? "🤔 Marked as Maybe"
          : "❌ Marked as Can't make it",
      );
      if (r === "going") {
        notify({ data: { meeting_id } }).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ["rp-meetings"] });
    } catch (e) {
      toast.error(formatErr(e));
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancel this meeting?")) return;
    try {
      await cancel({ data: { id } });
      toast.success("Meeting cancelled");
      qc.invalidateQueries({ queryKey: ["rp-meetings"] });
    } catch (e) {
      toast.error(formatErr(e));
    }
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
      toast.success("Meeting rescheduled — attendees notified");
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

        {pendingData?.pending?.length ? (
          <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-5">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-600" />
              <h2 className="font-heading text-lg">Pending your approval</h2>
              <span className="text-xs rounded-full bg-amber-200/70 px-2 py-0.5">{pendingData.pending.length}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Approving creates a Google Meet event on your calendar and emails the link to the team.
            </p>
            <div className="mt-4 space-y-3">
              {pendingData.pending.map((m: any) => (
                <div key={m.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-semibold">{m.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.team_name} · {new Date(m.scheduled_start).toLocaleString()}
                        {" — "}
                        {new Date(m.scheduled_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      {m.agenda && (
                        <p className="mt-2 text-sm whitespace-pre-line">{m.agenda}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        disabled={pendingBusy === m.id}
                        onClick={() => respondPending(m.id, "declined")}
                        className="inline-flex items-center gap-1 h-9 px-3 rounded-full border border-border text-xs hover:bg-muted disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> Decline
                      </button>
                      <button
                        disabled={pendingBusy === m.id}
                        onClick={() => respondPending(m.id, "approved")}
                        className="inline-flex items-center gap-1 h-9 px-3 rounded-full bg-brand text-brand-foreground text-xs disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> {pendingBusy === m.id ? "Working…" : "Approve"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {isTeamLeaderOnly ? (
          <div className="mt-10 rounded-2xl border border-brand/30 bg-brand-lite p-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl">Book with your assigned mentor</h2>
              <p className="mt-1 text-sm text-muted-foreground">Live availability from Google Calendar. Auto-creates a Google Meet link and emails the invite.</p>
            </div>
            <a href="/rakshak-platform/team/book-mentor" className="inline-flex items-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground shrink-0">
              <Calendar className="h-4 w-4" /> Book mentor session
            </a>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="mt-10 rounded-2xl border border-border bg-background p-6">
            <h2 className="font-heading text-xl">Schedule a meeting</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select value={type} onChange={(e) => setType(e.target.value)} className="rp-input">
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {needsTeam ? (
                <select name="team_id" required className="rp-input">
                  <option value="">Team…</option>
                  {isMentor && type === "team_mentor" && myTeamsAsMentor.length > 0 && (
                    <option value="__all__">
                      All my teams ({myTeamsAsMentor.length})
                    </option>
                  )}
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                </select>
              ) : (
                <div className="rp-input text-xs text-muted-foreground flex items-center">No team — invite people below.</div>
              )}
              <input name="title" required maxLength={200} placeholder="Title" className="rp-input" />
              <input name="meeting_link" type="url" placeholder="Google Meet / video link (optional)" className="rp-input" />
              <input name="scheduled_start" type="datetime-local" required className="rp-input" />
              <input name="scheduled_end" type="datetime-local" required className="rp-input" />
              <input name="location" placeholder="Physical location (optional)" className="rp-input md:col-span-2" />
              <textarea name="agenda" rows={2} placeholder="Agenda" maxLength={4000} className="rp-input md:col-span-2" />
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Invite people (comma-separated emails)</label>
                <textarea
                  value={extraEmailsText}
                  onChange={(e) => setExtraEmailsText(e.target.value)}
                  rows={2}
                  placeholder="mentor@example.com, team@example.com"
                  className="rp-input mt-1 w-full"
                />
                <p className="mt-1 text-xs text-muted-foreground">Invitees receive a calendar invite with the meet link.</p>
              </div>
            </div>

            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
            <button type="submit" disabled={busy} className="mt-4 inline-flex items-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-60">
              <Calendar className="h-4 w-4" /> {busy ? "Saving…" : "Propose meeting"}
            </button>
          </form>
        )}

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
              const myRsvp =
                rsvpState[m.id] ??
                m.rp_meeting_attendees?.find((a: any) => a.profile_id === myId)?.rsvp ??
                null;
              const rsvpBtn = (active: boolean) =>
                `inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors ${
                  active
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border hover:border-brand/40"
                }`;
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
                        {new Date(m.scheduled_start).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} → {new Date(m.scheduled_end).toLocaleTimeString(undefined, { timeStyle: "short" } as any)} <span className="opacity-70">({userTimezone})</span>
                      </p>

                    </div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{m.status}</span>
                  </div>
                  {m.agenda && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{m.agenda}</p>}
                  {m.notes && (
                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/60 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                        Meeting notes
                      </div>
                      <p className="mt-1 text-sm whitespace-pre-line text-amber-900">{m.notes}</p>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                    {m.meeting_link && <a href={m.meeting_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline"><Video className="h-3.5 w-3.5" /> Join</a>}
                    {m.location && <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {m.location}</span>}
                    <button onClick={() => ics(m)} className="text-xs text-muted-foreground hover:text-brand">Add to calendar</button>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Bell className="h-3 w-3" /> reminders 24h · 1h · 30m</span>
                  </div>
                  {!cancelled && view === "upcoming" && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {(myRsvp === null || myRsvp === "pending") ? (
                        <button
                          onClick={() => handleRsvp(m.id, "going")}
                          className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand text-brand-foreground px-4 py-1.5 text-xs font-medium hover:bg-brand/90 transition-colors"
                        >
                          <Check className="h-3 w-3" /> Going
                        </button>
                      ) : (
                        <>
                          <button onClick={() => handleRsvp(m.id, "going")} className={rsvpBtn(myRsvp === "going")}><Check className="h-3 w-3" /> Going</button>
                          <button onClick={() => handleRsvp(m.id, "maybe")} className={rsvpBtn(myRsvp === "maybe")}><HelpCircle className="h-3 w-3" /> Maybe</button>
                          <button onClick={() => handleRsvp(m.id, "not_going")} className={rsvpBtn(myRsvp === "not_going")}><X className="h-3 w-3" /> Can't make it</button>
                          <button onClick={() => { setReschedErr(null); setReschedFor(m); }} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 hover:border-brand/40"><CalendarClock className="h-3 w-3" /> Reschedule</button>
                          <button onClick={() => handleCancel(m.id)} className="ml-auto text-muted-foreground hover:text-red-600">Cancel meeting</button>
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Section>

      {reschedFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !reschedBusy && setReschedFor(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitReschedule} className="w-full max-w-md rounded-2xl bg-background border border-border p-6 shadow-xl">
            <h3 className="font-heading text-lg">Reschedule meeting</h3>
            <p className="mt-1 text-xs text-muted-foreground truncate">{reschedFor.title}</p>
            <div className="mt-4 grid gap-3">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">New start
                <input name="scheduled_start" type="datetime-local" defaultValue={toLocalInput(reschedFor.scheduled_start)} required className="rp-input mt-1 w-full" />
              </label>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">New end
                <input name="scheduled_end" type="datetime-local" defaultValue={toLocalInput(reschedFor.scheduled_end)} required className="rp-input mt-1 w-full" />
              </label>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Reason (optional)
                <textarea name="reason" rows={2} maxLength={1000} className="rp-input mt-1 w-full" placeholder="Conflict, more prep time, etc." />
              </label>
              <p className="text-[11px] text-muted-foreground">Attendees will be notified and asked to RSVP again. Reminders will fire at the new time.</p>
              {reschedErr && <p className="text-sm text-red-600">{reschedErr}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" disabled={reschedBusy} onClick={() => setReschedFor(null)} className="rounded-full border border-border px-4 py-1.5 text-sm">Cancel</button>
                <button type="submit" disabled={reschedBusy} className="rounded-full bg-brand text-brand-foreground px-4 py-1.5 text-sm disabled:opacity-60">{reschedBusy ? "Saving…" : "Reschedule"}</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </PlatformShell>
  );
}
