import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth, rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { TEAM_STATUS_META, PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { ReviewPanel } from "@/components/rakshak-platform/ReviewPanel";
import { ResolveDoubtsPanel } from "@/components/rakshak-platform/ResolveDoubtsPanel";
import { MentorResourcesList } from "@/components/rakshak-platform/MentorResourcesList";
import { listAdminResourcesForMentor } from "@/lib/rakshak-platform/mentor-resources.functions";

import { EmptyState } from "@/components/rakshak-platform/EmptyState";
import { Loader2, UsersRound, CalendarDays, Clock, BarChart3, BookOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";


export const Route = createFileRoute("/rakshak-platform/mentor/")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["mentor"]);
  },
  component: MentorDashboard,
});

type Overview = {
  upcoming7: number;
  today: number;
  pendingDoubts: number;
  openSlots: number;
  nextSoon: { id: string; title: string; scheduled_start: string } | null;
};

function MentorDashboard() {
  const navigate = useNavigate();
  const { loading, userId, isMentor } = useRPAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const fetchAdminForMentor = useServerFn(listAdminResourcesForMentor);
  const adminResourceFetcher = useCallback(
    () => fetchAdminForMentor({} as any) as unknown as Promise<{ resources: any[] }>,
    [fetchAdminForMentor],
  );



  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isMentor) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    (async () => {
      const { data: mentor } = await supabase.from("rp_mentors").select("id").eq("profile_id", userId).maybeSingle();
      if (!mentor) return;
      const { data } = await supabase
        .from("rp_teams")
        .select("id, team_name, college, city, state, current_phase, status, risk_status, completion_percentage")
        .eq("assigned_mentor_id", mentor.id);
      const teamRows = data ?? [];
      setTeams(teamRows);

      // --- read-only overview numbers (existing tables only) ---
      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
      const in2h = new Date(now.getTime() + 2 * 3600 * 1000);

      const [meetingsRes, slotsRes, doubtsRes] = await Promise.all([
        supabase
          .from("rp_meetings")
          .select("id, title, scheduled_start, status")
          .eq("mentor_id", mentor.id)
          .neq("status", "cancelled")
          .gte("scheduled_start", now.toISOString())
          .lte("scheduled_start", in7.toISOString())
          .order("scheduled_start", { ascending: true }),
        supabase
          .from("rp_mentor_slots")
          .select("id", { count: "exact", head: true })
          .eq("mentor_id", mentor.id)
          .eq("status", "open")
          .gte("starts_at", now.toISOString()),
        teamRows.length
          ? supabase
              .from("rp_doubts")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending")
              .in("team_id", teamRows.map((t: any) => t.id))
          : Promise.resolve({ count: 0 } as any),
      ]);

      const meetings = meetingsRes.data ?? [];
      const todayMeetings = meetings.filter((m: any) => new Date(m.scheduled_start) <= endOfToday);
      const soon = todayMeetings.find((m: any) => new Date(m.scheduled_start) <= in2h) ?? null;

      setOverview({
        upcoming7: meetings.length,
        today: todayMeetings.length,
        pendingDoubts: doubtsRes.count ?? 0,
        openSlots: slotsRes.count ?? 0,
        nextSoon: soon ? { id: soon.id, title: soon.title, scheduled_start: soon.scheduled_start } : null,
      });
    })();
  }, [loading, userId, isMentor, navigate]);


  if (loading) {
    return (
      <PlatformShell>
        <Section className="!py-16">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading mentor workspace…
          </div>
        </Section>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Mentor workspace</Eyebrow>
        <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          Your assigned
          <br /><span className="text-brand">teams.</span>
        </h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/rakshak-platform/meetings" className="rounded-2xl border border-border bg-card p-5 hover:border-brand/40 transition">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Upcoming meetings</div>
            <div className="mt-2 font-heading text-3xl">{overview ? overview.upcoming7 : "—"}</div>
            <div className="mt-1 text-xs text-muted-foreground">next 7 days</div>
          </Link>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Today's schedule</div>
            <div className="mt-2 font-heading text-3xl">{overview ? overview.today : "—"}</div>
            {overview?.nextSoon ? (
              <Link
                to="/rakshak-platform/session/$id"
                params={{ id: overview.nextSoon.id }}
                className="mt-2 inline-flex items-center gap-1 text-xs text-brand hover:underline"
              >
                Quick join next →
              </Link>
            ) : (
              <div className="mt-1 text-xs text-muted-foreground">meetings today</div>
            )}
          </div>
          <Link to="/rakshak-platform/mentor" className="rounded-2xl border border-border bg-card p-5 hover:border-brand/40 transition">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Pending actions</div>
            <div className="mt-2 font-heading text-3xl">{overview ? overview.pendingDoubts : "—"}</div>
            <div className="mt-1 text-xs text-muted-foreground">unresolved doubts from your teams</div>
          </Link>
          <Link to="/rakshak-platform/mentor/availability" className="rounded-2xl border border-border bg-card p-5 hover:border-brand/40 transition">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Availability slots</div>
            <div className="mt-2 font-heading text-3xl">{overview ? overview.openSlots : "—"}</div>
            <div className="mt-1 text-xs text-muted-foreground">open slots ahead</div>
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link to="/rakshak-platform/mentor/availability" className="rounded-2xl border border-border bg-card p-5 hover:border-brand/40 transition">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center"><Clock className="h-5 w-5 text-brand" /></div>
              <div>
                <div className="font-heading text-lg">Availability</div>
                <div className="text-xs text-muted-foreground">Publish slots so teams can book you</div>
              </div>
            </div>
          </Link>

          <Link to="/rakshak-platform/meetings" className="rounded-2xl border border-border bg-card p-5 hover:border-brand/40 transition">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center"><CalendarDays className="h-5 w-5 text-brand" /></div>
              <div>
                <div className="font-heading text-lg">Meetings</div>
                <div className="text-xs text-muted-foreground">Upcoming sessions & RSVPs</div>
              </div>
            </div>
          </Link>
          <Link to="/rakshak-platform/impact" className="rounded-2xl border border-border bg-card p-5 hover:border-brand/40 transition">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center"><BarChart3 className="h-5 w-5 text-brand" /></div>
              <div>
                <div className="font-heading text-lg">Programme impact</div>
                <div className="text-xs text-muted-foreground">Teams, hazards, pitches — in numbers</div>
              </div>
            </div>
          </Link>
        </div>

        {teams.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              icon={UsersRound}
              title="No teams assigned yet"
              description="An admin will assign teams to you shortly. You can also propose a new team below using a verified team leader's email."
            />
          </div>
        ) : (
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">

          {teams.map((t) => {
            const meta = TEAM_STATUS_META[t.status as keyof typeof TEAM_STATUS_META];
            return (
              <Link
                key={t.id}
                to="/rakshak-platform/mentor/teams/$teamId"
                params={{ teamId: t.id }}
                className="rounded-2xl border border-border bg-card p-6 hover:border-brand/40 transition block"
              >
                <div className="font-heading text-lg font-semibold">{t.team_name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t.college} · {t.city}</div>
                <div className="mt-4 text-sm">Phase {t.current_phase} — {PHASE_TITLES[t.current_phase]}</div>
                <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-brand" style={{ width: `${t.completion_percentage}%` }} />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${meta?.tone ?? ""}`}>{meta?.label}</span>
                  <span className={`text-xs ${t.risk_status === "at_risk" ? "text-red-600" : "text-muted-foreground"}`}>{t.risk_status.replace("_"," ")}</span>
                </div>
              </Link>
            );
          })}
        </div>
        )}




        <div className="mt-12 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-brand" />
            <h2 className="font-heading text-lg font-semibold">Resources from admin</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Programme handbooks, rubrics and templates shared by admins — global, and scoped to your teams.
          </p>
          <MentorResourcesList
            mode="viewer"
            sourceFilter="admin"
            fetcher={adminResourceFetcher}
            emptyText="No admin resources yet."
          />
        </div>

        <div className="mt-16 border-t border-border pt-12 space-y-10">
          <ResolveDoubtsPanel />
          <ReviewPanel role="mentor" />
        </div>

      </Section>
    </PlatformShell>
  );
}
