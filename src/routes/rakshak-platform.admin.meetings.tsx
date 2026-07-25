import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { listAllMeetingsAdmin, setMeetingNotes } from "@/lib/rakshak-platform/meetings.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  formatMeetingDate,
  formatMeetingTimeRange,
  formatMeetingDuration,
} from "@/lib/rakshak-platform/meeting-time";

export const Route = createFileRoute("/rakshak-platform/admin/meetings")({
  component: AdminMeetings,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

const TYPES = ["all", "team_mentor", "mentor_evaluator", "evaluator_team", "team_internal", "other"];

function AdminMeetings() {
  const fn = useServerFn(listAllMeetingsAdmin);
  const saveNotes = useServerFn(setMeetingNotes);
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: ["admin-meetings"], queryFn: () => fn() });
  const [notesOpen, setNotesOpen] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesBusy, setNotesBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return data.meetings.filter((m: any) => {
      if (filter !== "all" && m.meeting_type !== filter) return false;
      if (status !== "all" && m.status !== status) return false;
      if (q && !`${m.title} ${m.rp_teams?.team_name ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [data.meetings, filter, status, q]);

  function exportCsv() {
    const header = ["title","type","status","team","start","end","link","location","reminders_24h","reminders_1h","reminders_30m"].join(",");
    const lines = rows.map((m: any) => [
      `"${(m.title ?? "").replace(/"/g, '""')}"`,
      m.meeting_type, m.status,
      `"${m.rp_teams?.team_name ?? ""}"`,
      m.scheduled_start, m.scheduled_end,
      m.meeting_link ?? "", `"${(m.location ?? "").replace(/"/g, '""')}"`,
      m.reminder_24h_sent_at ?? "", m.reminder_1h_sent_at ?? "", m.reminder_30m_sent_at ?? "",
    ].join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `meetings-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Meetings</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">All scheduled calls</h1>
        <p className="mt-2 text-sm text-muted-foreground">Complete record across teams, mentors and evaluators. Reminders fire 24h / 1h / 30min before each meeting.</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or team…" className="rp-input min-w-[220px]" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rp-input">
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rp-input">
            {["all","proposed","confirmed","cancelled","completed"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={exportCsv} className="ml-auto rounded-full border border-border px-4 py-1.5 text-xs uppercase tracking-wide hover:border-brand/40">Export CSV</button>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Attendees</th>
                <th className="px-3 py-2">Reminders</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m: any) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div>{formatMeetingDate(m.scheduled_start)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatMeetingTimeRange(m.scheduled_start, m.scheduled_end)}
                      {formatMeetingDuration(m.scheduled_start, m.scheduled_end) &&
                        ` · ${formatMeetingDuration(m.scheduled_start, m.scheduled_end)}`}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {m.title}
                    {m.meeting_link && <a href={m.meeting_link} target="_blank" rel="noreferrer" className="ml-2 text-xs text-brand hover:underline">link</a>}
                  </td>
                  <td className="px-3 py-2">{m.meeting_type}</td>
                  <td className="px-3 py-2">{m.rp_teams?.team_name ?? "—"}</td>
                  <td className="px-3 py-2">{m.status}</td>
                  <td className="px-3 py-2 max-w-[260px]">
                    <div className="space-y-0.5 text-xs">
                      {(m.rp_meeting_attendees ?? []).slice(0, 5).map((a: any) => (
                        <div key={a.profile_id} className="truncate">
                          {a.rp_profiles?.full_name ?? a.profile_id} <span className="text-muted-foreground">· {a.rsvp}</span>
                        </div>
                      ))}
                      {(m.rp_meeting_attendees ?? []).length > 5 && (
                        <div className="text-muted-foreground">+{m.rp_meeting_attendees.length - 5} more</div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    <span className={m.reminder_24h_sent_at ? "text-emerald-600 font-medium" : ""}>24h</span>{" "}
                    <span className={m.reminder_1h_sent_at ? "text-emerald-600 font-medium" : ""}>1h</span>{" "}
                    <span className={m.reminder_30m_sent_at ? "text-emerald-600 font-medium" : ""}>30m</span>
                  </td>
                  <td className="px-3 py-2 align-top max-w-[280px]">
                    {notesOpen === m.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          rows={5}
                          maxLength={20000}
                          placeholder="Meeting notes / transcript (added manually by admin)…"
                          className="rp-input w-[260px] text-xs"
                        />
                        <div className="flex gap-2">
                          <button
                            disabled={notesBusy}
                            onClick={async () => {
                              setNotesBusy(true);
                              try {
                                await saveNotes({ data: { meeting_id: m.id, notes: notesDraft } });
                                await qc.invalidateQueries({ queryKey: ["admin-meetings"] });
                                setNotesOpen(null);
                                toast.success("Notes saved");
                              } catch (e: any) {
                                toast.error(e?.message ?? "Could not save notes");
                              } finally {
                                setNotesBusy(false);
                              }
                            }}
                            className="rounded-full bg-brand px-3 py-1 text-xs text-brand-foreground disabled:opacity-60"
                          >
                            {notesBusy ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={() => setNotesOpen(null)}
                            className="rounded-full border border-border px-3 py-1 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {m.notes ? (
                          <p className="text-xs whitespace-pre-line line-clamp-4 text-muted-foreground">{m.notes}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">No notes yet</p>
                        )}
                        <button
                          onClick={() => { setNotesDraft(m.notes ?? ""); setNotesOpen(m.id); }}
                          className="text-xs text-brand hover:underline"
                        >
                          {m.notes ? "Edit notes" : "Add notes"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">No meetings match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </PlatformShell>
  );
}
