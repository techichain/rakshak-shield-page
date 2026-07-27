import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth, rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { EmptyState } from "@/components/rakshak-platform/EmptyState";
import { Loader2, UsersRound, Video, CalendarDays, BookOpen, BarChart3, ChevronDown, ChevronRight, FileText, MessageSquare, Star, FolderOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PHASE_TITLES, STATUS_META } from "@/lib/rakshak-platform/constants";
import { MentorResourcesList } from "@/components/rakshak-platform/MentorResourcesList";
import { RecentFeedbackCard } from "@/components/rakshak-platform/RecentFeedbackCard";
import { RecentMeetingNotesCard } from "@/components/rakshak-platform/RecentMeetingNotesCard";
import { DoubtsCard } from "@/components/rakshak-platform/DoubtsCard";
import { AnnouncementsCard } from "@/components/rakshak-platform/AnnouncementsCard";
import { TeamRankCard } from "@/components/rakshak-platform/TeamRankCard";
import { getTeamPhaseTimeline } from "@/lib/rakshak-platform/submissions.functions";

export const Route = createFileRoute("/rakshak-platform/team/")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["team_leader"]);
  },
  component: TeamDashboard,
});


function TeamDashboard() {
  const navigate = useNavigate();
  const { loading, userId, isTeam } = useRPAuth();
  const [team, setTeam] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const fetchTimeline = useServerFn(getTeamPhaseTimeline);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isTeam) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    (async () => {
      const { data: t } = await supabase
        .from("rp_teams")
        .select("*")
        .eq("team_leader_id", userId)
        .maybeSingle();
      setTeam(t);
      if (t) {
        const { data: p } = await supabase
          .from("rp_team_phase_progress")
          .select("*")
          .eq("team_id", t.id)
          .order("phase_number");
        setProgress(p ?? []);
        try {
          const res = await fetchTimeline({ data: { team_id: t.id } } as any) as any;
          setTimeline(res?.phases ?? []);
        } catch {
          // ignore — timeline is enrichment, page still renders
        }
      }
    })();
  }, [loading, userId, isTeam, navigate, fetchTimeline]);

  const togglePhase = (n: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  };

  if (loading) {
    return (
      <PlatformShell>
        <Section className="!py-16">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your team…
          </div>
        </Section>
      </PlatformShell>
    );
  }

  if (!team) {
    return (
      <PlatformShell>
        <Section>
          <Eyebrow>My team</Eyebrow>
          <div className="mt-8">
            <EmptyState
              icon={UsersRound}
              title="You're not linked to a team yet."
              description="Your account isn't currently attached to any Project Rakshak team. If this is unexpected, ask a programme admin to add you to a team."
              action={{ label: "Go to platform home", to: "/rakshak-platform" }}
              secondaryAction={{ label: "Switch account", to: "/rakshak-platform/auth" }}
            />
          </div>
        </Section>
      </PlatformShell>
    );
  }



  return (
    <PlatformShell>
      <Section>
        <Eyebrow>My team</Eyebrow>
        <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          {team.team_name}
          <br />
          <span className="text-brand">Phase {team.current_phase} — {PHASE_TITLES[team.current_phase]}</span>
        </h1>
        <p className="mt-4 text-muted-foreground">{team.college} · {team.city}, {team.state}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            to="/rakshak-platform/team/book-mentor"
            className="group rounded-2xl border border-brand/30 bg-brand-lite p-5 hover:border-brand transition"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-brand text-brand-foreground flex items-center justify-center">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <div className="font-heading text-lg">Book mentor session</div>
                <div className="text-xs text-muted-foreground">Live availability · auto Google Meet</div>
              </div>
            </div>
          </Link>
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
                <div className="text-xs text-muted-foreground">Upcoming & past sessions, RSVPs</div>
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
                <div className="text-xs text-muted-foreground">Teams, hazards, authority pitches — in numbers</div>
              </div>
            </div>
          </Link>
        </div>


        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-7">
            <h2 className="font-heading text-xl font-semibold">Phase timeline</h2>
            <p className="mt-1 text-xs text-muted-foreground">Click any phase to expand submission, feedback and evaluator scores.</p>
            <div className="mt-6 space-y-3">
              {[0,1,2,3,4].map((p) => {
                const row = progress.find((x) => x.phase_number === p);
                const meta = row ? STATUS_META[row.status as keyof typeof STATUS_META] : STATUS_META.not_started;
                const tl = timeline.find((x) => x.phase_number === p);
                const isOpen = expanded.has(p);
                return (
                  <div key={p} className={`rounded-xl border ${p === team.current_phase ? "border-brand bg-brand-lite" : "border-border"}`}>
                    <button
                      type="button"
                      onClick={() => togglePhase(p)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/40 rounded-xl transition"
                      aria-expanded={isOpen}
                    >
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-heading font-bold ${p < team.current_phase ? "bg-brand text-brand-foreground" : p === team.current_phase ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"}`}>
                        {p}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{PHASE_TITLES[p]}</div>
                        <div className="text-xs text-muted-foreground">{row?.completion_percentage ?? 0}% complete</div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${meta.tone}`}>{meta.label}</span>
                      {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {isOpen && (
                      <div className="border-t border-border/70 p-4 space-y-4 text-sm">
                        {/* Submission */}
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" /> Submission
                          </div>
                          {tl?.submission ? (
                            <div className="mt-1">
                              <div className="font-medium">{tl.submission.title ?? "Untitled submission"}</div>
                              <div className="text-xs text-muted-foreground">
                                Status: {tl.submission.status} · Submitted: {tl.submission.submitted_at ? new Date(tl.submission.submitted_at).toLocaleString() : "not yet submitted"}
                              </div>
                              {tl.submission.summary && (
                                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{tl.submission.summary}</p>
                              )}
                              <Link
                                to="/rakshak-platform/team/phases/$phase"
                                params={{ phase: String(p) }}
                                search={{ team: team.id }}
                                className="text-xs text-brand hover:underline mt-1 inline-block"
                              >
                                Open full phase →
                              </Link>
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">Nothing here yet.</p>
                          )}
                        </div>

                        {/* Evaluator scores */}
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <Star className="h-3.5 w-3.5" /> Evaluator scores
                          </div>
                          {tl?.evaluations?.length ? (
                            <ul className="mt-1 space-y-1">
                              {tl.evaluations.map((ev: any) => (
                                <li key={ev.id} className="flex items-center justify-between gap-2">
                                  <span>
                                    {ev.evaluator?.full_name ?? "Evaluator"}
                                    <span className="text-muted-foreground"> · {ev.status}</span>
                                  </span>
                                  <span className="font-medium">
                                    {ev.weighted_score ?? ev.total_score ?? "—"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">Nothing here yet.</p>
                          )}
                        </div>

                        {/* Feedback (mentor + evaluator + admin) */}
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" /> Comments & remarks
                          </div>
                          {tl?.feedback?.length ? (
                            <ul className="mt-1 space-y-2">
                              {tl.feedback.map((f: any) => (
                                <li key={f.id} className="border-l-2 border-border pl-3">
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">{f.rp_profiles?.full_name ?? "Reviewer"}</span>
                                    {" · "}<span className="uppercase">{f.reviewer_role}</span>
                                    {" · "}{new Date(f.created_at).toLocaleString()}
                                  </div>
                                  <div className="whitespace-pre-wrap">{f.feedback_text}</div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">Nothing here yet.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-7">
            <h2 className="font-heading text-xl font-semibold">Next action</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Complete the Phase {team.current_phase} checklist and submit for mentor review.
            </p>
            <div className="mt-6 text-xs text-muted-foreground">Risk status</div>
            <div className="mt-1 font-semibold">{team.risk_status.replace("_"," ")}</div>
            {team.risk_reason && <p className="text-xs text-red-600 mt-1">{team.risk_reason}</p>}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <RecentFeedbackCard />
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-brand" />
              <h2 className="font-heading text-lg font-semibold">Resources from your mentor</h2>
            </div>
            <MentorResourcesList
              mode="viewer"
              teamId={team.id}
              sourceFilter="mentor"
              emptyText="Your mentor hasn't shared anything yet."
            />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <TeamRankCard teamId={team.id} phaseNumber={team.current_phase} />
          <AnnouncementsCard />
          <RecentMeetingNotesCard />
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-brand" />
              <h2 className="font-heading text-lg font-semibold">Resources from admin</h2>
            </div>
            <MentorResourcesList
              mode="viewer"
              teamId={team.id}
              sourceFilter="admin"
              emptyText="No programme resources shared by admin yet."
            />
          </div>
        </div>


        <div className="mt-8">
          <DoubtsCard teamId={team.id} phaseNumber={team.current_phase} />
        </div>
      </Section>
    </PlatformShell>
  );
}
