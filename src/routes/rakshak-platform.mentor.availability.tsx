import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { createMentorSlot, listMySlots, cancelMentorSlot } from "@/lib/rakshak-platform/mentor-sessions.functions";
import { useRPAuth, rpRequireRole } from "@/lib/rakshak-platform/auth";
import { Calendar, Trash2, Video, X } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/mentor/availability")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["mentor"]);
  },
  component: AvailabilityPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

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

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const fd = new FormData(e.currentTarget);
    try {
      await createFn({
        data: {
          starts_at: new Date(String(fd.get("starts_at"))).toISOString(),
          ends_at: new Date(String(fd.get("ends_at"))).toISOString(),
          capacity: Number(fd.get("capacity") || 1),
          notes: String(fd.get("notes") || ""),
        },
      });
      (e.currentTarget as HTMLFormElement).reset();
      qc.invalidateQueries({ queryKey: ["rp-my-slots"] });
    } catch (e: any) { setErr(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this slot?")) return;
    await cancelFn({ data: { slot_id: id } });
    qc.invalidateQueries({ queryKey: ["rp-my-slots"] });
  }

  if (!isMentor) return null;

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Mentor · Availability</Eyebrow>
        <h1 className="text-3xl font-extrabold mb-2">Your bookable 1:1 slots</h1>
        <p className="text-muted-foreground mb-6">Teams will see your open slots on your public profile and can book directly. Each booking creates a session with a video room and a whiteboard.</p>

        <div className="grid lg:grid-cols-3 gap-6">
          <form onSubmit={handleCreate} className="rp-card p-5 space-y-3 lg:col-span-1">
            <h3 className="font-semibold">Add a slot</h3>
            <label className="block text-sm">
              <span className="text-muted-foreground">Starts</span>
              <input name="starts_at" type="datetime-local" required className="rp-input w-full mt-1" />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Ends</span>
              <input name="ends_at" type="datetime-local" required className="rp-input w-full mt-1" />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Capacity</span>
              <input name="capacity" type="number" min={1} max={20} defaultValue={1} className="rp-input w-full mt-1" />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Notes (optional)</span>
              <input name="notes" maxLength={400} className="rp-input w-full mt-1" placeholder="e.g. Office hours · ask anything" />
            </label>
            {err && <p className="text-red-600 text-sm">{err}</p>}
            <button disabled={busy} className="rp-btn-primary w-full">{busy ? "Saving…" : "Publish slot"}</button>
          </form>

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
                        <div className="text-xs text-muted-foreground">{new Date(b.scheduled_start).toLocaleString()} {b.rp_teams?.team_name ? `· ${b.rp_teams.team_name}` : ""}</div>
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
                          <Trash2 className="size-4" /> Cancel
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
