import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { listTeamsAdminOverview } from "@/lib/rakshak-platform/admin-teams.functions";
import { CLUSTER_META, CLUSTER_ORDER } from "@/lib/rakshak-platform/admin-team-health";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { Loader2, Search, UsersRound, Trophy, GraduationCap, MapPin, Mail, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/teams/")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["cfi_admin", "super_admin"]);
  },
  component: AdminTeamsIndex,
});


function AdminTeamsIndex() {
  const fetchTeams = useServerFn(listTeamsAdminOverview);
  const [teams, setTeams] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await fetchTeams({ data: {} } as any)) as any;
        if (!cancelled) setTeams(res?.teams ?? []);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchTeams]);

  const filtered = useMemo(() => {
    if (!q.trim()) return teams;
    const s = q.toLowerCase();
    return teams.filter((t) => {
      if (t.team_name?.toLowerCase().includes(s)) return true;
      if (t.college?.toLowerCase().includes(s)) return true;
      if (t.city?.toLowerCase().includes(s)) return true;
      if (t.state?.toLowerCase().includes(s)) return true;
      if (t.leader?.full_name?.toLowerCase().includes(s)) return true;
      if (t.leader?.email?.toLowerCase().includes(s)) return true;
      if (t.rp_mentors?.rp_profiles?.full_name?.toLowerCase().includes(s)) return true;
      if (t.rp_mentors?.rp_profiles?.email?.toLowerCase().includes(s)) return true;
      if (t.evaluator?.full_name?.toLowerCase().includes(s)) return true;
      if (t.evaluator?.email?.toLowerCase().includes(s)) return true;
      for (const m of t.members ?? []) {
        if (m.full_name?.toLowerCase().includes(s)) return true;
        if (m.email?.toLowerCase().includes(s)) return true;
      }
      return false;
    });
  }, [teams, q]);

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Teams</Eyebrow>
        <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold">All teams</h1>
            <p className="mt-1 text-muted-foreground">
              Ranked by score. Click a card to see phase-wise submissions, mentor & evaluator remarks, meetings and every member.
            </p>
          </div>
          <Link to="/rakshak-platform/admin" className="text-sm text-brand hover:underline">
            ← Back to admin
          </Link>
        </div>

        <div className="mt-6 relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search team, college, leader, member (name or email), mentor, evaluator…"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm"
          />
          {q && (
            <div className="mt-1 text-xs text-muted-foreground">
              {filtered.length} of {teams.length} teams match.
            </div>
          )}
        </div>

        {busy ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading teams…
          </div>
        ) : err ? (
          <p className="mt-8 text-sm text-red-600">{err}</p>
        ) : (
          <div className="mt-6 space-y-10">
            {CLUSTER_ORDER.map((key) => {
              const group = filtered
                .filter((t) => (t.cluster ?? "needs_attention") === key)
                .sort((a, b) => (b.health ?? 0) - (a.health ?? 0));
              if (group.length === 0) return null;
              const meta = CLUSTER_META[key];
              return (
                <div key={key}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                    <h2 className={`font-heading text-lg font-bold ${meta.header}`}>{meta.label}</h2>
                    <span className={`text-xs rounded-full border px-2 py-0.5 ${meta.badge}`}>{group.length}</span>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.map((t) => {
                      const mentor = t.rp_mentors?.rp_profiles;
                      const evaluator = t.evaluator;
                      const completion = Math.max(0, Math.min(100, Number(t.completion_percentage ?? 0)));
                      return (
                        <Link
                          key={t.id}
                          to="/rakshak-platform/admin/teams/$teamId"
                          params={{ teamId: t.id }}
                          className="group rounded-2xl border border-border bg-card p-5 hover:border-brand hover:shadow-md transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {t.rank && (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-brand">
                                    <Trophy className="h-3.5 w-3.5" /> #{t.rank}
                                  </span>
                                )}
                                <span className={`text-[10px] uppercase tracking-wider rounded-full border px-2 py-0.5 ${meta.badge}`}>
                                  {meta.label} · {t.health ?? 0}
                                </span>
                              </div>
                              <h3 className="mt-1 font-heading text-lg font-bold truncate">{t.team_name}</h3>
                              <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1 truncate">
                                <GraduationCap className="h-3 w-3 shrink-0" />
                                <span className="truncate">{t.college ?? "—"}</span>
                              </div>
                              {(t.city || t.state) && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  {[t.city, t.state].filter(Boolean).join(", ")}
                                </div>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-brand shrink-0" />
                          </div>

                          <div className="mt-4 space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Phase</span>
                              <span className="font-medium">
                                {t.current_phase} — {PHASE_TITLES[t.current_phase] ?? ""}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Score</span>
                              <span className="font-semibold">
                                {t.final_score ?? "—"} <span className="text-muted-foreground font-normal">({t.evaluated_phases ?? 0}/5 phases)</span>
                              </span>
                            </div>
                            {(t.overdue_count ?? 0) > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Overdue phases</span>
                                <span className="font-semibold text-red-600">{t.overdue_count}</span>
                              </div>
                            )}
                            <div>
                              <div className="flex justify-between mb-0.5">
                                <span className="text-muted-foreground">Completion</span>
                                <span className="font-medium">{completion}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full bg-brand transition-all" style={{ width: `${completion}%` }} />
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-border grid gap-1.5 text-xs">
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Leader</div>
                              <div className="font-medium truncate">{t.leader?.full_name ?? "—"}</div>
                              {t.leader?.email && (
                                <div className="text-muted-foreground truncate flex items-center gap-1">
                                  <Mail className="h-3 w-3 shrink-0" />{t.leader.email}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mentor</div>
                              <div className="font-medium truncate">{mentor?.full_name ?? "Unassigned"}</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Evaluator</div>
                              <div className="font-medium truncate">{evaluator?.full_name ?? "Unassigned"}</div>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground pt-1">
                              <UsersRound className="h-3 w-3" /> {t.member_count} member{t.member_count === 1 ? "" : "s"}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No teams match your search.
              </div>
            )}
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
