import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getAnalyticsSettings, updateAnalyticsSettings,
} from "@/lib/rakshak-platform/analytics-settings.functions";


export const Route = createFileRoute("/rakshak-platform/admin/analytics")({
  component: AnalyticsPage,
});

const BRAND = ["#1f4ed8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
const PHASE_COLORS: Record<number, string> = {
  0: "#94a3b8",
  1: "#1f4ed8",
  2: "#10b981",
  3: "#f59e0b",
  4: "#8b5cf6",
};


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

  const loadSettings = useServerFn(getAnalyticsSettings);
  const saveSettings = useServerFn(updateAnalyticsSettings);
  const [hazardStates, setHazardStates] = useState<string[] | null>(null);
  const [hazardSeverities, setHazardSeverities] = useState<string[] | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (loading || !isAdmin) return;
    loadSettings({})
      .then((s: any) => {
        setHazardStates(s?.hazard_states ?? null);
        setHazardSeverities(s?.hazard_severities ?? null);
      })
      .catch(() => { /* keep defaults (null = show all) */ });
  }, [loading, isAdmin, loadSettings]);


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

  const statusDist = useMemo(() => {
    const m: Record<string, { value: number; teamNames: string[] }> = {};
    for (const t of teams) {
      const k = t.status ?? "unknown";
      if (!m[k]) m[k] = { value: 0, teamNames: [] };
      m[k].value += 1;
      if (t.team_name) m[k].teamNames.push(t.team_name);
    }
    return Object.entries(m).map(([name, { value, teamNames }]) => ({ name, value, teamNames }));
  }, [teams]);

  // ---- Submissions per week, broken down by phase ----
  const subsByWeek = useMemo(() => {
    const weekMap = new Map<string, Record<string, number | string>>();
    for (const s of subs) {
      const d = new Date(s.submitted_at ?? s.created_at);
      const year = d.getFullYear();
      const week = Math.ceil(((d.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + new Date(year, 0, 1).getDay() + 1) / 7);
      const key = `${year}-W${String(week).padStart(2, "0")}`;
      if (!weekMap.has(key)) weekMap.set(key, { name: key, phase0: 0, phase1: 0, phase2: 0, phase3: 0, phase4: 0 });
      const row = weekMap.get(key)!;
      const p = Number(s.phase_number ?? 0);
      const bucket = `phase${p >= 0 && p <= 4 ? p : 0}`;
      row[bucket] = (Number(row[bucket]) || 0) + 1;
    }
    return [...weekMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([, v]) => v);
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

  const allStates = useMemo(() => {
    const s = new Set<string>();
    for (const l of locs) if (l.state) s.add(l.state);
    return Array.from(s).sort();
  }, [locs]);

  const hazardByState = useMemo(() => {
    const stateFilter = hazardStates && hazardStates.length > 0 ? new Set(hazardStates) : null;
    const sevFilter = hazardSeverities && hazardSeverities.length > 0 ? new Set(hazardSeverities) : null;
    const m: Record<string, { state: string; critical: number; high: number; medium: number; low: number }> = {};
    for (const l of locs) {
      const k = l.state ?? "Unknown";
      if (stateFilter && !stateFilter.has(k)) continue;
      const sev = (l.severity ?? "low") as "critical" | "high" | "medium" | "low";
      if (sevFilter && !sevFilter.has(sev)) continue;
      if (!m[k]) m[k] = { state: k, critical: 0, high: 0, medium: 0, low: 0 };
      m[k][sev] = (m[k][sev] ?? 0) + 1;
    }
    return Object.values(m).sort((a, b) => (b.critical + b.high) - (a.critical + a.high)).slice(0, 10);
  }, [locs, hazardStates, hazardSeverities]);

  function toggleState(s: string) {
    setHazardStates((prev) => {
      const cur = prev ?? allStates;
      return cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
    });
  }
  function toggleSeverity(s: string) {
    const all = ["low", "medium", "high", "critical"];
    setHazardSeverities((prev) => {
      const cur = prev ?? all;
      return cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
    });
  }
  async function persistSettings() {
    setSavingSettings(true);
    try {
      await saveSettings({ data: { hazard_states: hazardStates, hazard_severities: hazardSeverities } });
      toast.success("Analytics settings saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSavingSettings(false);
    }
  }
  function resetSettings() {
    setHazardStates(null);
    setHazardSeverities(null);
  }


  // ---- Teams overview (per-team bar chart, click-through to detail) ----
  const teamsOverview = useMemo(() => {
    return teams
      .map((t) => {
        const score = Number(t.final_score ?? 0);
        const completion = Number(t.completion_percentage ?? 0);
        const value = completion > 0 ? completion : score;
        return {
          id: t.id ?? null,
          team_name: t.team_name ?? "Unnamed team",
          college: t.college ?? "—",
          current_phase: t.current_phase ?? 0,
          status: t.status ?? "unknown",
          score: Math.round(score * 10) / 10,
          completion,
          value: Math.round(value * 10) / 10,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 40);
  }, [teams]);

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

  const goToTeam = (id: string | null | undefined) => {
    if (!id) return;
    navigate({ to: "/rakshak-platform/admin/teams/$teamId", params: { teamId: id } });
  };

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
          <Card title="Teams overview (click a bar for details)" wide>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={teamsOverview} margin={{ bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="team_name"
                  fontSize={10}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={70}
                />
                <YAxis fontSize={12} domain={[0, 100]} />
                <Tooltip content={<TeamTooltip />} />
                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  onClick={(payload: any) => goToTeam(payload?.id)}
                  style={{ cursor: "pointer" }}
                >
                  {teamsOverview.map((t, i) => (
                    <Cell
                      key={i}
                      fill={PHASE_COLORS[t.current_phase] ?? "#94a3b8"}
                      cursor={t.id ? "pointer" : "default"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <PhaseLegend />
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

          <Card title="Team status mix">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {statusDist.map((_, i) => <Cell key={i} fill={BRAND[i % BRAND.length]} />)}
                </Pie>
                <Tooltip content={<StatusTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Submissions per week by phase (last 12)" wide>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={subsByWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="phase0" name="Phase 0" stackId="w" fill={PHASE_COLORS[0]} />
                <Bar dataKey="phase1" name="Phase 1" stackId="w" fill={PHASE_COLORS[1]} />
                <Bar dataKey="phase2" name="Phase 2" stackId="w" fill={PHASE_COLORS[2]} />
                <Bar dataKey="phase3" name="Phase 3" stackId="w" fill={PHASE_COLORS[3]} />
                <Bar dataKey="phase4" name="Phase 4" stackId="w" fill={PHASE_COLORS[4]} />
              </BarChart>
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

          <Card
            title="Hazards by state (severity)"
            wide
            action={
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" /> Configure
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 max-h-96 overflow-auto" align="end">
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-semibold mb-2">Severities</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(["low", "medium", "high", "critical"] as const).map((s) => {
                          const active = hazardSeverities === null || hazardSeverities.length === 0
                            ? true
                            : hazardSeverities.includes(s);
                          return (
                            <label key={s} className="flex items-center gap-2 text-xs capitalize">
                              <Checkbox checked={active} onCheckedChange={() => toggleSeverity(s)} />
                              {s}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold mb-2">States</div>
                      {allStates.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No state data available.</p>
                      ) : (
                        <div className="grid gap-1.5 max-h-48 overflow-auto">
                          {allStates.map((st) => {
                            const active = hazardStates === null || hazardStates.length === 0
                              ? true
                              : hazardStates.includes(st);
                            return (
                              <label key={st} className="flex items-center gap-2 text-xs">
                                <Checkbox checked={active} onCheckedChange={() => toggleState(st)} />
                                {st}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <Button variant="ghost" size="sm" onClick={resetSettings} className="h-8">Reset (all)</Button>
                      <Button size="sm" onClick={persistSettings} disabled={savingSettings} className="h-8">
                        {savingSettings && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                        Save
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            }
          >
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

function TeamTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const t = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-lg">
      <div className="font-semibold text-sm">{t.team_name}</div>
      <div className="text-muted-foreground">{t.college}</div>
      <div className="mt-1">Phase: <span className="font-medium">{t.current_phase}</span></div>
      <div>Status: <span className="font-medium">{t.status}</span></div>
      <div>Completion: <span className="font-medium">{t.completion}%</span></div>
      <div>Score: <span className="font-medium">{t.score}</span></div>
      {t.id ? (
        <div className="mt-1 text-brand">Click to open team →</div>
      ) : (
        <div className="mt-1 text-muted-foreground italic">Sample data</div>
      )}
    </div>
  );
}

function StatusTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const names: string[] = d.teamNames ?? [];
  const shown = names.slice(0, 8).join(", ");
  const extra = names.length > 8 ? ` +${names.length - 8} more` : "";
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-lg max-w-xs">
      <div className="font-semibold text-sm capitalize">{d.name}</div>
      <div>Teams: <span className="font-medium">{d.value}</span></div>
      {names.length > 0 && (
        <div className="mt-1 text-muted-foreground break-words">{shown}{extra}</div>
      )}
    </div>
  );
}

function PhaseLegend() {
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
      {[0, 1, 2, 3, 4].map((p) => (
        <div key={p} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: PHASE_COLORS[p] }} />
          Phase {p}
        </div>
      ))}
    </div>
  );
}

function Card({ title, children, wide, action }: { title: string; children: React.ReactNode; wide?: boolean; action?: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="font-heading text-lg font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

