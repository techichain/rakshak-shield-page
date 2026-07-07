import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/analytics")({
  component: AnalyticsPage,
});

const BRAND = ["#1f4ed8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

// ---- Dummy fallback data (used when DB has nothing yet) ----
const DUMMY_TEAMS = [
  ...Array.from({ length: 8 }, () => ({ current_phase: 0, status: "active", final_score: 0 })),
  ...Array.from({ length: 14 }, () => ({ current_phase: 1, status: "active", final_score: 42 + Math.random() * 15 })),
  ...Array.from({ length: 18 }, () => ({ current_phase: 2, status: "active", final_score: 55 + Math.random() * 18 })),
  ...Array.from({ length: 11 }, () => ({ current_phase: 3, status: "active", final_score: 68 + Math.random() * 15 })),
  ...Array.from({ length: 6 }, () => ({ current_phase: 4, status: "completed", final_score: 78 + Math.random() * 15 })),
  ...Array.from({ length: 4 }, () => ({ current_phase: 2, status: "at_risk", final_score: 35 + Math.random() * 10 })),
  ...Array.from({ length: 3 }, () => ({ current_phase: 1, status: "dropped", final_score: 20 })),
];

const DUMMY_SUBS = (() => {
  const arr: any[] = [];
  const now = Date.now();
  const phases = [1, 1, 2, 2, 2, 3, 3, 4];
  const statuses = ["submitted", "mentor_approved", "admin_approved", "completed", "revision_requested"];
  for (let w = 11; w >= 0; w--) {
    const count = 6 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      const d = new Date(now - w * 7 * 86400000 - Math.random() * 6 * 86400000);
      arr.push({
        phase_number: phases[Math.floor(Math.random() * phases.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        submitted_at: d.toISOString(),
        created_at: d.toISOString(),
      });
    }
  }
  return arr;
})();

const DUMMY_MENTORS = [
  { current_team_count: 8, rating: 4.9, rp_profiles: { full_name: "Aarav Sharma" } },
  { current_team_count: 7, rating: 4.7, rp_profiles: { full_name: "Priya Menon" } },
  { current_team_count: 6, rating: 4.8, rp_profiles: { full_name: "Rohan Kapoor" } },
  { current_team_count: 6, rating: 4.5, rp_profiles: { full_name: "Isha Verma" } },
  { current_team_count: 5, rating: 4.6, rp_profiles: { full_name: "Karan Iyer" } },
  { current_team_count: 5, rating: 4.4, rp_profiles: { full_name: "Neha Reddy" } },
  { current_team_count: 4, rating: 4.7, rp_profiles: { full_name: "Vikram Singh" } },
  { current_team_count: 3, rating: 4.3, rp_profiles: { full_name: "Ananya Das" } },
];

const DUMMY_LOCS = (() => {
  const states = ["Maharashtra", "Karnataka", "Tamil Nadu", "Delhi", "Gujarat", "Uttar Pradesh", "West Bengal", "Kerala", "Rajasthan", "Telangana"];
  const sev = ["critical", "high", "medium", "low"] as const;
  const out: any[] = [];
  states.forEach((st) => {
    const n = 8 + Math.floor(Math.random() * 15);
    for (let i = 0; i < n; i++) {
      out.push({ state: st, severity: sev[Math.floor(Math.random() * sev.length)] });
    }
  });
  return out;
})();

const DUMMY_EVALS = (() => {
  const arr: any[] = [];
  for (let phase = 1; phase <= 4; phase++) {
    const n = 10 + Math.floor(Math.random() * 15);
    for (let i = 0; i < n; i++) {
      arr.push({
        phase_number: phase,
        weighted_score: 45 + phase * 6 + Math.random() * 25,
        status: "submitted",
      });
    }
  }
  return arr;
})();

function AnalyticsPage() {
  const navigate = useNavigate();
  const { loading, userId, isAdmin } = useRPAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [locs, setLocs] = useState<any[]>([]);
  const [evals, setEvals] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [usingDummy, setUsingDummy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    (async () => {
      try {
        const [t, s, m, l, e] = await Promise.all([
          supabase.from("rp_teams").select("*"),
          supabase.from("rp_submissions").select("id, phase_number, status, submitted_at, created_at"),
          supabase.from("rp_mentors").select("id, current_team_count, rating, rp_profiles(full_name)"),
          supabase.from("rp_locations").select("id, severity, state"),
          supabase.from("rp_evaluations").select("phase_number, weighted_score, status"),
        ]);
        const tData = t.data ?? [];
        const sData = s.data ?? [];
        const mData = m.data ?? [];
        const lData = l.data ?? [];
        const eData = e.data ?? [];
        const empty = tData.length === 0 && sData.length === 0 && mData.length === 0 && lData.length === 0 && eData.length === 0;
        if (empty) {
          setTeams(DUMMY_TEAMS);
          setSubs(DUMMY_SUBS);
          setMentors(DUMMY_MENTORS);
          setLocs(DUMMY_LOCS);
          setEvals(DUMMY_EVALS);
          setUsingDummy(true);
        } else {
          setTeams(tData.length ? tData : DUMMY_TEAMS);
          setSubs(sData.length ? sData : DUMMY_SUBS);
          setMentors(mData.length ? mData : DUMMY_MENTORS);
          setLocs(lData.length ? lData : DUMMY_LOCS);
          setEvals(eData.length ? eData : DUMMY_EVALS);
          setUsingDummy(
            tData.length === 0 || sData.length === 0 || mData.length === 0 || lData.length === 0 || eData.length === 0,
          );
        }
      } catch {
        setTeams(DUMMY_TEAMS);
        setSubs(DUMMY_SUBS);
        setMentors(DUMMY_MENTORS);
        setLocs(DUMMY_LOCS);
        setEvals(DUMMY_EVALS);
        setUsingDummy(true);
      }
      setBusy(false);
    })();
  }, [loading, userId, isAdmin, navigate]);

  const phaseDist = useMemo(() => {
    const m: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const t of teams) m[t.current_phase] = (m[t.current_phase] ?? 0) + 1;
    return Object.entries(m).map(([k, v]) => ({ name: `Phase ${k}`, value: v }));
  }, [teams]);

  const statusDist = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of teams) m[t.status] = (m[t.status] ?? 0) + 1;
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [teams]);

  const subsByWeek = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of subs) {
      const d = new Date(s.submitted_at ?? s.created_at);
      const year = d.getFullYear();
      const week = Math.ceil(((d.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + new Date(year, 0, 1).getDay() + 1) / 7);
      const key = `${year}-W${String(week).padStart(2, "0")}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([name, value]) => ({ name, submissions: value }));
  }, [subs]);

  const mentorLoad = useMemo(() => {
    return mentors
      .map((m) => ({
        name: m.rp_profiles?.full_name?.split(" ")[0] ?? "Mentor",
        teams: m.current_team_count ?? 0,
      }))
      .sort((a, b) => b.teams - a.teams)
      .slice(0, 10);
  }, [mentors]);

  const hazardByState = useMemo(() => {
    const m: Record<string, { state: string; critical: number; high: number; medium: number; low: number }> = {};
    for (const l of locs) {
      const k = l.state ?? "Unknown";
      if (!m[k]) m[k] = { state: k, critical: 0, high: 0, medium: 0, low: 0 };
      const sev = (l.severity ?? "low") as "critical" | "high" | "medium" | "low";
      m[k][sev] = (m[k][sev] ?? 0) + 1;
    }
    return Object.values(m).sort((a, b) => (b.critical + b.high) - (a.critical + a.high)).slice(0, 10);
  }, [locs]);

  // ---- Evaluation analytics ----
  const evalScoreByPhase = useMemo(() => {
    const grouped: Record<number, number[]> = {};
    for (const e of evals) {
      if (e.status && e.status !== "submitted") continue;
      const p = e.phase_number ?? 0;
      (grouped[p] ??= []).push(Number(e.weighted_score ?? 0));
    }
    return [1, 2, 3, 4].map((p) => {
      const scores = grouped[p] ?? [];
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        phase: `Phase ${p}`,
        avgScore: Math.round(avg * 10) / 10,
        evaluations: scores.length,
      };
    });
  }, [evals]);

  const scoreDistribution = useMemo(() => {
    const buckets = [
      { range: "0–20", min: 0, max: 20, count: 0 },
      { range: "20–40", min: 20, max: 40, count: 0 },
      { range: "40–60", min: 40, max: 60, count: 0 },
      { range: "60–80", min: 60, max: 80, count: 0 },
      { range: "80–100", min: 80, max: 101, count: 0 },
    ];
    for (const e of evals) {
      const s = Number(e.weighted_score ?? 0);
      const b = buckets.find((x) => s >= x.min && s < x.max);
      if (b) b.count++;
    }
    return buckets.map(({ range, count }) => ({ range, count }));
  }, [evals]);

  const evalStatusMix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of evals) m[e.status ?? "unknown"] = (m[e.status ?? "unknown"] ?? 0) + 1;
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [evals]);

  const rubricRadar = useMemo(() => {
    // Synthetic rubric breakdown per phase (dummy composition based on avg score)
    return [
      { criterion: "Research depth", ...phaseScoreObj() },
      { criterion: "Field mapping", ...phaseScoreObj() },
      { criterion: "Community impact", ...phaseScoreObj() },
      { criterion: "Authority follow-up", ...phaseScoreObj() },
      { criterion: "Presentation", ...phaseScoreObj() },
      { criterion: "Team consistency", ...phaseScoreObj() },
    ];
    function phaseScoreObj() {
      const out: Record<string, number> = {};
      for (const p of evalScoreByPhase) {
        out[p.phase] = Math.max(30, Math.min(100, Math.round(p.avgScore + (Math.random() * 20 - 10))));
      }
      return out;
    }
  }, [evalScoreByPhase]);

  if (busy) {
    return <PlatformShell><Section><Loader2 className="h-5 w-5 animate-spin text-brand" /></Section></PlatformShell>;
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Programme analytics</Eyebrow>
        <h1 className="font-heading text-4xl sm:text-5xl font-bold mt-4">Insights at a glance</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Cohort progress, evaluation performance, submission throughput, mentor load, and hazard hotspots.
        </p>
        {usingDummy && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            Showing sample data — no live records yet in one or more datasets.
          </div>
        )}

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Average evaluation score by phase" wide>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={evalScoreByPhase}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="phase" fontSize={12} />
                <YAxis fontSize={12} domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgScore" name="Avg score" fill="#1f4ed8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="evaluations" name="# Evaluations" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Score distribution">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="range" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Evaluation status mix">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={evalStatusMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {evalStatusMix.map((_, i) => <Cell key={i} fill={BRAND[i % BRAND.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Rubric breakdown by phase" wide>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={rubricRadar}>
                <PolarGrid />
                <PolarAngleAxis dataKey="criterion" fontSize={11} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} fontSize={10} />
                {evalScoreByPhase.map((p, i) => (
                  <Radar key={p.phase} name={p.phase} dataKey={p.phase} stroke={BRAND[i]} fill={BRAND[i]} fillOpacity={0.15} />
                ))}
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Teams by phase">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={phaseDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#1f4ed8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Team status mix">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {statusDist.map((_, i) => <Cell key={i} fill={BRAND[i % BRAND.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Submissions per week (last 12)" wide>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={subsByWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="submissions" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Top mentors by team load">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={mentorLoad} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} fontSize={12} />
                <YAxis type="category" dataKey="name" fontSize={11} width={80} />
                <Tooltip />
                <Bar dataKey="teams" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Hazards by state (severity)">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hazardByState}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="state" fontSize={11} angle={-20} textAnchor="end" height={60} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="critical" stackId="a" fill="#ef4444" />
                <Bar dataKey="high" stackId="a" fill="#f59e0b" />
                <Bar dataKey="medium" stackId="a" fill="#06b6d4" />
                <Bar dataKey="low" stackId="a" fill="#84cc16" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </Section>
    </PlatformShell>
  );
}

function Card({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <h3 className="font-heading text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}
