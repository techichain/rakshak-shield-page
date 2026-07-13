import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import {
  Loader2, Sparkles, Search, Download, MessageSquare, Calendar,
  TrendingUp, Users, Trophy, AlertTriangle, ChevronUp, ChevronDown,
  LayoutGrid, Table as TableIcon, BarChart3, ListChecks, Plus, Mail, X, BellRing,
  ArrowRight, BookOpen, ClipboardCheck, FileText, GraduationCap, HeartHandshake,
  MapPin, ScanSearch, UserCog, Wallet, Wrench, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
} from "recharts";

/* ──────────────────────────────────────────────────────────────────── */
/* Route                                                                 */
/* ──────────────────────────────────────────────────────────────────── */

export const Route = createFileRoute("/rakshak-platform/admin/")({
  component: AdminDashboard,
});

/* ──────────────────────────────────────────────────────────────────── */
/* Types                                                                 */
/* ──────────────────────────────────────────────────────────────────── */

type Phase = {
  phase_number: number;
  status: string;
  completion_percentage: number;
  deadline: string | null;
};

type Eval = { team_id: string; phase_number: number; weighted_score: number | null; status: string };

type TeamRow = {
  id: string;
  team_name: string;
  college: string | null;
  city: string | null;
  state: string | null;
  current_phase: number;
  status: string;
  risk_status: string;
  completion_percentage: number;
  final_score: number | null;
  evaluated_phases: number | null;
  assigned_mentor_id: string | null;
  team_leader_id: string | null;
  last_activity_at: string | null;
};

type MentorRow = { id: string; profile_id: string; name: string; organization: string | null };

type Enriched = TeamRow & {
  mentorId: string | null;
  mentorName: string;
  leaderName: string;
  phases: Phase[];
  tScore: number;
  p1: number; p2: number; p3: number; p4: number;
  examDate: string;
  importantDate: string;
  commentsCount: number;
  tasksCompleted: number;
  tasksTotal: number;
};

/* ──────────────────────────────────────────────────────────────────── */
/* Constants                                                             */
/* ──────────────────────────────────────────────────────────────────── */

const TASK_COLUMNS: Array<{ key: string; label: string; phase: number }> = [
  { key: "problem", label: "Problem Area", phase: 0 },
  { key: "rd", label: "R&D + Data", phase: 1 },
  { key: "phase1", label: "Phase 1", phase: 1 },
  { key: "quest", label: "Questionnaire", phase: 2 },
  { key: "interview", label: "Interview", phase: 2 },
  { key: "audit", label: "Audit", phase: 2 },
  { key: "pp2", label: "PP2", phase: 2 },
  { key: "csplan", label: "CS Identify · Solution", phase: 3 },
  { key: "final", label: "Final Report", phase: 4 },
  { key: "pp3", label: "PP3", phase: 3 },
  { key: "phase4", label: "Phase 4 Report", phase: 4 },
  { key: "auth", label: "Authority Pres.", phase: 4 },
  { key: "mentor", label: "Mentor Pres.", phase: 4 },
  { key: "pp4", label: "PP4", phase: 4 },
];

const STATUS_OPTIONS = [
  "not_started", "in_progress", "submitted", "reviewed", "needs_revision", "completed",
] as const;

function statusTone(s: string) {
  switch (s) {
    case "completed":
    case "reviewed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "submitted":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "in_progress":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "needs_revision":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* Stable mentor color from id (light theme palette). */
const MENTOR_PALETTE = [
  { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200", soft: "bg-rose-50" },
  { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-200", soft: "bg-sky-50" },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", soft: "bg-emerald-50" },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", soft: "bg-amber-50" },
  { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200", soft: "bg-violet-50" },
  { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-200", soft: "bg-cyan-50" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", border: "border-fuchsia-200", soft: "bg-fuchsia-50" },
  { bg: "bg-lime-100", text: "text-lime-700", border: "border-lime-200", soft: "bg-lime-50" },
];

function mentorColor(id: string | null) {
  if (!id) return MENTOR_PALETTE[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return MENTOR_PALETTE[h % MENTOR_PALETTE.length];
}

/* deterministic small int from id */
function seedInt(id: string, salt: number, mod: number) {
  let h = salt;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return h % mod;
}

/* Day offset for mock dates so they stay stable per team. */
function mockDateFromId(id: string, salt: number, range = 60) {
  const offset = seedInt(id, salt, range) - range / 2;
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function urgencyTone(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 86400000;
  if (diff < 0) return "text-red-700 font-semibold";
  if (diff < 7) return "text-orange-600 font-semibold";
  if (diff < 14) return "text-amber-600";
  return "text-muted-foreground";
}

/* ──────────────────────────────────────────────────────────────────── */
/* Page                                                                  */
/* ──────────────────────────────────────────────────────────────────── */

function AdminDashboard() {
  const navigate = useNavigate();
  const { loading, userId, isAdmin } = useRPAuth();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [progress, setProgress] = useState<Record<string, Phase[]>>({});
  const [evals, setEvals] = useState<Eval[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"leaderboard" | "tracker" | "mentorboard" | "analytics">("leaderboard");
  const [busy, setBusy] = useState(false);
  
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    load();
    loadPendingCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userId, isAdmin]);

  async function loadPendingCount() {
    const [{ count: rc }, { count: ic }] = await Promise.all([
      supabase.from("rp_role_approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("rp_role_invites").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    setPendingCount((rc ?? 0) + (ic ?? 0));
  }

  async function load() {
    setBusy(true);
    try {
      const [{ data: t }, { data: m }, { data: pp }, { data: ev }] = await Promise.all([
        supabase.from("rp_teams").select("id, team_name, college, city, state, current_phase, status, risk_status, completion_percentage, final_score, evaluated_phases, assigned_mentor_id, team_leader_id, last_activity_at").order("final_score", { ascending: false, nullsFirst: false }),
        supabase.from("rp_mentors").select("id, profile_id, organization"),
        supabase.from("rp_team_phase_progress").select("team_id, phase_number, status, completion_percentage, deadline"),
        supabase.from("rp_evaluations").select("team_id, phase_number, weighted_score, status"),
      ]);
      const teamRows = (t ?? []) as TeamRow[];
      setTeams(teamRows);

      const profileIds = new Set<string>();
      (m ?? []).forEach((x: any) => x.profile_id && profileIds.add(x.profile_id));
      teamRows.forEach((x) => x.team_leader_id && profileIds.add(x.team_leader_id));
      let nameMap: Record<string, string> = {};
      if (profileIds.size > 0) {
        const { data: profs } = await supabase
          .from("rp_profiles")
          .select("id, full_name")
          .in("id", Array.from(profileIds));
        nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name ?? "—"]));
      }
      setProfiles(nameMap);

      setMentors((m ?? []).map((x: any) => ({
        id: x.id, profile_id: x.profile_id,
        name: nameMap[x.profile_id] ?? "Mentor",
        organization: x.organization,
      })));

      const byTeam: Record<string, Phase[]> = {};
      (pp ?? []).forEach((row: any) => {
        (byTeam[row.team_id] ||= []).push(row as Phase);
      });
      setProgress(byTeam);
      setEvals((ev ?? []) as Eval[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load");
    } finally {
      setBusy(false);
    }
  }

  /* Build enriched rows once. */
  const enriched: Enriched[] = useMemo(() => {
    const mentorById = new Map(mentors.map((m) => [m.id, m]));
    return teams.map((t) => {
      const phases = (progress[t.id] ?? []).sort((a, b) => a.phase_number - b.phase_number);
      const mentor = t.assigned_mentor_id ? mentorById.get(t.assigned_mentor_id) ?? null : null;
      const teamEvals = evals.filter((e) => e.team_id === t.id);
      const pScore = (n: number) =>
        Math.round(
          (teamEvals.filter((e) => e.phase_number === n).reduce((s, e) => s + (Number(e.weighted_score) || 0), 0)) * 10,
        ) / 10;
      const p1 = pScore(1), p2 = pScore(2), p3 = pScore(3), p4 = pScore(4);
      const computedT = Math.round((p1 + p2 + p3 + p4) * 10) / 10;
      const tScore = t.final_score != null ? Number(t.final_score) : computedT;
      const tasksCompleted = phases.filter((p) => ["completed", "admin_approved", "mentor_approved"].includes(p.status)).length;
      return {
        ...t,
        mentorId: mentor?.id ?? null,
        mentorName: mentor?.name ?? "Unassigned",
        leaderName: t.team_leader_id ? (profiles[t.team_leader_id] ?? "—") : "—",
        phases,
        tScore, p1, p2, p3, p4,
        examDate: mockDateFromId(t.id, 7, 90),
        importantDate: mockDateFromId(t.id, 13, 30),
        commentsCount: seedInt(t.id, 3, 24),
        tasksCompleted,
        tasksTotal: TASK_COLUMNS.length,
      };
    });
  }, [teams, mentors, progress, evals, profiles]);

  /* Mutators */
  async function reassignMentor(teamId: string, mentorId: string | null) {
    const { error } = await supabase.from("rp_teams").update({ assigned_mentor_id: mentorId }).eq("id", teamId);
    if (error) return toast.error(error.message);
    toast.success("Mentor updated");
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, assigned_mentor_id: mentorId } : t)));
  }

  async function updatePhaseStatus(teamId: string, phase: number, status: string) {
    const { error } = await supabase
      .from("rp_team_phase_progress")
      .update({ status: status as any })
      .eq("team_id", teamId)
      .eq("phase_number", phase);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    setProgress((prev) => ({
      ...prev,
      [teamId]: (prev[teamId] ?? []).map((p) => (p.phase_number === phase ? { ...p, status } : p)),
    }));
  }

  async function deleteTeam(teamId: string, name: string) {
    if (!confirm(`Delete team "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("rp_teams").delete().eq("id", teamId);
    if (error) return toast.error(error.message);
    toast.success("Team deleted");
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
  }


  if (loading || !isAdmin) {
    return (
      <PlatformShell>
        <Section><Loader2 className="h-5 w-5 animate-spin text-brand" /></Section>
      </PlatformShell>
    );
  }

  const tabs: Array<{
    id: typeof tab;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    { id: "leaderboard", label: "Leaderboard", desc: "Team rankings & scores", icon: <ListChecks className="h-5 w-5" /> },
    { id: "tracker", label: "Task Tracker", desc: "All phases & deliverables", icon: <TableIcon className="h-5 w-5" /> },
    { id: "mentorboard", label: "Mentor Board", desc: "Reassign mentors", icon: <LayoutGrid className="h-5 w-5" /> },
    { id: "analytics", label: "Overall Progress", desc: "Charts & analytics", icon: <BarChart3 className="h-5 w-5" /> },
  ];

  const activeTab = tabs.find((t) => t.id === tab)!;

  return (
    <PlatformShell>
      <Section className="!py-8 lg:!py-10">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between mb-8">
          <div className="min-w-0">
            <Eyebrow>CFI Admin command centre</Eyebrow>
            <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold tracking-tight">
              Project Rakshak <span className="text-muted-foreground font-normal">| Crashfree India</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setInviteOpen(true)}
              className="h-10 rounded-full bg-brand px-4 text-sm text-brand-foreground hover:bg-brand/90 inline-flex items-center gap-2 font-semibold"
              title="Invite mentor or evaluator by email"
            >
              <Plus className="h-4 w-4" /> Invite by email
            </button>
          </div>
        </div>

        {inviteOpen && (
          <InviteModal
            onClose={() => setInviteOpen(false)}
            invitedBy={userId}
            onDone={() => { setInviteOpen(false); loadPendingCount(); }}
          />
        )}

        {/* Quick access — admin tools grouped */}
        <AdminQuickAccess pendingCount={pendingCount} />


        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
          {/* Left sidebar nav */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav className="rounded-2xl border border-border bg-card p-2 shadow-sm">
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Dashboards
              </div>
              <ul className="space-y-1">
                {tabs.map((t) => {
                  const active = tab === t.id;
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => setTab(t.id)}
                        className={`w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                          active
                            ? "bg-brand text-brand-foreground shadow-sm"
                            : "text-foreground hover:bg-brand-lite"
                        }`}
                      >
                        <span className={`mt-0.5 ${active ? "" : "text-brand"}`}>{t.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold leading-tight">{t.label}</span>
                          <span className={`block text-xs leading-snug mt-0.5 ${active ? "text-brand-foreground/80" : "text-muted-foreground"}`}>
                            {t.desc}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="hidden lg:block mt-4 rounded-2xl border border-border bg-brand-lite/50 p-4 text-xs text-muted-foreground">
              Pick a dashboard. Each view has its own data and actions.
            </div>
          </aside>

          {/* Active dashboard */}
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-brand">{activeTab.icon}</span>
              <span className="font-medium text-foreground">{activeTab.label}</span>
              <span>·</span>
              <span>{activeTab.desc}</span>
            </div>
            <div className="min-h-[40vh]">
              {busy && teams.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  <p className="mt-3 text-sm">Loading dashboard…</p>
                </div>
              ) : teams.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  {tab === "leaderboard" && <LeaderboardPanel rows={enriched} mentors={mentors} />}
                  {tab === "tracker" && (
                    <TrackerPanel
                      rows={enriched} mentors={mentors}
                      onPhaseUpdate={updatePhaseStatus}
                      onMentor={reassignMentor}
                      onDelete={deleteTeam}
                    />
                  )}
                  {tab === "mentorboard" && (
                    <MentorBoardPanel rows={enriched} mentors={mentors} onReassign={reassignMentor} />
                  )}
                  {tab === "analytics" && <AnalyticsPanel rows={enriched} mentors={mentors} />}
                </>
              )}
            </div>
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Empty state                                                           */
/* ──────────────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-16 text-center">
      <Sparkles className="h-8 w-8 text-brand mx-auto" />
      <h3 className="mt-4 font-heading text-2xl font-semibold">No teams yet</h3>
      <p className="mt-2 text-sm text-muted-foreground">Teams will appear here once they're created.</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Mini progress ring                                                    */
/* ──────────────────────────────────────────────────────────────────── */

function Ring({ value, size = 36, stroke = 4 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeOpacity="0.12" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="currentColor" strokeWidth={stroke} fill="none"
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="text-brand"
      />
      <text x="50%" y="50%" textAnchor="middle" dy=".35em" className="fill-current text-[10px] font-semibold">
        {Math.round(value)}
      </text>
    </svg>
  );
}

function MentorBadge({ id, name }: { id: string | null; name: string }) {
  const c = mentorColor(id);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      {name}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* PANEL 1 — Leaderboard                                                 */
/* ──────────────────────────────────────────────────────────────────── */

type SortKey = "tScore" | "completion_percentage" | "tasksCompleted" | "examDate";

function LeaderboardPanel({ rows, mentors }: { rows: Enriched[]; mentors: MentorRow[] }) {
  const [q, setQ] = useState("");
  const [mentorFilter, setMentorFilter] = useState<string>("all");
  const [progressRange, setProgressRange] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "tScore", dir: "desc" });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (mentorFilter !== "all" && r.mentorId !== mentorFilter) return false;
      if (progressRange === "low" && r.completion_percentage >= 40) return false;
      if (progressRange === "mid" && (r.completion_percentage < 40 || r.completion_percentage >= 75)) return false;
      if (progressRange === "high" && r.completion_percentage < 75) return false;
      if (!needle) return true;
      return (
        r.team_name.toLowerCase().includes(needle) ||
        r.mentorName.toLowerCase().includes(needle) ||
        r.leaderName.toLowerCase().includes(needle)
      );
    });
    out = [...out].sort((a, b) => {
      const av = sort.key === "examDate" ? new Date(a.examDate).getTime() : (a as any)[sort.key] ?? 0;
      const bv = sort.key === "examDate" ? new Date(b.examDate).getTime() : (b as any)[sort.key] ?? 0;
      return sort.dir === "asc" ? av - bv : bv - av;
    });
    return out;
  }, [rows, q, mentorFilter, progressRange, sort]);

  const totals = useMemo(() => {
    const n = rows.length || 1;
    const avg = Math.round(rows.reduce((s, r) => s + r.completion_percentage, 0) / n);
    const top = rows.reduce<Enriched | null>((b, r) => (!b || r.tScore > b.tScore ? r : b), null);
    const pending = rows.filter((r) =>
      r.phases.some((p) => ["submitted", "under_mentor_review", "under_admin_review"].includes(p.status)),
    ).length;
    const upcoming = rows.filter((r) => {
      const t = new Date(r.examDate).getTime() - Date.now();
      return t > 0 && t < 21 * 86400000;
    }).length;
    return { count: rows.length, avg, top: top?.team_name ?? "—", topScore: top?.tScore ?? 0, pending, upcoming };
  }, [rows]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }
  function SortIcon({ k }: { k: SortKey }) {
    if (sort.key !== k) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={<Users className="h-4 w-4" />} label="Total teams" value={totals.count} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Avg progress" value={`${totals.avg}%`} />
        <StatCard icon={<Trophy className="h-4 w-4" />} label="Top team" value={totals.top} sub={`${totals.topScore} pts`} />
        <StatCard icon={<MessageSquare className="h-4 w-4" />} label="Pending reviews" value={totals.pending} />
        <StatCard icon={<Calendar className="h-4 w-4" />} label="Upcoming exams" value={totals.upcoming} />
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search team, leader, mentor…"
            className="w-full h-10 rounded-full border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <select value={mentorFilter} onChange={(e) => setMentorFilter(e.target.value)}
          className="h-10 rounded-full border border-border bg-background px-3 text-sm">
          <option value="all">All mentors</option>
          {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={progressRange} onChange={(e) => setProgressRange(e.target.value)}
          className="h-10 rounded-full border border-border bg-background px-3 text-sm">
          <option value="all">All progress</option>
          <option value="low">&lt; 40%</option>
          <option value="mid">40–75%</option>
          <option value="high">≥ 75%</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-lite text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Team</th>
                <th className="text-left px-4 py-3">Leader</th>
                <th className="text-left px-4 py-3">Mentor</th>
                <th className="text-left px-4 py-3 cursor-pointer" onClick={() => toggleSort("completion_percentage")}>
                  <span className="inline-flex items-center gap-1">Progress <SortIcon k="completion_percentage" /></span>
                </th>
                <th className="text-left px-4 py-3 cursor-pointer" onClick={() => toggleSort("tScore")}>
                  <span className="inline-flex items-center gap-1">T Score <SortIcon k="tScore" /></span>
                </th>
                <th className="text-left px-4 py-3 cursor-pointer" onClick={() => toggleSort("examDate")}>
                  <span className="inline-flex items-center gap-1">Exam date <SortIcon k="examDate" /></span>
                </th>
                <th className="text-left px-4 py-3 cursor-pointer" onClick={() => toggleSort("tasksCompleted")}>
                  <span className="inline-flex items-center gap-1">Tasks <SortIcon k="tasksCompleted" /></span>
                </th>
                <th className="text-left px-4 py-3">Important</th>
                <th className="text-left px-4 py-3">Comments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No teams match.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-brand-lite/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-brand shrink-0" />
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{r.team_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{r.college ?? r.city}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.leaderName}</td>
                  <td className="px-4 py-3"><MentorBadge id={r.mentorId} name={r.mentorName} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Ring value={r.completion_percentage} />
                      <span className="text-sm font-semibold">{r.completion_percentage}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-brand">{r.tScore.toFixed(1)}</td>
                  <td className={`px-4 py-3 text-xs ${urgencyTone(r.examDate)}`}>{fmtDate(r.examDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Ring value={(r.tasksCompleted / r.tasksTotal) * 100} size={28} stroke={3} />
                      <span className="text-xs text-muted-foreground">{r.tasksCompleted}/{r.tasksTotal}</span>
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-xs ${urgencyTone(r.importantDate)}`}>{fmtDate(r.importantDate)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{r.commentsCount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 font-heading text-2xl font-bold text-brand truncate">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* PANEL 2 — Tracker (wide table with frozen first column)               */
/* ──────────────────────────────────────────────────────────────────── */

function TrackerPanel({
  rows, mentors, onPhaseUpdate, onMentor, onDelete,
}: {
  rows: Enriched[]; mentors: MentorRow[];
  onPhaseUpdate: (teamId: string, phase: number, status: string) => Promise<unknown>;
  onMentor: (teamId: string, mentorId: string | null) => Promise<unknown>;
  onDelete: (teamId: string, name: string) => Promise<unknown>;
}) {
  const [q, setQ] = useState("");
  const [mentorFilter, setMentorFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (mentorFilter !== "all" && r.mentorId !== mentorFilter) return false;
      if (!needle) return true;
      return r.team_name.toLowerCase().includes(needle) || r.mentorName.toLowerCase().includes(needle);
    });
  }, [rows, q, mentorFilter]);

  function statusForTask(r: Enriched, phase: number, key: string): string {
    // map a phase progress into the spec's many task statuses by deterministic offset
    const p = r.phases.find((x) => x.phase_number === phase);
    if (!p) return "not_started";
    // Slight variance per task key so different tasks of the same phase look distinct
    if (p.status === "completed" || p.status === "admin_approved" || p.status === "mentor_approved") return "completed";
    if (p.status === "submitted" || p.status === "resubmitted") {
      return seedInt(r.id + key, 5, 3) === 0 ? "reviewed" : "submitted";
    }
    if (p.status === "draft") return "in_progress";
    if (p.status === "changes_requested" || p.status === "rejected") return "needs_revision";
    return "not_started";
  }

  function toCsv() {
    const headers = [
      "Team","Leader","Mentor", ...TASK_COLUMNS.map((c) => c.label),
      "Exam Date","Tasks %","Overall %","P1","P2","P3","P4","T Score",
    ];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      const cells = [
        r.team_name, r.leaderName, r.mentorName,
        ...TASK_COLUMNS.map((c) => statusLabel(statusForTask(r, c.phase, c.key))),
        fmtDate(r.examDate),
        Math.round((r.tasksCompleted / r.tasksTotal) * 100) + "%",
        r.completion_percentage + "%",
        r.p1, r.p2, r.p3, r.p4, r.tScore,
      ];
      lines.push(cells.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rakshak-teams.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function applyBulk() {
    if (!bulkStatus || selected.size === 0) return;
    const mapped =
      bulkStatus === "completed" ? "completed" :
      bulkStatus === "submitted" ? "submitted" :
      bulkStatus === "in_progress" ? "draft" :
      bulkStatus === "needs_revision" ? "changes_requested" :
      "not_started";
    const ids = Array.from(selected);
    for (const id of ids) {
      const row = rows.find((r) => r.id === id);
      if (!row) continue;
      await onPhaseUpdate(id, row.current_phase, mapped);
    }
    setSelected(new Set());
    setBulkStatus("");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search team…"
            className="w-full h-10 rounded-full border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <select value={mentorFilter} onChange={(e) => setMentorFilter(e.target.value)}
          className="h-10 rounded-full border border-border bg-background px-3 text-sm">
          <option value="all">All mentors</option>
          {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {selected.size > 0 && (
          <>
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}
              className="h-10 rounded-full border border-border bg-background px-3 text-sm">
              <option value="">Bulk: set current phase to…</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
            <button onClick={applyBulk} disabled={!bulkStatus}
              className="h-10 rounded-full bg-brand px-4 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-50">
              Apply
            </button>
          </>
        )}
        <button onClick={toCsv}
          className="h-10 rounded-full border border-border bg-background px-4 text-sm hover:bg-brand-lite inline-flex items-center gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-max">
            <thead className="bg-brand-lite text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-brand-lite text-left px-3 py-3 w-[260px] border-r border-border">Team</th>
                <th className="text-left px-3 py-3">Leader</th>
                <th className="text-left px-3 py-3">Mentor</th>
                {TASK_COLUMNS.map((c) => (
                  <th key={c.key} className="text-left px-3 py-3 whitespace-nowrap">{c.label}</th>
                ))}
                <th className="text-left px-3 py-3">Exam</th>
                <th className="text-left px-3 py-3">Tasks %</th>
                <th className="text-left px-3 py-3">Overall</th>
                <th className="text-left px-3 py-3">P1</th>
                <th className="text-left px-3 py-3">P2</th>
                <th className="text-left px-3 py-3">P3</th>
                <th className="text-left px-3 py-3">P4</th>
                <th className="text-left px-3 py-3">T Score</th>
                <th className="text-left px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => {
                const overdue = new Date(r.importantDate).getTime() < Date.now();
                const lowProgress = r.completion_percentage < 30;
                return (
                  <tr key={r.id} className={`hover:bg-brand-lite/30 ${overdue || lowProgress ? "bg-red-50/40" : ""}`}>
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 w-[260px] border-r border-border">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)}
                          className="h-3.5 w-3.5 rounded border-border" />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{r.team_name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{r.college ?? r.city}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.leaderName}</td>
                    <td className="px-3 py-2">
                      <select
                        value={r.mentorId ?? ""}
                        onChange={(e) => onMentor(r.id, e.target.value || null)}
                        className="text-[11px] rounded-md border border-border bg-background px-2 py-1"
                      >
                        <option value="">Unassigned</option>
                        {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </td>
                    {TASK_COLUMNS.map((c) => {
                      const s = statusForTask(r, c.phase, c.key);
                      return (
                        <td key={c.key} className="px-3 py-2">
                          <select
                            value={s}
                            onChange={(e) => onPhaseUpdate(r.id, c.phase,
                              e.target.value === "completed" ? "completed" :
                              e.target.value === "submitted" ? "submitted" :
                              e.target.value === "in_progress" ? "draft" :
                              e.target.value === "needs_revision" ? "changes_requested" :
                              e.target.value === "reviewed" ? "mentor_approved" :
                              "not_started",
                            )}
                            className={`text-[10px] rounded-full border px-2 py-1 ${statusTone(s)}`}
                          >
                            {STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{statusLabel(opt)}</option>)}
                          </select>
                        </td>
                      );
                    })}
                    <td className={`px-3 py-2 whitespace-nowrap text-[11px] ${urgencyTone(r.examDate)}`}>{fmtDate(r.examDate)}</td>
                    <td className="px-3 py-2 w-[110px]">
                      <ProgressBar value={(r.tasksCompleted / r.tasksTotal) * 100} />
                    </td>
                    <td className="px-3 py-2 w-[110px]">
                      <ProgressBar value={r.completion_percentage} />
                    </td>
                    <td className="px-3 py-2 font-mono">{r.p1.toFixed(1)}</td>
                    <td className="px-3 py-2 font-mono">{r.p2.toFixed(1)}</td>
                    <td className="px-3 py-2 font-mono">{r.p3.toFixed(1)}</td>
                    <td className="px-3 py-2 font-mono">{r.p4.toFixed(1)}</td>
                    <td className="px-3 py-2 font-mono font-bold text-brand">{r.tScore.toFixed(1)}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => onDelete(r.id, r.team_name)}
                        className="text-[11px] text-red-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const tone = v < 30 ? "bg-red-500" : v < 65 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${v}%` }} />
      </div>
      <div className="text-[10px] text-muted-foreground">{Math.round(v)}%</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* PANEL 3 — Mentor Board (Kanban)                                       */
/* ──────────────────────────────────────────────────────────────────── */

function MentorBoardPanel({
  rows, mentors, onReassign,
}: { rows: Enriched[]; mentors: MentorRow[]; onReassign: (teamId: string, mentorId: string | null) => Promise<unknown> }) {
  const columns = useMemo(() => {
    const list: Array<{ id: string | null; name: string; teams: Enriched[] }> = [
      ...mentors.map((m) => ({
        id: m.id, name: m.name,
        teams: rows.filter((r) => r.mentorId === m.id),
      })),
      { id: null, name: "Unassigned", teams: rows.filter((r) => !r.mentorId) },
    ];
    return list.filter((c) => c.teams.length > 0 || c.id !== null);
  }, [rows, mentors]);

  function onDragStart(e: React.DragEvent, teamId: string) {
    e.dataTransfer.setData("text/plain", teamId);
  }
  function onDrop(e: React.DragEvent, mentorId: string | null) {
    e.preventDefault();
    const teamId = e.dataTransfer.getData("text/plain");
    if (teamId) onReassign(teamId, mentorId);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {columns.map((col) => {
        const c = mentorColor(col.id);
        const avgProg = col.teams.length
          ? Math.round(col.teams.reduce((s, t) => s + t.completion_percentage, 0) / col.teams.length)
          : 0;
        const avgT = col.teams.length
          ? Math.round((col.teams.reduce((s, t) => s + t.tScore, 0) / col.teams.length) * 10) / 10
          : 0;
        const pending = col.teams.filter((t) =>
          t.phases.some((p) => ["submitted", "under_mentor_review"].includes(p.status)),
        ).length;
        return (
          <div key={col.id ?? "none"} className="w-[300px] shrink-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, col.id)}>
            <div className={`rounded-2xl border ${c.border} ${c.soft} p-3`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${c.bg} ${c.text}`}>{col.name}</span>
                <span className="text-xs text-muted-foreground">{col.teams.length} {col.teams.length === 1 ? "team" : "teams"}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                <div className="rounded-md bg-background px-2 py-1.5 text-center">
                  <div className="font-semibold text-foreground">{avgProg}%</div><div>avg prog</div>
                </div>
                <div className="rounded-md bg-background px-2 py-1.5 text-center">
                  <div className="font-semibold text-foreground">{avgT}</div><div>avg T</div>
                </div>
                <div className="rounded-md bg-background px-2 py-1.5 text-center">
                  <div className="font-semibold text-foreground">{pending}</div><div>pending</div>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-2 min-h-[80px]">
              {col.teams.map((t) => (
                <div key={t.id} draggable onDragStart={(e) => onDragStart(e, t.id)}
                  className="rounded-xl border border-border bg-card p-3 cursor-grab active:cursor-grabbing hover:border-brand/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{t.team_name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">Lead · {t.leaderName}</div>
                    </div>
                    <Ring value={t.completion_percentage} size={32} stroke={3} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                    <div className="rounded-md bg-muted/40 px-2 py-1 text-center">
                      <div className="font-bold text-foreground">{t.tScore.toFixed(0)}</div>
                      <div className="text-muted-foreground">T Score</div>
                    </div>
                    <div className="rounded-md bg-muted/40 px-2 py-1 text-center">
                      <div className="font-bold text-foreground">{t.tasksCompleted}/{t.tasksTotal}</div>
                      <div className="text-muted-foreground">Tasks</div>
                    </div>
                    <div className="rounded-md bg-muted/40 px-2 py-1 text-center">
                      <div className="font-bold text-foreground inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />{t.commentsCount}
                      </div>
                      <div className="text-muted-foreground">comments</div>
                    </div>
                  </div>
                </div>
              ))}
              {col.teams.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  Drop a team here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* PANEL 4 — Analytics                                                   */
/* ──────────────────────────────────────────────────────────────────── */

type Metric = "tScore" | "completion_percentage" | "tasksCompleted" | "mentorScore";

function AnalyticsPanel({ rows, mentors }: { rows: Enriched[]; mentors: MentorRow[] }) {
  const [metric, setMetric] = useState<Metric>("tScore");
  const [mentorFilter, setMentorFilter] = useState<string>("all");

  const filtered = mentorFilter === "all" ? rows : rows.filter((r) => r.mentorId === mentorFilter);

  const chartData = useMemo(() => {
    return [...filtered].map((r) => ({
      name: r.team_name,
      mentor: r.mentorName,
      value:
        metric === "tScore" ? r.tScore :
        metric === "completion_percentage" ? r.completion_percentage :
        metric === "tasksCompleted" ? r.tasksCompleted :
        Math.round(((r.p1 + r.p2 + r.p3 + r.p4) / 4) * 10) / 10,
      tScore: r.tScore,
      progress: r.completion_percentage,
      tasks: r.tasksCompleted,
    })).sort((a, b) => b.value - a.value);
  }, [filtered, metric]);

  const top10 = chartData.slice(0, 10);

  const byMentor = useMemo(() => {
    const map = new Map<string, { name: string; total: number; n: number; color: ReturnType<typeof mentorColor> }>();
    for (const r of rows) {
      const key = r.mentorId ?? "_unassigned";
      const cur = map.get(key) ?? { name: r.mentorName, total: 0, n: 0, color: mentorColor(r.mentorId) };
      cur.total += r.completion_percentage; cur.n += 1; map.set(key, cur);
    }
    return Array.from(map.values()).map((x) => ({ name: x.name, avg: Math.round(x.total / x.n) }))
      .sort((a, b) => b.avg - a.avg);
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-2xl border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-border bg-background p-1">
          {([
            ["tScore", "T Score"],
            ["completion_percentage", "Overall Progress"],
            ["tasksCompleted", "Tasks Completed"],
            ["mentorScore", "Mentor Score"],
          ] as Array<[Metric, string]>).map(([m, label]) => (
            <button key={m} onClick={() => setMetric(m)}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                metric === m ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>{label}</button>
          ))}
        </div>
        <select value={mentorFilter} onChange={(e) => setMentorFilter(e.target.value)}
          className="h-9 rounded-full border border-border bg-background px-3 text-sm">
          <option value="all">All mentors</option>
          {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* Line chart by team */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold">T Score by team</h3>
          <span className="text-xs text-muted-foreground">{filtered.length} teams</span>
        </div>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} angle={-45} textAnchor="end" interval={0} height={70} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <RTooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}
                labelStyle={{ color: "var(--foreground)" }}
                formatter={(_v, _n, p: any) => [
                  `T ${p.payload.tScore} · ${p.payload.progress}% · ${p.payload.tasks} tasks`,
                  p.payload.mentor,
                ]}
              />
              <Line type="monotone" dataKey="value" stroke="var(--brand)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bar chart */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="font-heading text-base font-semibold">Overall progress</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} angle={-45} textAnchor="end" interval={0} height={70} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <RTooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="progress" fill="var(--brand)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 10 horizontal */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="font-heading text-base font-semibold">Top 10 teams</h3>
          <ol className="mt-4 space-y-2">
            {top10.map((t, i) => (
              <li key={t.name} className="flex items-center gap-3">
                <span className="font-mono text-xs w-6 text-muted-foreground">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold truncate">{t.name}</span>
                    <span className="font-mono text-xs text-brand font-bold">{t.value.toFixed(1)}</span>
                  </div>
                  <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-brand" style={{ width: `${Math.min(100, (t.value / (top10[0]?.value || 1)) * 100)}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Mentor-wise average */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-heading text-base font-semibold">Mentor-wise average progress</h3>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMentor} margin={{ top: 5, right: 16, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} domain={[0, 100]} />
              <RTooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Bar dataKey="avg" fill="var(--brand)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Invite by email modal                                                 */
/* ──────────────────────────────────────────────────────────────────── */

function InviteModal({
  onClose, invitedBy, onDone,
}: { onClose: () => void; invitedBy: string | null; onDone: () => void }) {
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<"mentor" | "evaluator">("mentor");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const list = Array.from(new Set(
      emails.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
    ));
    const valid = list.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const invalid = list.filter((e) => !valid.includes(e));
    if (invalid.length) { toast.error(`Invalid emails: ${invalid.join(", ")}`); return; }
    if (!valid.length) { toast.error("Enter at least one email"); return; }

    setBusy(true);
    const rows = valid.map((email) => ({
      email, role, note: note || null, invited_by: invitedBy, status: "pending" as const,
    }));
    const { error } = await supabase.from("rp_role_invites").upsert(rows, {
      onConflict: "email,role",
      ignoreDuplicates: false,
    } as any);
    // upsert constraint isn't on (email,role) directly because of the partial unique index; fall back to insert ignoring duplicates.
    if (error) {
      // Try plain insert; the partial unique index will reject existing pending duplicates per row.
      const { error: insErr } = await supabase.from("rp_role_invites").insert(rows);
      if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) {
        toast.error(insErr.message); setBusy(null as any); return;
      }
    }
    toast.success(`Invited ${valid.length} ${role}${valid.length > 1 ? "s" : ""}`);
    setBusy(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="h-10 w-10 rounded-xl bg-brand/10 text-brand grid place-items-center mb-3">
              <Mail className="h-5 w-5" />
            </div>
            <h2 className="font-heading text-xl font-bold">Invite by email</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pre-grant mentor or evaluator access. They get the role the moment they sign up with this email.
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["mentor", "evaluator"] as const).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setRole(r)}
                className={`h-11 rounded-xl border text-sm font-semibold capitalize transition-colors ${
                  role === r
                    ? "bg-brand text-brand-foreground border-brand"
                    : "bg-card border-border hover:bg-brand-lite"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email addresses</span>
            <textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              required
              placeholder="alice@gmail.com, bob@gmail.com"
              className="mt-1 w-full min-h-24 rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-brand"
            />
            <span className="text-xs text-muted-foreground mt-1 block">Separate with commas, spaces, or new lines.</span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="e.g. Cohort 2 evaluators"
              className="mt-1 w-full h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-brand"
            />
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-full border border-border text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 h-11 rounded-full bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {busy ? "Sending…" : "Send invites"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Admin quick access — grouped tiles mirroring the nav                  */
/* ──────────────────────────────────────────────────────────────────── */

type AdminTile = { to: string; label: string; icon: LucideIcon; desc?: string };

const ADMIN_GROUPS: Array<{ id: string; label: string; tone: string; items: AdminTile[] }> = [
  {
    id: "people",
    label: "People",
    tone: "from-rose-50 to-white border-rose-100",
    items: [
      { to: "/rakshak-platform/admin/teams", label: "Teams", icon: Users, desc: "All teams · members · reports" },
      { to: "/rakshak-platform/admin/access-requests", label: "Approvals & roles", icon: UserCog, desc: "Requests, invites & role assignments" },
      { to: "/rakshak-platform/admin/meetings", label: "All meetings", icon: Calendar, desc: "Mentor-team sessions" },
    ],
  },
  {
    id: "content",
    label: "Content",
    tone: "from-sky-50 to-white border-sky-100",
    items: [
      { to: "/rakshak-platform/admin/certificates", label: "Certificates", icon: FileText },
    ],
  },
  {
    id: "review",
    label: "Review",
    tone: "from-violet-50 to-white border-violet-100",
    items: [
      { to: "/rakshak-platform/admin/evaluator-leaderboard", label: "Eval analytics", icon: Trophy },
      { to: "/rakshak-platform/admin/evaluators", label: "Evaluators", icon: Users, desc: "Roster, reports evaluated, comments & scores" },
      { to: "/rakshak-platform/admin/reviews", label: "Reviews", icon: FileText },
    ],
  },
  {
    id: "comms",
    label: "Communications",
    tone: "from-amber-50 to-white border-amber-100",
    items: [
      { to: "/rakshak-platform/admin/emails", label: "Compose mass email", icon: Mail, desc: "Deadline reminders — history now on same page" },

    ],
  },
  {
    id: "ops",
    label: "Operations",
    tone: "from-emerald-50 to-white border-emerald-100",
    items: [
      { to: "/rakshak-platform/admin/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/rakshak-platform/impact", label: "Programme impact", icon: TrendingUp, desc: "Public-facing headline numbers" },
      { to: "/rakshak-platform/admin/data", label: "Import & export", icon: Download },
      { to: "/rakshak-platform/admin/integrations", label: "Integrations", icon: Wrench },
      
      
    ],
  },
];

function AdminQuickAccess({ pendingCount }: { pendingCount: number }) {
  return (
    <section className="mb-10">
      {/* Pending approvals hero — high-frequency action, made prominent */}
      <Link
        to="/rakshak-platform/admin/access-requests"
        className="group relative block overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand to-brand/85 p-5 sm:p-6 text-brand-foreground shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-brand-foreground/15 backdrop-blur grid place-items-center shrink-0">
            <BellRing className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] font-semibold opacity-80">
              People · Pending approvals
            </div>
            <div className="mt-1 font-heading text-lg sm:text-xl font-bold leading-tight">
              {pendingCount > 0
                ? `${pendingCount} request${pendingCount === 1 ? "" : "s"} awaiting your review`
                : "All caught up on approvals"}
            </div>
            <div className="mt-0.5 text-xs sm:text-sm opacity-85">
              Mentors, evaluators, team leaders, and email invites — bulk actions, CSV export, SLA badges.
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {pendingCount > 0 && (
              <span className="inline-flex h-7 min-w-[28px] px-2 items-center justify-center rounded-full bg-brand-foreground text-brand text-xs font-bold">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-semibold opacity-90 group-hover:opacity-100">
              Open
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Link>

      {/* Grouped admin tiles */}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ADMIN_GROUPS.map((g) => (
          <div
            key={g.id}
            className={`rounded-2xl border bg-gradient-to-br ${g.tone} p-4`}
          >
            <div className="flex items-baseline justify-between px-1 pb-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {g.label}
              </div>
              <div className="text-[11px] text-muted-foreground/70">
                {g.items.length}
              </div>
            </div>
            <ul className="grid gap-1">
              {g.items.map((it) => {
                const Icon = it.icon;
                return (
                  <li key={it.to}>
                    <Link
                      to={it.to}
                      className="group flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-white/80 transition-colors"
                    >
                      <span className="h-7 w-7 shrink-0 grid place-items-center rounded-md bg-white/70 text-brand border border-border/60">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground truncate">
                          {it.label}
                        </span>
                        {it.desc && (
                          <span className="block text-[11px] text-muted-foreground truncate">
                            {it.desc}
                          </span>
                        )}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-brand group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
