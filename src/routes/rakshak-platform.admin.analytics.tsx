import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/analytics")({
  component: AnalyticsPage,
});

const BRAND = ["#1f4ed8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function AnalyticsPage() {
  const navigate = useNavigate();
  const { loading, userId, isAdmin } = useRPAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [locs, setLocs] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    (async () => {
      const [t, s, m, l] = await Promise.all([
        supabase.from("rp_teams").select("*"),
        supabase.from("rp_submissions").select("id, phase_number, status, submitted_at, created_at"),
        supabase.from("rp_mentors").select("id, current_team_count, rating, rp_profiles(full_name)"),
        supabase.from("rp_locations").select("id, severity, state"),
      ]);
      setTeams(t.data ?? []);
      setSubs(s.data ?? []);
      setMentors(m.data ?? []);
      setLocs(l.data ?? []);
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

  if (busy) {
    return <PlatformShell><Section><Loader2 className="h-5 w-5 animate-spin text-brand" /></Section></PlatformShell>;
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Programme analytics</Eyebrow>
        <h1 className="font-heading text-4xl sm:text-5xl font-bold mt-4">Insights at a glance</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Cohort progress, submission throughput, mentor load, and hazard hotspots — all live from the database.
        </p>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
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
