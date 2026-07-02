import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { rpRequireRole, useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { EmptyState } from "@/components/rakshak-platform/EmptyState";
import { getMyTeamMemberOverview } from "@/lib/rakshak-platform/team-members.functions";
import { listMyMeetings } from "@/lib/rakshak-platform/meetings.functions";
import { CalendarDays, Loader2, UsersRound, Video, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/member")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["team_member", "team_leader"]);
  },
  component: MemberDashboard,
});

function formatMeetingDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function MemberDashboard() {
  const { loading, fullName, email } = useRPAuth();
  const fetchOverview = useServerFn(getMyTeamMemberOverview);
  const fetchMeetings = useServerFn(listMyMeetings);
  const [overview, setOverview] = useState<any>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const [ov, ml] = await Promise.all([
          fetchOverview({ data: {} } as any),
          fetchMeetings({ data: {} } as any).catch(() => ({ meetings: [] as any[] })),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setMeetings((ml as any)?.meetings ?? []);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, fetchOverview, fetchMeetings]);

  if (loading || busy) {
    return (
      <PlatformShell>
        <Section className="!py-16">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your dashboard…
          </div>
        </Section>
      </PlatformShell>
    );
  }

  const teams = overview?.teams ?? [];
  if (!teams.length) {
    return (
      <PlatformShell>
        <Section>
          <Eyebrow>My workspace</Eyebrow>
          <div className="mt-8">
            <EmptyState
              icon={UsersRound}
              title="You're not on a team yet"
              description="A CFI admin will add you to your team's roster. Once that's done, you'll see your team, mentor and upcoming meetings here."
              action={{ label: "Back to platform", to: "/rakshak-platform" }}
            />
          </div>
        </Section>
      </PlatformShell>
    );
  }

  const now = Date.now();
  const upcoming = meetings.filter((m: any) => new Date(m.scheduled_start).getTime() >= now - 15 * 60 * 1000);

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Team member</Eyebrow>
        <h1 className="mt-6 font-heading text-3xl sm:text-4xl font-bold leading-tight">
          Hi {fullName ?? email},<br />
          <span className="text-brand">here's your team.</span>
        </h1>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {/* Team card */}
          <div className="lg:col-span-1 rounded-2xl border border-border bg-card p-6 space-y-4">
            {teams.map((t: any) => {
              const leader = t.team_leader_id ? overview.leaders?.[t.team_leader_id] : null;
              const mentor = t.assigned_mentor_id ? overview.mentors?.[t.assigned_mentor_id] : null;
              const mates = overview.teammates?.[t.id] ?? [];
              return (
                <div key={t.id}>
                  <div className="text-xs text-muted-foreground">Team</div>
                  <div className="font-heading text-xl font-semibold">{t.team_name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t.college}
                    {t.city ? ` · ${t.city}` : ""}
                    {t.state ? `, ${t.state}` : ""}
                  </div>

                  <div className="mt-5 space-y-3 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Team leader</div>
                      <div>{leader?.full_name ?? "—"}</div>
                      {leader?.email && <div className="text-xs text-muted-foreground">{leader.email}</div>}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Mentor</div>
                      <div>{mentor?.full_name ?? "Not assigned yet"}</div>
                      {mentor?.email && <div className="text-xs text-muted-foreground">{mentor.email}</div>}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Teammates ({mates.length})
                      </div>
                      <ul className="mt-1 space-y-1">
                        {mates.map((m: any) => (
                          <li key={m.id} className="text-sm">
                            {m.full_name}
                            <span className="text-xs text-muted-foreground ml-2">{m.role_in_team}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Meetings */}
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-brand" />
              <h2 className="font-heading text-xl font-semibold">Upcoming meetings</h2>
            </div>
            {upcoming.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No meetings scheduled yet. Your team leader or mentor will invite you and you'll see them here with a join link.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {upcoming.map((m: any) => (
                  <li
                    key={m.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{m.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatMeetingDate(m.scheduled_start)}
                      </div>
                    </div>

                    {m.meet_link ? (
                      <a
                        href={m.meet_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand/90"
                      >
                        <Video className="h-4 w-4" /> Join
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">No link yet</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 text-xs text-muted-foreground">
              You can join any meeting your team is invited to. Team leaders and mentors handle scheduling and reports.
            </div>
            <div className="mt-4">
              <Link
                to="/rakshak-platform/meetings"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
              >
                View all meetings <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <RecentFeedbackCard />
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-brand" />
              <h2 className="font-heading text-lg font-semibold">Mentor resources</h2>
            </div>
            {teams.map((t: any) => (
              <div key={t.id} className="mt-3">
                {teams.length > 1 && (
                  <div className="text-xs font-semibold text-muted-foreground mb-1">{t.team_name}</div>
                )}
                <MentorResourcesList mode="viewer" teamId={t.id} />
              </div>
            ))}
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}

