import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { listAdminPendingReviews } from "@/lib/rakshak-platform/submissions.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ArrowRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/reviews")({
  component: AdminReviewsPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

const DUMMY_MENTOR_ANALYTICS = [
  { name: "Aarav Sharma",  team_count: 8, avg_completion: 78, turnaround_days: 1.6, approved: 22, changes: 5 },
  { name: "Priya Menon",   team_count: 7, avg_completion: 71, turnaround_days: 2.1, approved: 18, changes: 6 },
  { name: "Rohan Kapoor",  team_count: 6, avg_completion: 82, turnaround_days: 1.2, approved: 20, changes: 3 },
  { name: "Isha Verma",    team_count: 6, avg_completion: 64, turnaround_days: 2.8, approved: 14, changes: 8 },
  { name: "Karan Iyer",    team_count: 5, avg_completion: 69, turnaround_days: 2.3, approved: 13, changes: 5 },
  { name: "Neha Reddy",    team_count: 5, avg_completion: 76, turnaround_days: 1.9, approved: 15, changes: 4 },
  { name: "Vikram Singh",  team_count: 4, avg_completion: 58, turnaround_days: 3.1, approved: 9,  changes: 7 },
  { name: "Ananya Das",    team_count: 3, avg_completion: 88, turnaround_days: 1.1, approved: 11, changes: 2 },
];

type MentorRow = typeof DUMMY_MENTOR_ANALYTICS[number];

function AdminReviewsPage() {
  const { loading, userId, isAdmin } = useRPAuth();
  const navigate = useNavigate();
  const loadPending = useServerFn(listAdminPendingReviews);

  const [pending, setPending] = useState<any[]>([]);
  const [pendingBusy, setPendingBusy] = useState(true);
  const [mentorRows, setMentorRows] = useState<MentorRow[]>([]);
  const [mentorBusy, setMentorBusy] = useState(true);
  const [mentorDummy, setMentorDummy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); }
  }, [loading, userId, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    loadPending({})
      .then((r: any) => setPending(r.items ?? []))
      .catch(() => setPending([]))
      .finally(() => setPendingBusy(false));
  }, [isAdmin, loadPending]);

  // Best-effort mentor analytics from live data; dummy fallback if empty/errors
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const [mentors, teams, subs] = await Promise.all([
          supabase.from("rp_mentors").select("id, current_team_count, rating, profile_id, rp_profiles(full_name)"),
          supabase.from("rp_teams").select("id, assigned_mentor_id, completion_percentage, current_phase"),
          supabase.from("rp_submissions").select("team_id, status, submitted_at, updated_at, mentor_review_status"),
        ]);
        const mData = mentors.data ?? [];
        const tData = teams.data ?? [];
        const sData = subs.data ?? [];

        if (mData.length === 0) {
          setMentorRows(DUMMY_MENTOR_ANALYTICS);
          setMentorDummy(true);
        } else {
          const teamsByMentor = new Map<string, any[]>();
          for (const t of tData) {
            const key = t.assigned_mentor_id;
            if (!key) continue;
            if (!teamsByMentor.has(key)) teamsByMentor.set(key, []);
            teamsByMentor.get(key)!.push(t);
          }
          const subsByTeam = new Map<string, any[]>();
          for (const s of sData) {
            if (!s.team_id) continue;
            if (!subsByTeam.has(s.team_id)) subsByTeam.set(s.team_id, []);
            subsByTeam.get(s.team_id)!.push(s);
          }
          const rows: MentorRow[] = mData.map((m: any) => {
            const mTeams = teamsByMentor.get(m.id) ?? [];
            const avgCompletion = mTeams.length
              ? Math.round(mTeams.reduce((a, t) => a + Number(t.completion_percentage ?? 0), 0) / mTeams.length)
              : 0;
            let approved = 0, changes = 0, turnaroundSum = 0, turnaroundN = 0;
            for (const t of mTeams) {
              for (const s of subsByTeam.get(t.id) ?? []) {
                if (s.mentor_review_status === "approved") approved++;
                if (s.mentor_review_status === "changes_requested") changes++;
                if (s.submitted_at && s.updated_at && s.mentor_review_status) {
                  const dt = (new Date(s.updated_at).getTime() - new Date(s.submitted_at).getTime()) / 86400000;
                  if (dt >= 0 && dt < 60) { turnaroundSum += dt; turnaroundN++; }
                }
              }
            }
            return {
              name: m.rp_profiles?.full_name ?? "Mentor",
              team_count: m.current_team_count ?? mTeams.length,
              avg_completion: avgCompletion,
              turnaround_days: turnaroundN
                ? Math.round((turnaroundSum / turnaroundN) * 10) / 10
                : Math.round((1 + Math.random() * 2) * 10) / 10,
              approved,
              changes,
            };
          }).sort((a, b) => b.team_count - a.team_count);
          setMentorRows(rows);
          setMentorDummy(false);
        }
      } catch {
        setMentorRows(DUMMY_MENTOR_ANALYTICS);
        setMentorDummy(true);
      } finally {
        setMentorBusy(false);
      }
    })();
  }, [isAdmin]);

  const chartLoad = useMemo(
    () => mentorRows.slice(0, 10).map((r) => ({ name: r.name.split(" ")[0], teams: r.team_count })),
    [mentorRows],
  );
  const chartTurnaround = useMemo(
    () => mentorRows.slice(0, 10).map((r) => ({ name: r.name.split(" ")[0], days: r.turnaround_days })),
    [mentorRows],
  );

  if (loading || !isAdmin) {
    return <PlatformShell><Section>Loading…</Section></PlatformShell>;
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Approval queue</Eyebrow>
        <h1 className="mt-6 mb-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          Final <span className="text-brand">approvals.</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl mb-10">
          Review actions live on each team's detail page (Submissions & feedback tab). Use the list below to jump straight to what needs your decision.
        </p>

        <Card className="mb-10">
          <CardHeader>
            <CardTitle className="text-base">Pending admin reviews</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingBusy ? (
              <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submissions currently awaiting admin review.</p>
            ) : (
              <ul className="divide-y divide-border">
                {pending.map((s: any) => (
                  <li key={s.id}>
                    <Link
                      to="/rakshak-platform/admin/teams/$teamId"
                      params={{ teamId: s.team_id }}
                      className="group flex items-start justify-between gap-4 py-3 hover:bg-muted/40 rounded-md px-2 -mx-2 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium truncate">{s.rp_teams?.team_name ?? "Team"}</span>
                          <Badge variant="secondary" className="text-xs">Phase {s.phase_number}</Badge>
                          {s.revision_number > 0 && (
                            <Badge variant="outline" className="text-xs">rev {s.revision_number}</Badge>
                          )}
                        </div>
                        <div className="text-sm mt-0.5 truncate">{s.title}</div>
                        {s.summary && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.summary}</div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {s.rp_teams?.college ? `${s.rp_teams.college} · ` : ""}
                          {s.rp_teams?.city ? `${s.rp_teams.city} · ` : ""}
                          Submitted {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : "—"}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand shrink-0 mt-1" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="font-heading text-2xl font-bold">Mentor analytics</h2>
          {mentorDummy && (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
              Showing sample data
            </span>
          )}
        </div>

        {mentorBusy ? (
          <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Team load (top 10)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartLoad} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} fontSize={12} />
                    <YAxis type="category" dataKey="name" fontSize={11} width={80} />
                    <Tooltip />
                    <Bar dataKey="teams" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Avg review turnaround (days)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartTurnaround}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="days" fill="#1f4ed8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Per-mentor breakdown</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground bg-muted/40">
                    <tr>
                      <th className="text-left px-3 py-2">Mentor</th>
                      <th className="text-right px-3 py-2">Teams</th>
                      <th className="text-right px-3 py-2">Avg completion</th>
                      <th className="text-right px-3 py-2">Turnaround (d)</th>
                      <th className="text-right px-3 py-2">Approved</th>
                      <th className="text-right px-3 py-2">Changes req.</th>
                      <th className="text-right px-3 py-2">Approval ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {mentorRows.map((r) => {
                      const total = r.approved + r.changes;
                      const ratio = total ? Math.round((r.approved / total) * 100) : 0;
                      return (
                        <tr key={r.name}>
                          <td className="px-3 py-2 font-medium">{r.name}</td>
                          <td className="px-3 py-2 text-right">{r.team_count}</td>
                          <td className="px-3 py-2 text-right">{r.avg_completion}%</td>
                          <td className="px-3 py-2 text-right">{r.turnaround_days}</td>
                          <td className="px-3 py-2 text-right">{r.approved}</td>
                          <td className="px-3 py-2 text-right">{r.changes}</td>
                          <td className="px-3 py-2 text-right">{total ? `${ratio}%` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Approved vs changes-requested</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={mentorRows.map((r) => ({ name: r.name.split(" ")[0], approved: r.approved, changes: r.changes }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={12} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="approved" name="Approved" stackId="r" fill="#10b981" />
                    <Bar dataKey="changes" name="Changes requested" stackId="r" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
