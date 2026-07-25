import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  createAdminSlot,
  listMyAdminSlots,
  cancelAdminSlot,
  createAnnouncement,
  listAnnouncements,
  deleteAnnouncement,
} from "@/lib/rakshak-platform/admin-meetings.functions";
import { formatMeetingWhen } from "@/lib/rakshak-platform/meeting-time";
import { Calendar, Trash2, Video, Megaphone } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/sessions")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["cfi_admin", "super_admin"]);
  },
  component: AdminSessionsPage,
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

function AdminSessionsPage() {
  const qc = useQueryClient();
  const listSlots = useServerFn(listMyAdminSlots);
  const addSlot = useServerFn(createAdminSlot);
  const killSlot = useServerFn(cancelAdminSlot);
  const listAnn = useServerFn(listAnnouncements);
  const addAnn = useServerFn(createAnnouncement);
  const delAnn = useServerFn(deleteAnnouncement);

  const [cohorts, setCohorts] = useState<any[]>([]);
  const [slotBusy, setSlotBusy] = useState(false);
  const [annBusy, setAnnBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("rp_cohorts")
      .select("id, name")
      .order("created_at", { ascending: false })
      .then(({ data }) => setCohorts(data ?? []))
      .catch(() => setCohorts([]));
  }, []);

  const slotsQ = useQuery({
    queryKey: ["rp-admin-slots"],
    queryFn: () => listSlots(),
  });
  const annQ = useQuery({
    queryKey: ["rp-announcements-admin"],
    queryFn: () => listAnn({ data: {} } as any),
  });

  async function handleSlot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const s = new Date(String(fd.get("starts_at") || ""));
    const en = new Date(String(fd.get("ends_at") || ""));
    if (isNaN(s.getTime()) || isNaN(en.getTime())) {
      toast.error("Please pick a valid start and end time.");
      return;
    }
    setSlotBusy(true);
    try {
      await addSlot({
        data: {
          starts_at: s.toISOString(),
          ends_at: en.toISOString(),
          capacity: Number(fd.get("capacity") || 1),
          notes: String(fd.get("notes") || ""),
        },
      });
      try {
        form.reset();
      } catch {
        /* ignore */
      }
      await qc.invalidateQueries({ queryKey: ["rp-admin-slots"] });
      toast.success("Slot published");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not publish slot");
    } finally {
      setSlotBusy(false);
    }
  }

  async function handleAnnouncement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const startRaw = String(fd.get("scheduled_start") || "");
    const endRaw = String(fd.get("scheduled_end") || "");
    setAnnBusy(true);
    try {
      const res = (await addAnn({
        data: {
          kind: String(fd.get("kind") || "admin_meeting") as
            | "admin_meeting"
            | "expert_session",
          cohort_id: String(fd.get("cohort_id") || "") || null,
          title: String(fd.get("title") || ""),
          description: String(fd.get("description") || ""),
          host_name: String(fd.get("host_name") || ""),
          scheduled_start: startRaw ? new Date(startRaw).toISOString() : null,
          scheduled_end: endRaw ? new Date(endRaw).toISOString() : null,
          meeting_link: String(fd.get("meeting_link") || ""),
        },
      })) as any;
      try {
        form.reset();
      } catch {
        /* ignore */
      }
      await qc.invalidateQueries({ queryKey: ["rp-announcements-admin"] });
      toast.success(`Announced — ${res?.notified ?? 0} team leader(s) notified`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not create announcement");
    } finally {
      setAnnBusy(false);
    }
  }

  const slots = (slotsQ.data as any)?.slots ?? [];
  const bookings = (slotsQ.data as any)?.bookings ?? [];
  const announcements = (annQ.data as any)?.announcements ?? [];

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Programme meetings</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Your slots &amp; all-team announcements.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Two modes. Publish bookable slots so a single team can book time with you, or
          broadcast a meeting / expert session to every team (or one cohort). Mentor
          booking and calendar sync are unaffected; admin meetings are not synced to
          Google Calendar.
        </p>

        {/* ---------- MODE A ---------- */}
        <h2 className="mt-10 font-heading text-2xl">Mode A · Teams book you</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <form onSubmit={handleSlot} className="rp-card space-y-3 p-5">
            <h3 className="font-semibold">Publish a slot</h3>
            <label className="block text-sm">
              <span className="text-muted-foreground">Starts</span>
              <input
                name="starts_at"
                type="datetime-local"
                required
                className="rp-input mt-1 w-full"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Ends</span>
              <input
                name="ends_at"
                type="datetime-local"
                required
                className="rp-input mt-1 w-full"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Capacity</span>
              <input
                name="capacity"
                type="number"
                min={1}
                max={20}
                defaultValue={1}
                className="rp-input mt-1 w-full"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Notes (optional)</span>
              <input
                name="notes"
                maxLength={400}
                className="rp-input mt-1 w-full"
                placeholder="e.g. Programme office hours"
              />
            </label>
            <button type="submit" disabled={slotBusy} className="rp-btn-primary w-full">
              {slotBusy ? "Saving…" : "Publish slot"}
            </button>
          </form>

          <div className="space-y-6 lg:col-span-2">
            <div className="rp-card p-5">
              <h3 className="mb-3 font-semibold">Teams booked in</h3>
              {bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {bookings.map((b: any) => (
                    <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                      <Calendar className="size-4 text-muted-foreground" />
                      <div className="min-w-[200px] flex-1">
                        <div className="font-medium">{b.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatMeetingWhen(b.scheduled_start, b.scheduled_end)}
                          {b.rp_teams?.team_name ? ` · ${b.rp_teams.team_name}` : ""}
                        </div>
                      </div>
                      <Link
                        to="/rakshak-platform/session/$id"
                        params={{ id: b.id }}
                        className="rp-btn-primary inline-flex items-center gap-1 text-sm"
                      >
                        <Video className="size-4" /> Join
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rp-card p-5">
              <h3 className="mb-3 font-semibold">Your published slots</h3>
              {slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No slots published yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {slots.map((s: any) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-[220px] flex-1">
                        <div className="font-medium">
                          {formatMeetingWhen(s.starts_at, s.ends_at)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.booked_count}/{s.capacity} booked · {s.status}
                          {s.notes ? ` · ${s.notes}` : ""}
                        </div>
                      </div>
                      {s.status !== "cancelled" && (
                        <button
                          onClick={async () => {
                            if (!confirm("Cancel this slot?")) return;
                            try {
                              await killSlot({ data: { slot_id: s.id } });
                              await qc.invalidateQueries({ queryKey: ["rp-admin-slots"] });
                            } catch (err: any) {
                              toast.error(err?.message ?? "Could not cancel");
                            }
                          }}
                          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-red-600"
                        >
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

        {/* ---------- MODE B ---------- */}
        <h2 className="mt-12 font-heading text-2xl">Mode B · Announce to all teams</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <form onSubmit={handleAnnouncement} className="rp-card space-y-3 p-5">
            <h3 className="font-semibold">New announcement</h3>
            <label className="block text-sm">
              <span className="text-muted-foreground">Type</span>
              <select name="kind" className="rp-input mt-1 w-full" defaultValue="admin_meeting">
                <option value="admin_meeting">Programme meeting</option>
                <option value="expert_session">Expert session</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Audience</span>
              <select name="cohort_id" className="rp-input mt-1 w-full" defaultValue="">
                <option value="">All teams</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Title</span>
              <input name="title" required maxLength={200} className="rp-input mt-1 w-full" />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Host name (optional)</span>
              <input name="host_name" maxLength={200} className="rp-input mt-1 w-full" />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Starts (optional)</span>
              <input name="scheduled_start" type="datetime-local" className="rp-input mt-1 w-full" />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Ends (optional)</span>
              <input name="scheduled_end" type="datetime-local" className="rp-input mt-1 w-full" />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Meeting link (optional)</span>
              <input
                name="meeting_link"
                maxLength={500}
                className="rp-input mt-1 w-full"
                placeholder="https://meet.google.com/…"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Description</span>
              <textarea
                name="description"
                rows={4}
                maxLength={4000}
                className="rp-input mt-1 w-full"
              />
            </label>
            <button type="submit" disabled={annBusy} className="rp-btn-primary w-full">
              {annBusy ? "Announcing…" : "Announce & notify"}
            </button>
          </form>

          <div className="rp-card p-5 lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <Megaphone className="size-4 text-brand" />
              <h3 className="font-semibold">Published announcements</h3>
            </div>
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing announced yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {announcements.map((a: any) => (
                  <li key={a.id} className="flex flex-wrap items-start gap-3 py-3">
                    <div className="min-w-[220px] flex-1">
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.kind === "expert_session" ? "Expert session" : "Programme meeting"}
                        {" · "}
                        {a.cohort_id ? "one cohort" : "all teams"}
                        {a.scheduled_start
                          ? ` · ${formatMeetingWhen(a.scheduled_start, a.scheduled_end)}`
                          : ""}
                      </div>
                      {a.description && (
                        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                          {a.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this announcement?")) return;
                        try {
                          await delAnn({ data: { id: a.id } });
                          await qc.invalidateQueries({
                            queryKey: ["rp-announcements-admin"],
                          });
                        } catch (err: any) {
                          toast.error(err?.message ?? "Could not delete");
                        }
                      }}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="size-4" /> Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}
