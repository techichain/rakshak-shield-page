import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/rakshak-platform/EmptyState";

export const Route = createFileRoute("/rakshak-platform/admin/reviews")({
  component: AdminReviewsPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

type MentorRow = {
  name: string;
  team_count: number;
  avg_completion: number;
  turnaround_days: number;
  approved: number;
  changes: number;
};

function AdminReviewsPage() {
  const { loading, userId, isAdmin } = useRPAuth();
  const navigate = useNavigate();

  const [mentorRows, setMentorRows] = useState<MentorRow[]>([]);
  const [mentorBusy, setMentorBusy] = useState(true);

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
          setMentorRows([]);
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
        }
      } catch {
        setMentorRows([]);
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

        {mentorBusy ? (
          <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : mentorRows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No reviews yet"
            description="Mentor review activity will appear here once evaluators and mentors start reviewing team submissions."
          />
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
