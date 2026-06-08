import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { TEAM_STATUS_META, STATUS_META } from "@/lib/rakshak-platform/constants";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin")({
  component: AdminDashboard,
});

type Counts = {
  teams: number; activeTeams: number; atRisk: number; completed: number;
  pendingSubmissions: number; pendingMentorReviews: number;
};

function AdminDashboard() {
  const navigate = useNavigate();
  const { loading, userId, isAdmin } = useRPAuth();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    load();
  }, [loading, userId, isAdmin, navigate]);

  async function load() {
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from("rp_teams").select("id, team_name, college, city, state, current_phase, status, risk_status, completion_percentage, last_activity_at").order("last_activity_at", { ascending: false }).limit(50),
      supabase.from("rp_submissions").select("id, team_id, phase_number, title, status, submitted_at, rp_teams(team_name)").order("submitted_at", { ascending: false, nullsFirst: false }).limit(20),
    ]);
    const tt = t ?? [];
    setTeams(tt);
    setSubs(s ?? []);
    setCounts({
      teams: tt.length,
      activeTeams: tt.filter((x) => x.status === "active").length,
      atRisk: tt.filter((x) => x.risk_status === "at_risk").length,
      completed: tt.filter((x) => x.status === "completed").length,
      pendingSubmissions: (s ?? []).filter((x) => ["submitted", "resubmitted"].includes(x.status)).length,
      pendingMentorReviews: (s ?? []).filter((x) => x.status === "under_mentor_review").length,
    });
  }

  async function seed() {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const cities = [
        { c: "Jaipur", st: "Rajasthan" }, { c: "Delhi", st: "Delhi" },
        { c: "Gurugram", st: "Haryana" }, { c: "Bengaluru", st: "Karnataka" },
        { c: "Pune", st: "Maharashtra" }, { c: "Kolkata", st: "West Bengal" },
        { c: "Mumbai", st: "Maharashtra" }, { c: "Chennai", st: "Tamil Nadu" },
      ];
      const issues = ["unsafe pedestrian crossing","pothole-heavy road","missing signage","dangerous U-turn","poor lighting","school-zone speeding","broken divider","blind curve","missing lane markings"];
      const sev = ["low","medium","high","critical"] as const;
      const teamStatuses = ["active","active","active","delayed","at_risk","completed"] as const;

      const { data: cohorts, error: cErr } = await supabase.from("rp_cohorts").insert([
        { name: "Cohort 1 · Jaipur–Delhi 2026", year: 2026, region: "North", description: "First Project Rakshak cohort.", start_date: "2026-01-15", end_date: "2026-08-15", status: "active", participating_states: ["Rajasthan","Delhi","Haryana"], created_by: userId },
        { name: "Cohort 2 · Bengaluru–Pune 2026", year: 2026, region: "South & West", description: "Second cohort across Bengaluru, Pune, Mumbai.", start_date: "2026-03-01", end_date: "2026-10-01", status: "active", participating_states: ["Karnataka","Maharashtra","Tamil Nadu"], created_by: userId },
      ]).select();
      if (cErr) throw cErr;

      const teamsToInsert = [];
      for (let i = 0; i < 20; i++) {
        const city = cities[i % cities.length];
        const cohort = cohorts![i < 10 ? 0 : 1];
        teamsToInsert.push({
          cohort_id: cohort.id,
          team_name: `Rakshak Team ${String(i + 1).padStart(2, "0")}`,
          college: ["IIT","NIT","SRCC","Symbiosis","Christ University","BITS","DTU","VIT"][i % 8] + " " + city.c,
          city: city.c, state: city.st,
          current_phase: Math.min(4, Math.floor(i / 4)),
          status: teamStatuses[i % teamStatuses.length],
          risk_status: i % 7 === 0 ? "at_risk" : i % 5 === 0 ? "attention" : "on_track",
          risk_reason: i % 7 === 0 ? "No activity for 12 days" : null,
          completion_percentage: Math.min(100, 15 + i * 4),
          health_score: Math.max(30, 100 - (i % 7) * 10),
        });
      }
      const { data: insertedTeams, error: tErr } = await supabase.from("rp_teams").insert(teamsToInsert).select();
      if (tErr) throw tErr;

      // Phase progress for each team
      const tppRows: any[] = [];
      const subRows: any[] = [];
      const locRows: any[] = [];
      const phaseStatuses = ["completed","admin_approved","mentor_approved","under_mentor_review","submitted","draft"] as const;
      for (const t of insertedTeams!) {
        for (let p = 0; p <= 4; p++) {
          const isCurrent = p === t.current_phase;
          const isPast = p < t.current_phase;
          tppRows.push({
            team_id: t.id, phase_number: p,
            status: isPast ? "completed" : isCurrent ? "submitted" : "not_started",
            completion_percentage: isPast ? 100 : isCurrent ? 60 : 0,
            deadline: isCurrent ? new Date(Date.now() + 14 * 86400000).toISOString() : null,
            started_at: isPast || isCurrent ? new Date(Date.now() - 21 * 86400000).toISOString() : null,
            completed_at: isPast ? new Date(Date.now() - 5 * 86400000).toISOString() : null,
          });
          if (isPast || isCurrent) {
            subRows.push({
              team_id: t.id, phase_number: p,
              title: `Phase ${p} report — ${t.team_name}`,
              summary: `Submission for phase ${p}.`,
              status: isPast ? "admin_approved" : phaseStatuses[(Math.floor(Math.random()*6))],
              submitted_at: new Date(Date.now() - 7 * 86400000).toISOString(),
            });
          }
        }
        for (let k = 0; k < 2 + (Math.random() < 0.3 ? 1 : 0); k++) {
          locRows.push({
            team_id: t.id, phase_number: 0,
            location_name: `${issues[k % issues.length]} near ${t.college}`,
            address: `${t.city}`, city: t.city, state: t.state,
            latitude: 20 + Math.random() * 8, longitude: 73 + Math.random() * 12,
            issue_type: issues[k % issues.length], severity: sev[k % 4],
            description: "Identified by team during Phase 0 scouting.",
            is_final_selected: k === 0,
          });
        }
      }
      const { error: tppErr } = await supabase.from("rp_team_phase_progress").insert(tppRows);
      if (tppErr) throw tppErr;
      const { error: subErr } = await supabase.from("rp_submissions").insert(subRows);
      if (subErr) throw subErr;
      const { error: locErr } = await supabase.from("rp_locations").insert(locRows);
      if (locErr) throw locErr;

      setSeedMsg(`Seeded ${insertedTeams!.length} teams, ${subRows.length} submissions, ${locRows.length} locations.`);
      await load();
    } catch (e) {
      setSeedMsg(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }

  if (loading || !isAdmin) {
    return (
      <PlatformShell>
        <Section><Loader2 className="h-5 w-5 animate-spin text-brand" /></Section>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>CFI Admin command centre</Eyebrow>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight max-w-3xl">
            Every team, every phase,
            <br />
            <span className="text-brand">in one view.</span>
          </h1>
          <button
            onClick={seed} disabled={seeding}
            className="h-12 rounded-full bg-brand px-6 text-sm text-brand-foreground hover:bg-brand/90 inline-flex items-center gap-2 disabled:opacity-50"
          >
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {seeding ? "Seeding…" : "Seed demo data"}
          </button>
        </div>
        {seedMsg && <p className="mt-3 text-sm text-muted-foreground">{seedMsg}</p>}

        {/* Counts */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            ["Total teams", counts?.teams ?? 0],
            ["Active", counts?.activeTeams ?? 0],
            ["Completed", counts?.completed ?? 0],
            ["At risk", counts?.atRisk ?? 0],
            ["Pending submissions", counts?.pendingSubmissions ?? 0],
            ["Awaiting mentor", counts?.pendingMentorReviews ?? 0],
          ].map(([l, v]) => (
            <div key={String(l)} className="rounded-2xl border border-border bg-card p-5">
              <div className="text-xs text-muted-foreground">{l}</div>
              <div className="mt-2 font-heading text-3xl font-bold text-brand">{v as number}</div>
            </div>
          ))}
        </div>

        {/* Teams table */}
        <h2 className="mt-16 font-heading text-2xl font-semibold">Teams</h2>
        <div className="mt-4 rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brand-lite text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Team</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-left px-4 py-3">Phase</th>
                <th className="text-left px-4 py-3">Completion</th>
                <th className="text-left px-4 py-3">Risk</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {teams.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No teams yet. Click "Seed demo data" to populate.</td></tr>
              )}
              {teams.map((t) => {
                const meta = TEAM_STATUS_META[t.status as keyof typeof TEAM_STATUS_META];
                return (
                  <tr key={t.id} className="hover:bg-brand-lite/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{t.team_name}</div>
                      <div className="text-xs text-muted-foreground">{t.college}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.city}, {t.state}</td>
                    <td className="px-4 py-3">Phase {t.current_phase}</td>
                    <td className="px-4 py-3">
                      <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-brand" style={{ width: `${t.completion_percentage}%` }} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{t.completion_percentage}%</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${t.risk_status === "at_risk" ? "text-red-600" : t.risk_status === "attention" ? "text-amber-600" : "text-emerald-600"}`}>
                        {t.risk_status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${meta?.tone ?? ""}`}>{meta?.label ?? t.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Submissions queue */}
        <h2 className="mt-16 font-heading text-2xl font-semibold">Recent submissions</h2>
        <div className="mt-4 rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brand-lite text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Team</th>
                <th className="text-left px-4 py-3">Phase</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subs.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">No submissions yet.</td></tr>
              )}
              {subs.map((s) => {
                const meta = STATUS_META[s.status as keyof typeof STATUS_META];
                return (
                  <tr key={s.id} className="hover:bg-brand-lite/50">
                    <td className="px-4 py-3 font-medium">{s.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.rp_teams?.team_name ?? "—"}</td>
                    <td className="px-4 py-3">Phase {s.phase_number}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${meta?.tone ?? ""}`}>{meta?.label ?? s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </PlatformShell>
  );
}
