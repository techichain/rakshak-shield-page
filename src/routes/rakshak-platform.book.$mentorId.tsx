import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { listMentorOpenSlots, bookMentorSlot } from "@/lib/rakshak-platform/mentor-sessions.functions";
import { getMyTeams } from "@/lib/rakshak-platform/submissions.functions";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { Calendar, ArrowLeft, Video } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/book/$mentorId")({
  component: BookPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

function BookPage() {
  const { mentorId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { loading, userId } = useRPAuth();
  const listFn = useServerFn(listMentorOpenSlots);
  const bookFn = useServerFn(bookMentorSlot);
  const teamsFn = useServerFn(getMyTeams);

  useEffect(() => {
    if (!loading && !userId) navigate({ to: "/rakshak-platform/auth" });
  }, [loading, userId, navigate]);

  const { data } = useSuspenseQuery({
    queryKey: ["rp-mentor-open-slots", mentorId],
    queryFn: () => listFn({ data: { mentor_id: mentorId } }),
  });
  const { data: tData } = useSuspenseQuery({
    queryKey: ["rp-my-teams"],
    queryFn: () => teamsFn(),
  });

  const [active, setActive] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [teamId, setTeamId] = useState<string | "">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okId, setOkId] = useState<string | null>(null);

  async function book() {
    if (!active) return;
    if (!topic.trim()) { setErr("Topic required"); return; }
    setBusy(true); setErr(null);
    try {
      const res: any = await bookFn({
        data: {
          slot_id: active,
          team_id: teamId || null,
          topic,
          notes: notes || undefined,
        },
      });
      setOkId(res.meeting_id);
      qc.invalidateQueries({ queryKey: ["rp-mentor-open-slots", mentorId] });
    } catch (e: any) { setErr(e?.message ?? "Booking failed"); }
    finally { setBusy(false); }
  }

  return (
    <PlatformShell>
      <Section>
        <Link to="/rakshak-platform/m/$id" params={{ id: mentorId }} className="text-sm text-muted-foreground hover:text-brand inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="size-4" /> Back to profile
        </Link>
        <Eyebrow>Book a 1:1 session</Eyebrow>
        <h1 className="text-3xl font-extrabold">{(data.mentor as any)?.rp_profiles?.full_name ?? "Mentor"}</h1>
        {((data.mentor as any)?.organization || (data.mentor as any)?.expertise) && (
          <p className="text-muted-foreground mt-1">{[(data.mentor as any)?.organization, (data.mentor as any)?.expertise].filter(Boolean).join(" · ")}</p>
        )}

        {okId ? (
          <div className="rp-card p-6 mt-6 text-center">
            <p className="text-lg font-semibold mb-2">Booked. The mentor has been notified.</p>
            <Link to="/rakshak-platform/session/$id" params={{ id: okId }} className="rp-btn-primary inline-flex items-center gap-1 mt-2">
              <Video className="size-4" /> Open session room
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2 rp-card p-5">
              <h3 className="font-semibold mb-3">Pick a slot</h3>
              {data.slots.length === 0 ? (
                <p className="text-muted-foreground text-sm">No open slots right now. Check back soon or message the mentor.</p>
              ) : (
                <ul className="grid sm:grid-cols-2 gap-2">
                  {data.slots.map((s: any) => {
                    const selected = active === s.id;
                    return (
                      <li key={s.id}>
                        <button onClick={() => setActive(s.id)} className={`w-full text-left rounded-lg border px-4 py-3 transition ${selected ? "border-brand bg-brand-lite" : "border-border hover:border-brand/50"}`}>
                          <div className="font-medium">{new Date(s.starts_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</div>
                          <div className="text-xs text-muted-foreground">until {new Date(s.ends_at).toLocaleTimeString([], { timeStyle: "short" })} · {s.capacity - (s.booked_count ?? 0)} spot{s.capacity - (s.booked_count ?? 0) === 1 ? "" : "s"} left</div>
                          {s.notes && <div className="text-xs text-muted-foreground mt-1">{s.notes}</div>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="rp-card p-5 space-y-3">
              <h3 className="font-semibold">Details</h3>
              <label className="block text-sm">
                <span className="text-muted-foreground">Topic</span>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} className="rp-input w-full mt-1" placeholder="What do you want to discuss?" />
              </label>
              {tData.teams.length > 0 && (
                <label className="block text-sm">
                  <span className="text-muted-foreground">Team (optional)</span>
                  <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="rp-input w-full mt-1">
                    <option value="">— None —</option>
                    {tData.teams.map((t: any) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                  </select>
                </label>
              )}
              <label className="block text-sm">
                <span className="text-muted-foreground">Notes (optional)</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className="rp-input w-full min-h-24 mt-1" />
              </label>
              {err && <p className="text-red-600 text-sm">{err}</p>}
              <button onClick={book} disabled={busy || !active} className="rp-btn-primary w-full inline-flex items-center justify-center gap-1">
                <Calendar className="size-4" /> {busy ? "Booking…" : "Confirm booking"}
              </button>
            </div>
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
