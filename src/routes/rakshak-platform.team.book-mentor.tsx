import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  PlatformShell,
  Section,
  Eyebrow,
} from "@/components/rakshak-platform/Shell";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";
import {
  getCalendarStatus,
  getCalendarAuthUrl,
} from "@/lib/rakshak-platform/google-calendar.functions";
import {
  bookMentorMeeting,
  getMyMentorAvailability,
} from "@/lib/rakshak-platform/meetings.functions";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Loader2,
  Video,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/team/book-mentor")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["team_leader"]);
  },
  component: BookMentorPage,
  errorComponent: ({ error }) => (
    <PlatformShell>
      <Section>
        <p className="text-red-600">
          {error instanceof Error ? error.message : "Something went wrong."}
        </p>
      </Section>
    </PlatformShell>
  ),
});

const SLOT_MINUTES = 30;
const DAY_START_HOUR = 9; // 9am IST
const DAY_END_HOUR = 19; // 7pm IST
const IST_OFFSET_MIN = 330;

function BookMentorPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const availFn = useServerFn(getMyMentorAvailability);
  const bookFn = useServerFn(bookMentorMeeting);
  const statusFn = useServerFn(getCalendarStatus);
  const authFn = useServerFn(getCalendarAuthUrl);

  const { data: calStatus } = useQuery({
    queryKey: ["rp-my-calendar-status"],
    queryFn: () => statusFn(),
  });
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["rp-mentor-availability"],
    queryFn: () => availFn({ data: { days: 14 } }),
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState("Mentor sync");
  const [agenda, setAgenda] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ meet: string | null; email: string } | null>(null);

  const slotsByDay = useMemo(() => {
    if (!data || !data.mentor_connected) return [] as { day: Date; slots: Date[] }[];
    const busyRanges = (data.busy ?? []).map((b) => ({
      s: new Date(b.start).getTime(),
      e: new Date(b.end).getTime(),
    }));
    const now = Date.now();
    const days: { day: Date; slots: Date[] }[] = [];
    const start = new Date();
    for (let d = 0; d < 14; d++) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d);
      const dayWeekday = day.getDay();
      if (dayWeekday === 0) continue; // skip Sundays
      const slots: Date[] = [];
      for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
        for (let m = 0; m < 60; m += SLOT_MINUTES) {
          // Compose an IST wall-clock time on this day and convert to UTC ms.
          const utcMs = Date.UTC(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            h,
            m,
          ) - IST_OFFSET_MIN * 60_000;
          const slotStart = utcMs;
          const slotEnd = utcMs + SLOT_MINUTES * 60_000;
          if (slotStart < now + 60 * 60_000) continue; // 1h lead time
          const overlap = busyRanges.some(
            (b) => slotStart < b.e && slotEnd > b.s,
          );
          if (!overlap) slots.push(new Date(slotStart));
        }
      }
      if (slots.length) days.push({ day, slots });
    }
    return days;
  }, [data]);

  async function connectCalendar() {
    const origin = window.location.origin;
    const res: any = await authFn({ data: { origin } });
    window.location.href = res.url;
  }

  async function submit() {
    if (!selected) return;
    setBusy(true);
    try {
      const start = new Date(selected);
      const end = new Date(start.getTime() + SLOT_MINUTES * 60_000);
      const res: any = await bookFn({
        data: {
          scheduled_start: start.toISOString(),
          scheduled_end: end.toISOString(),
          title: title.trim() || "Mentor sync",
          agenda: agenda.trim(),
        },
      });
      setDone({ meet: res.meet_link, email: res.mentor_email });
      qc.invalidateQueries({ queryKey: ["rp-meetings"] });
      qc.invalidateQueries({ queryKey: ["rp-mentor-availability"] });
      toast.success("Booked — Google sent the invite to your mentor");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not book meeting");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <PlatformShell>
        <Section>
          <div className="rounded-2xl border border-brand/40 bg-brand-lite p-8 text-center max-w-xl mx-auto">
            <CheckCircle2 className="mx-auto h-10 w-10 text-brand" />
            <h1 className="mt-4 font-heading text-2xl">Meeting booked</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Google Calendar sent an invite to {done.email}. Both of you will get a
              reminder 10 minutes before start.
            </p>
            {done.meet && (
              <a
                href={done.meet}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-5 h-10 text-sm text-brand-foreground"
              >
                <Video className="h-4 w-4" /> Open Google Meet
              </a>
            )}
            <div className="mt-4">
              <button
                onClick={() => navigate({ to: "/rakshak-platform/meetings" })}
                className="text-sm text-muted-foreground hover:text-brand"
              >
                View all meetings →
              </button>
            </div>
          </div>
        </Section>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell>
      <Section>
        <Link
          to="/rakshak-platform/team"
          className="text-sm text-muted-foreground hover:text-brand inline-flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="size-4" /> Back to team dashboard
        </Link>
        <Eyebrow>Book mentor session</Eyebrow>
        <h1 className="mt-3 font-heading text-3xl">
          {data?.mentor.full_name
            ? <>Meeting with <span className="text-brand">{data.mentor.full_name}</span></>
            : "Book a session with your mentor"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Pick a 30-minute slot when your mentor is free. Google Calendar creates a
          Meet link and emails the invite to both of you automatically.
        </p>

        {isLoading && (
          <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading mentor availability…
          </div>
        )}

        {isError && (
          <div className="mt-10 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {(error as any)?.message ?? "Could not load availability."}
          </div>
        )}

        {data && !data.leader_connected && (
          <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h2 className="font-semibold">Connect your Google Calendar</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We create the Meet link and calendar invite on your Google account.
                </p>
                <button
                  onClick={connectCalendar}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 h-10 text-sm text-brand-foreground"
                >
                  <Calendar className="h-4 w-4" /> Connect Google Calendar
                </button>
                {calStatus?.email && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Detected {calStatus.email} — reconnect if needed.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {data && data.leader_connected && !data.mentor_connected && (
          <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h2 className="font-semibold">Mentor hasn't shared availability yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your mentor ({data.mentor.email}) hasn't connected Google Calendar.
                  Please email them and ask them to connect it from their Profile page.
                </p>
              </div>
            </div>
          </div>
        )}

        {data && data.leader_connected && data.mentor_connected && (
          <div className="mt-8 grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-border bg-background p-5">
              <h3 className="font-heading text-lg">Pick a free slot</h3>
              {slotsByDay.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No free 30-min slots in mentor working hours over the next 2 weeks.
                  Try again later or contact your mentor.
                </p>
              ) : (
                <div className="mt-4 space-y-5 max-h-[520px] overflow-y-auto pr-2">
                  {slotsByDay.map((d) => (
                    <div key={d.day.toISOString()}>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                        {d.day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {d.slots.map((s) => {
                          const key = s.toISOString();
                          const active = selected === key;
                          return (
                            <button
                              key={key}
                              onClick={() => setSelected(key)}
                              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                                active
                                  ? "border-brand bg-brand text-brand-foreground"
                                  : "border-border hover:border-brand/40"
                              }`}
                            >
                              {s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => refetch()}
                className="mt-4 text-xs text-muted-foreground hover:text-brand"
              >
                Refresh availability
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-background p-5 space-y-3">
              <h3 className="font-heading text-lg">Details</h3>
              <label className="block text-sm">
                <span className="text-muted-foreground">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  className="rp-input w-full mt-1"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Agenda</span>
                <textarea
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  className="rp-input w-full mt-1"
                  placeholder="What do you want to discuss?"
                />
              </label>
              <div className="text-xs text-muted-foreground">
                {selected ? (
                  <>Selected: <span className="text-foreground font-medium">{new Date(selected).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span> · 30 min</>
                ) : "No slot picked yet."}
              </div>
              <button
                disabled={!selected || busy}
                onClick={submit}
                className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground disabled:opacity-50"
              >
                <Calendar className="h-4 w-4" /> {busy ? "Booking…" : "Confirm & send invite"}
              </button>
            </div>
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
