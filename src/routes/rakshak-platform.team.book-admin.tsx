import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";
import {
  listOpenAdminSlots,
  bookAdminSlot,
} from "@/lib/rakshak-platform/admin-meetings.functions";
import { formatMeetingWhen } from "@/lib/rakshak-platform/meeting-time";
import { Loader2, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/team/book-admin")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["team_leader"]);
  },
  component: BookAdminPage,
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

function BookAdminPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listOpenAdminSlots);
  const bookFn = useServerFn(bookAdminSlot);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["rp-open-admin-slots"],
    queryFn: () => listFn(),
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [topic, setTopic] = useState("Programme team check-in");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const slots = (data as any)?.slots ?? [];
  const team = (data as any)?.team ?? null;

  async function book() {
    if (!selected || !team) return;
    setBusy(true);
    try {
      const res = (await bookFn({
        data: { slot_id: selected, team_id: team.id, topic, notes },
      })) as any;
      toast.success("Meeting booked with the programme team");
      navigate({
        to: "/rakshak-platform/session/$id",
        params: { id: res.meeting_id },
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not book this slot");
      await refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>My team · Programme team</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Book a meeting with the programme team.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          These are open slots published by CFI programme admins. Booking one confirms it
          instantly and creates a session room for your team.
        </p>

        {isLoading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading slots…
          </div>
        ) : !team ? (
          <p className="mt-8 text-sm text-muted-foreground">
            No team is linked to your account yet.
          </p>
        ) : slots.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">
            No open programme-team slots right now. Check back soon.
          </p>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <ul className="space-y-2 lg:col-span-2">
              {slots.map((s: any) => (
                <li key={s.id}>
                  <button
                    onClick={() => setSelected(s.id)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selected === s.id
                        ? "border-brand bg-brand-lite"
                        : "border-border hover:border-brand/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <CalendarDays className="h-4 w-4 text-brand" />
                      {formatMeetingWhen(s.starts_at, s.ends_at)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {s.host_name} · {s.booked_count}/{s.capacity} booked
                      {s.notes ? ` · ${s.notes}` : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <div className="rp-card space-y-3 p-5">
              <h3 className="font-semibold">Booking details</h3>
              <div className="text-xs text-muted-foreground">Team: {team.team_name}</div>
              <label className="block text-sm">
                <span className="text-muted-foreground">Topic</span>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  maxLength={200}
                  className="rp-input mt-1 w-full"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">What do you want to discuss?</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="rp-input mt-1 w-full"
                />
              </label>
              <button
                disabled={!selected || busy || !topic.trim()}
                onClick={book}
                className="rp-btn-primary w-full disabled:opacity-60"
              >
                {busy ? "Booking…" : "Confirm booking"}
              </button>
            </div>
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
