import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { createMeeting, cancelMeeting, rsvpMeeting, listMyMeetings } from "@/lib/rakshak-platform/meetings.functions";
import { Video, MapPin, Calendar, X, Check, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/meetings")({
  component: MeetingsPage,
  errorComponent: ({ error }) => <PlatformShell><Section><p>{String(error)}</p></Section></PlatformShell>,
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

function MeetingsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMyMeetings);
  const create = useServerFn(createMeeting);
  const cancel = useServerFn(cancelMeeting);
  const rsvp = useServerFn(rsvpMeeting);
  const { data } = useSuspenseQuery({ queryKey: ["rp-meetings"], queryFn: () => list() });

  const [teams, setTeams] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("rp_teams").select("id, team_name").then(({ data }) => setTeams(data ?? []));
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const fd = new FormData(e.currentTarget);
    try {
      await create({
        data: {
          team_id: String(fd.get("team_id")),
          title: String(fd.get("title")),
          agenda: String(fd.get("agenda") || ""),
          scheduled_start: new Date(String(fd.get("scheduled_start"))).toISOString(),
          scheduled_end: new Date(String(fd.get("scheduled_end"))).toISOString(),
          meeting_link: String(fd.get("meeting_link") || ""),
          location: String(fd.get("location") || ""),
          status: "proposed",
        },
      });
      (e.currentTarget as HTMLFormElement).reset();
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

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Meetings</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Mentor sessions.<br /><span className="text-brand">Team standups.</span>
        </h1>

        <form onSubmit={handleCreate} className="mt-10 rounded-2xl border border-border bg-background p-6">
          <h2 className="font-heading text-xl">Schedule a meeting</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select name="team_id" required className="rp-input">
              <option value="">Team…</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
            </select>
            <input name="title" required maxLength={200} placeholder="Title" className="rp-input" />
            <input name="scheduled_start" type="datetime-local" required className="rp-input" />
            <input name="scheduled_end" type="datetime-local" required className="rp-input" />
            <input name="meeting_link" type="url" placeholder="Meet/Zoom/Jitsi link" className="rp-input" />
            <input name="location" placeholder="Physical location (optional)" className="rp-input" />
            <textarea name="agenda" rows={2} placeholder="Agenda" maxLength={4000} className="rp-input md:col-span-2" />
          </div>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          <button type="submit" disabled={busy} className="mt-4 inline-flex items-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-60">
            <Calendar className="h-4 w-4" /> {busy ? "Saving…" : "Propose meeting"}
          </button>
        </form>

        <div className="mt-12 space-y-4">
          {data.meetings.length === 0 && (
            <p className="text-sm text-muted-foreground">No meetings yet.</p>
          )}
          {data.meetings.map((m: any) => {
            const cancelled = m.status === "cancelled";
            return (
              <article key={m.id} className={`rounded-2xl border p-5 ${cancelled ? "border-border bg-muted/30 opacity-60" : "border-border bg-background"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-lg">{m.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {m.rp_teams?.team_name} · {new Date(m.scheduled_start).toLocaleString()} → {new Date(m.scheduled_end).toLocaleTimeString()}
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{m.status}</span>
                </div>
                {m.agenda && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{m.agenda}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  {m.meeting_link && <a href={m.meeting_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline"><Video className="h-3.5 w-3.5" /> Join</a>}
                  {m.location && <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {m.location}</span>}
                  <button onClick={() => ics(m)} className="text-xs text-muted-foreground hover:text-brand">Add to calendar</button>
                </div>
                {!cancelled && (
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
      </Section>
    </PlatformShell>
  );
}
