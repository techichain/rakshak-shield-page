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
  const [done, setDone] = useState<{ email: string; mentor_connected: boolean } | null>(null);

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
          const utcMs = Date.UTC(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            h,
            m,
          ) - IST_OFFSET_MIN * 60_000;
          const slotStart = utcMs;
          const slotEnd = utcMs + SLOT_MINUTES * 60_000;
          if (slotStart < now + 60 * 60_000) continue;
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
      setDone({ email: res.mentor_email, mentor_connected: !!res.mentor_connected });
      qc.invalidateQueries({ queryKey: ["rp-meetings"] });
      qc.invalidateQueries({ queryKey: ["rp-mentor-availability"] });
      toast.success("Request sent to your mentor for approval");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send request");
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
            <h1 className="mt-4 font-heading text-2xl">Request sent</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We notified {done.email}. Once your mentor approves, a Google Meet link
              is created on their calendar and emailed to every team member.
            </p>
            {!done.mentor_connected && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-xs text-amber-800">
                Heads up — your mentor hasn't connected Google Calendar yet, so they
                can't approve the request until they do. We've told them.
              </div>
            )}
            <div className="mt-6">
              <button
                onClick={() => navigate({ to: "/rakshak-platform/meetings" })}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-5 h-10 text-sm text-brand-foreground"
              >
                View my meetings →
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
          Pick a 30-minute slot when your mentor is free. Your mentor reviews the
          request — on approval, a Google Meet link is created on their calendar
          and emailed to every team member.
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
          <div className="mt-8 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-brand mt-0.5" />
              <div className="flex-1">
                <span className="font-medium">Optional:</span> connect your Google
                Calendar so this meeting is added to your schedule automatically.
                {calStatus?.email && (
                  <span className="text-muted-foreground"> (detected {calStatus.email})</span>
                )}
                <button
                  onClick={connectCalendar}
                  className="ml-2 text-brand hover:underline"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        )}

        {data && !data.mentor_connected && (
          <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h2 className="font-semibold">Mentor hasn't shared availability yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your mentor ({data.mentor.email}) hasn't connected Google Calendar,
                  so we can't show live free slots. You can still send a request for
                  any time below — they'll approve it once they connect.
                </p>
              </div>
            </div>
          </div>
        )}

        {data && (

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
