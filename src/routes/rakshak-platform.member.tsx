import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { rpRequireRole, useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { EmptyState } from "@/components/rakshak-platform/EmptyState";
import { getMyTeamMemberOverview } from "@/lib/rakshak-platform/team-members.functions";
import { listMyMeetings } from "@/lib/rakshak-platform/meetings.functions";
import { listTeamPhases } from "@/lib/rakshak-platform/submissions.functions";
import {
  CalendarDays,
  Loader2,
  UsersRound,
  Video,
  ExternalLink,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { MentorResourcesList } from "@/components/rakshak-platform/MentorResourcesList";
import { RecentFeedbackCard } from "@/components/rakshak-platform/RecentFeedbackCard";
import { RecentMeetingNotesCard } from "@/components/rakshak-platform/RecentMeetingNotesCard";
import { DoubtsCard } from "@/components/rakshak-platform/DoubtsCard";
import { PHASE_TITLES, STATUS_META } from "@/lib/rakshak-platform/constants";

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

function PhaseTimeline({
  teamId,
  currentPhase,
}: {
  teamId: string;
  currentPhase: number;
}) {
  const fetchPhases = useServerFn(listTeamPhases);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await fetchPhases({ data: { team_id: teamId } } as any)) as any;
        if (!cancelled) setRows(res?.phases ?? []);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPhases, teamId]);

  if (busy) {
    return (
      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading phases…
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {[0, 1, 2, 3, 4].map((p) => {
        const row = rows.find((x) => x.phase_number === p);
        const status = (row?.progress?.status ?? "not_started") as keyof typeof STATUS_META;
        const meta = STATUS_META[status] ?? STATUS_META.not_started;
        const pct = row?.progress?.completion_percentage ?? 0;
        return (
          <div
            key={p}
            className={`flex items-center gap-4 p-4 rounded-xl border ${
              p === currentPhase ? "border-brand bg-brand-lite" : "border-border"
            }`}
          >
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center font-heading font-bold ${
                p <= currentPhase
                  ? "bg-brand text-brand-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {p}
            </div>
            <div className="flex-1">
              <div className="font-semibold">{PHASE_TITLES[p]}</div>
              <div className="text-xs text-muted-foreground">{pct}% complete</div>
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${meta.tone}`}
            >
              {meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
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
  const upcoming = meetings.filter(
    (m: any) => new Date(m.scheduled_start).getTime() >= now - 15 * 60 * 1000,
  );
  const primary = teams[0];
  const primaryLeader = primary.team_leader_id
    ? overview.leaders?.[primary.team_leader_id]
    : null;
  const primaryMentor = primary.assigned_mentor_id
    ? overview.mentors?.[primary.assigned_mentor_id]
    : null;
  const primaryMates = overview.teammates?.[primary.id] ?? [];

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>My team</Eyebrow>
        <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          {primary.team_name}
          <br />
          <span className="text-brand">
            Phase {primary.current_phase} — {PHASE_TITLES[primary.current_phase]}
          </span>
        </h1>
        <p className="mt-4 text-muted-foreground">
          Hi {fullName ?? email} · {primary.college}
          {primary.city ? ` · ${primary.city}` : ""}
          {primary.state ? `, ${primary.state}` : ""}
        </p>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            to="/rakshak-platform/meetings"
            className="group rounded-2xl border border-border bg-card p-5 hover:border-brand/40 transition"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-brand" />
              </div>
              <div>
                <div className="font-heading text-lg">All meetings</div>
                <div className="text-xs text-muted-foreground">
                  Upcoming & past sessions, RSVPs
                </div>
              </div>
            </div>
          </Link>
          <Link
            to="/rakshak-platform/impact"
            className="group rounded-2xl border border-border bg-card p-5 hover:border-brand/40 transition"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-brand" />
              </div>
              <div>
                <div className="font-heading text-lg">Programme impact</div>
                <div className="text-xs text-muted-foreground">
                  Teams, hazards, authority pitches — in numbers
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-7">
            <h2 className="font-heading text-xl font-semibold">Phase timeline</h2>
            <PhaseTimeline teamId={primary.id} currentPhase={primary.current_phase} />
          </div>
          <div className="rounded-2xl border border-border bg-card p-7 space-y-5">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Team leader
              </div>
              <div className="font-semibold">{primaryLeader?.full_name ?? "—"}</div>
              {primaryLeader?.email && (
                <div className="text-xs text-muted-foreground">{primaryLeader.email}</div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Mentor</div>
              <div className="font-semibold">
                {primaryMentor?.full_name ?? "Not assigned yet"}
              </div>
              {primaryMentor?.email && (
                <div className="text-xs text-muted-foreground">{primaryMentor.email}</div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Teammates ({primaryMates.length})
              </div>
              <ul className="mt-1 space-y-1">
                {primaryMates.map((m: any) => (
                  <li key={m.id} className="text-sm">
                    {m.full_name}
                    <span className="text-xs text-muted-foreground ml-2">
                      {m.role_in_team}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Risk status
              </div>
              <div className="font-semibold">
                {String(primary.risk_status ?? "on_track").replace("_", " ")}
              </div>
              {primary.risk_reason && (
                <p className="text-xs text-red-600 mt-1">{primary.risk_reason}</p>
              )}
            </div>
            <Link
              to="/rakshak-platform/team/phases/$phase"
              params={{ phase: String(primary.current_phase) }}
              search={{ team: primary.id }}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
            >
              Open current phase <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Upcoming meetings */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-7">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-brand" />
            <h2 className="font-heading text-xl font-semibold">Upcoming meetings</h2>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No meetings scheduled yet. Your team leader or mentor will invite you and
              you'll see them here with a join link.
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
          <div className="mt-4">
            <Link
              to="/rakshak-platform/meetings"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
            >
              View all meetings <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Feedback + mentor resources */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <RecentFeedbackCard />
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-brand" />
              <h2 className="font-heading text-lg font-semibold">Resources from your mentor</h2>
            </div>
            {teams.map((t: any) => (
              <div key={t.id} className="mt-3">
                {teams.length > 1 && (
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    {t.team_name}
                  </div>
                )}
                <MentorResourcesList
                  mode="viewer"
                  teamId={t.id}
                  sourceFilter="mentor"
                  emptyText="Your mentor hasn't shared anything yet."
                />
              </div>
            ))}
          </div>
        </div>

        {/* Admin-authored resources */}
        <div className="mt-8">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-brand" />
              <h2 className="font-heading text-lg font-semibold">Resources from admin</h2>
            </div>
            {teams.map((t: any) => (
              <div key={t.id} className="mt-3">
                {teams.length > 1 && (
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    {t.team_name}
                  </div>
                )}
                <MentorResourcesList
                  mode="viewer"
                  teamId={t.id}
                  sourceFilter="admin"
                  emptyText="No programme resources shared by admin yet."
                />
              </div>
            ))}
          </div>
        </div>


        <div className="mt-8">
          <RecentMeetingNotesCard />
        </div>

        <div className="mt-8">
          <DoubtsCard teamId={primary.id} phaseNumber={primary.current_phase} />
        </div>



        {/* Additional teams (rare) */}
        {teams.length > 1 && (
          <div className="mt-12 space-y-6">
            <h2 className="font-heading text-2xl font-semibold">Your other teams</h2>
            {teams.slice(1).map((t: any) => (
              <div
                key={t.id}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="text-xs text-muted-foreground">Team</div>
                <div className="font-heading text-xl font-semibold">{t.team_name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Phase {t.current_phase} — {PHASE_TITLES[t.current_phase]}
                </div>
                <PhaseTimeline teamId={t.id} currentPhase={t.current_phase} />
              </div>
            ))}
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
