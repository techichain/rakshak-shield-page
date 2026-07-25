import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

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

  const [mentorRows, setMentorRows] = useState<MentorRow[]>([]);
  const [mentorBusy, setMentorBusy] = useState(true);
  const [mentorDummy, setMentorDummy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); }
  }, [loading, userId, isAdmin, navigate]);

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
                : 0,
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

  if (loading || !isAdmin) {
    return <PlatformShell><Section>Loading…</Section></PlatformShell>;
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Mentor review stats</Eyebrow>
        <h1 className="mt-6 mb-4 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          Mentor review <span className="text-brand">activity.</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl mb-8">
          Each mentor's review workload and outcomes — teams assigned, average team completion,
          review turnaround, and how many submissions they approved vs sent back for changes.
        </p>

        {mentorDummy && (
          <div className="mb-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
              Showing sample data — no mentors found yet
            </span>
          </div>
        )}

        {mentorBusy ? (
          <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <Card>
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
                        <td className="px-3 py-2 text-right">{r.turnaround_days || "—"}</td>
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
        )}
      </Section>
    </PlatformShell>
  );
}
