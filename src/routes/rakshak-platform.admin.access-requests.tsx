import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import {
  Loader2, Mail, Check, X, BellRing, UserPlus, Clock, Shield, ArrowLeft,
  GraduationCap, Briefcase, MapPin, Search, ChevronDown, ChevronRight,
  ChevronLeft, AlertCircle, CheckCircle2, MailCheck, MailX, MailWarning,
  Download, Send, AlarmClock,
} from "lucide-react";
import { toast } from "sonner";
import {
  decideRoleApproval,
  bulkDecideRoleApprovals,
  resendDecisionEmail,
} from "@/lib/rakshak-platform/admin-decide.functions";
import {
  getApprovalDetails,
  type ApprovalAuditEntry,
  type ApprovalEmailEntry,
} from "@/lib/rakshak-platform/admin-approval-details.functions";
import { AdminMentorTeamRequestsPanel } from "@/components/rakshak-platform/AdminMentorTeamRequestsPanel";
import { RolesAssignmentsPanel } from "@/components/rakshak-platform/RolesAssignmentsPanel";
import { UserCog } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/access-requests")({
  component: AccessRequestsPage,
});

type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  note: string | null;
  created_at: string;
  invited_by: string | null;
};

type ApprovalRow = {
  id: string;
  user_id: string;
  requested_role: string;
  requested_at: string;
  reviewed_at: string | null;
  status: string;
  notes: string | null;
  full_name: string | null;
  email: string | null;
};

type MentorApp = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  organization: string | null;
  designation: string | null;
  expertise: string | null;
  years_experience: number | null;
  linkedin_url: string | null;
  motivation: string | null;
  status: string;
  created_at: string;
};

type StatusFilter = "pending" | "approved" | "rejected" | "all";
type RoleFilter = "all" | "team_leader" | "mentor" | "evaluator" | "cfi_admin" | "super_admin";
type SortOrder = "newest" | "oldest";

const PAGE_SIZE = 10;

function AccessRequestsPage() {
  const navigate = useNavigate();
  const { loading, userId, isAdmin } = useRPAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [mentorApps, setMentorApps] = useState<MentorApp[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"requests" | "mentor-apps" | "team-requests" | "invites" | "roles">(() => {
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t === "roles" || t === "mentor-apps" || t === "team-requests" || t === "invites" || t === "requests") return t;
    }
    return "requests";
  });

  // Decision form state
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decidingMode, setDecidingMode] = useState<"approved" | "rejected">("approved");
  const [decisionNote, setDecisionNote] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [page, setPage] = useState(1);

  // Per-row expansion + details (audit + email)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [auditMap, setAuditMap] = useState<Record<string, ApprovalAuditEntry[]>>({});
  const [emailMap, setEmailMap] = useState<Record<string, ApprovalEmailEntry[]>>({});

  const decideFn = useServerFn(decideRoleApproval);
  const detailsFn = useServerFn(getApprovalDetails);
  const bulkDecideFn = useServerFn(bulkDecideRoleApprovals);
  const resendFn = useServerFn(resendDecisionEmail);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<"approved" | "rejected" | null>(null);
  const [bulkNote, setBulkNote] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: inv }, { data: pend }, { data: apps }] = await Promise.all([
      supabase.from("rp_role_invites")
        .select("id, email, role, status, note, created_at, invited_by")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("rp_role_approvals")
        .select("id, user_id, requested_role, requested_at, reviewed_at, status, notes")
        .order("requested_at", { ascending: false })
        .limit(500),
      supabase.from("rp_mentor_applications")
        .select("id, full_name, email, phone, city, state, organization, designation, expertise, years_experience, linkedin_url, motivation, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    setInvites((inv ?? []) as any);
    setMentorApps((apps ?? []) as any);

    const ids = Array.from(new Set((pend ?? []).map((p: any) => p.user_id)));
    let profileMap = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("rp_profiles")
        .select("id, full_name, email")
        .in("id", ids);
      profileMap = new Map((profs ?? []).map((p) => [p.id, p]));
    }
    setApprovals((pend ?? []).map((p: any) => {
      const prof = profileMap.get(p.user_id);
      return {
        id: p.id,
        user_id: p.user_id,
        requested_role: p.requested_role,
        requested_at: p.requested_at,
        reviewed_at: p.reviewed_at,
        status: p.status,
        notes: p.notes,
        full_name: prof?.full_name ?? null,
        email: prof?.email ?? null,
      };
    }));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    load();
  }, [loading, userId, isAdmin, navigate, load]);

  // Filtered + sorted approvals
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = approvals.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (roleFilter !== "all" && r.requested_role !== roleFilter) return false;
      if (q) {
        const hay = `${r.full_name ?? ""} ${r.email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    rows.sort((a, b) => {
      const da = new Date(a.requested_at).getTime();
      const db = new Date(b.requested_at).getTime();
      // Stable secondary key: id
      if (da === db) return a.id.localeCompare(b.id);
      return sort === "newest" ? db - da : da - db;
    });
    return rows;
  }, [approvals, statusFilter, roleFilter, query, sort]);

  // Reset page on filter change
  useEffect(() => { setPage(1); setSelected(new Set()); }, [statusFilter, roleFilter, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pendingOnPage = pageRows.filter((r) => r.status === "pending");
  const allPendingSelected =
    pendingOnPage.length > 0 && pendingOnPage.every((r) => selected.has(r.id));

  // Lazy fetch audit + email for decided rows currently on the page
  useEffect(() => {
    const need = pageRows
      .filter((r) => r.status !== "pending" && !(r.id in auditMap))
      .map((r) => r.id);
    if (need.length === 0) return;
    (async () => {
      try {
        const res = await detailsFn({ data: { approvalIds: need } });
        setAuditMap((prev) => ({ ...prev, ...res.audit }));
        setEmailMap((prev) => ({ ...prev, ...res.emails }));
      } catch (e) {
        console.error("Failed to load approval details", e);
      }
    })();
  }, [pageRows, auditMap, detailsFn]);

  function openDecide(row: ApprovalRow, mode: "approved" | "rejected") {
    setDecidingId(row.id);
    setDecidingMode(mode);
    setDecisionNote("");
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function togglePageSelection() {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allPendingSelected) pendingOnPage.forEach((r) => n.delete(r.id));
      else pendingOnPage.forEach((r) => n.add(r.id));
      return n;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setBulkMode(null);
    setBulkNote("");
  }

  async function confirmBulk() {
    const note = bulkNote.trim();
    if (!bulkMode) return;
    if (!note) {
      toast.error("Shared decision notes are required for bulk actions.");
      return;
    }
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      const res = await bulkDecideFn({
        data: { approvalIds: ids, decision: bulkMode, reason: note },
      });
      toast.success(
        `${bulkMode === "approved" ? "Approved" : "Rejected"} ${res.processed}/${res.total}` +
          (res.emailed ? ` · ${res.emailed} emailed` : "") +
          (res.skipped ? ` · ${res.skipped} skipped` : ""),
      );
      if (res.errors.length > 0) {
        toast.error(`${res.errors.length} failed — see console`);
        console.error("Bulk decision errors", res.errors);
      }
      // Drop stale per-row details so they reload
      setAuditMap((prev) => {
        const n = { ...prev };
        for (const id of ids) delete n[id];
        return n;
      });
      setEmailMap((prev) => {
        const n = { ...prev };
        for (const id of ids) delete n[id];
        return n;
      });
      clearSelection();
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Bulk action failed");
    } finally {
      setBulkBusy(false);
    }
  }

  async function resendEmail(row: ApprovalRow) {
    setResendBusy(row.id);
    try {
      const res = await resendFn({ data: { approvalId: row.id } });
      if (res.emailed) toast.success("Decision email re-queued");
      else toast.error(res.error ?? "Failed to resend email");
      setAuditMap((prev) => { const n = { ...prev }; delete n[row.id]; return n; });
      setEmailMap((prev) => { const n = { ...prev }; delete n[row.id]; return n; });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to resend");
    } finally {
      setResendBusy(null);
    }
  }

  function exportCsv() {
    const rows = filtered;
    if (rows.length === 0) {
      toast.error("Nothing to export with current filters.");
      return;
    }
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "Requester name",
      "Email",
      "Role",
      "Status",
      "Requested at",
      "Reviewed at",
      "Decision notes",
      "Audit timestamps",
    ];
    const lines = [header.map(escape).join(",")];
    for (const r of rows) {
      const auditTs = (auditMap[r.id] ?? [])
        .map((a) => `${a.action}@${a.created_at}`)
        .join(" | ");
      lines.push(
        [
          r.full_name ?? "",
          r.email ?? "",
          r.requested_role,
          r.status,
          r.requested_at,
          r.reviewed_at ?? "",
          r.notes ?? "",
          auditTs,
        ].map(escape).join(","),
      );
    }
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rp-access-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} request${rows.length === 1 ? "" : "s"}`);
  }

  async function confirmDecide(row: ApprovalRow) {
    const note = decisionNote.trim();
    if (!note) {
      toast.error("Decision notes are required — they will be included in the email to the requester.");
      return;
    }
    if (busy === decidingMode + row.id) return; // duplicate-click guard
    setBusy(decidingMode + row.id);
    try {
      const res = await decideFn({
        data: { approvalId: row.id, decision: decidingMode, reason: note },
      });
      toast.success(
        `${decidingMode === "approved" ? "Approved" : "Rejected"}${res.emailed ? " — requester notified by email" : ""}`,
      );
      setDecidingId(null);
      setDecisionNote("");
      setAuditMap((prev) => { const n = { ...prev }; delete n[row.id]; return n; });
      setEmailMap((prev) => { const n = { ...prev }; delete n[row.id]; return n; });
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function revokeInvite(inv: Invite) {
    if (!confirm(`Revoke invite to ${inv.email}?`)) return;
    setBusy("rv" + inv.id);
    await supabase.from("rp_role_invites")
      .update({ status: "revoked", reviewed_at: new Date().toISOString(), reviewed_by: userId })
      .eq("id", inv.id);
    toast.success("Invite revoked");
    await load();
    setBusy(null);
  }

  async function resendInvite(inv: Invite) {
    setBusy("rs" + inv.id);
    await supabase.from("rp_role_invites")
      .update({ status: "pending", reviewed_at: null })
      .eq("id", inv.id);
    toast.success(`Invite refreshed for ${inv.email}`);
    await load();
    setBusy(null);
  }

  async function approveMentorApp(app: MentorApp) {
    setBusy("ma" + app.id);
    try {
      const { error } = await supabase.from("rp_mentor_applications")
        .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: userId })
        .eq("id", app.id);
      if (error) throw error;
      await supabase.from("rp_role_invites").insert({
        email: app.email,
        role: "mentor",
        status: "pending",
        invited_by: userId,
        note: `Approved via mentor application ${app.id}`,
      });
      toast.success(`Approved ${app.full_name} — they will get mentor access on sign-in`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to approve");
    } finally {
      setBusy(null);
    }
  }

  async function rejectMentorApp(app: MentorApp) {
    if (!confirm(`Reject mentor application from ${app.full_name}?`)) return;
    setBusy("mr" + app.id);
    const { error } = await supabase.from("rp_mentor_applications")
      .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: userId })
      .eq("id", app.id);
    if (error) toast.error(error.message);
    else toast.success("Rejected");
    await load();
    setBusy(null);
  }

  if (loading || !isAdmin) {
    return <PlatformShell><Section><Loader2 className="h-5 w-5 animate-spin text-brand" /></Section></PlatformShell>;
  }

  const pendingInvites = invites.filter((i) => i.status === "pending");
  const otherInvites = invites.filter((i) => i.status !== "pending");
  const pendingMentorApps = mentorApps.filter((a) => a.status === "pending");
  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <PlatformShell>
      <Section className="!py-8 lg:!py-10">
        <Link to="/rakshak-platform/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to admin
        </Link>
        <Eyebrow>Pending approvals</Eyebrow>
        <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold tracking-tight">
          Team, mentor &amp; evaluator approvals
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Review every access request in one place — self-signup notifications, mentor applications, and email invites you have sent out.
        </p>

        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={<BellRing className="h-5 w-5" />} label="Pending role requests" value={pendingCount} tone="amber" />
          <SummaryCard icon={<GraduationCap className="h-5 w-5" />} label="Mentor applications" value={pendingMentorApps.length} tone="emerald" />
          <SummaryCard icon={<Mail className="h-5 w-5" />} label="Open invites" value={pendingInvites.length} tone="brand" />
          <SummaryCard icon={<Shield className="h-5 w-5" />} label="Total invites" value={invites.length} tone="muted" />
        </div>

        <div className="mt-8 flex items-center gap-1 border-b border-border overflow-x-auto">
          {([
            ["requests", `Role requests (${pendingCount})`, <BellRing className="h-4 w-4" key="i1" />],
            ["mentor-apps", `Mentor applications (${pendingMentorApps.length})`, <GraduationCap className="h-4 w-4" key="i3" />],
            ["team-requests", `Team creation requests`, <UserPlus className="h-4 w-4" key="i4" />],
            ["invites", `Email invites (${invites.length})`, <Mail className="h-4 w-4" key="i2" />],
            ["roles", `Roles & assignments`, <UserCog className="h-4 w-4" key="i5" />],
          ] as const).map(([id, label, icon]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  active ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {icon}{label}
              </button>
            );
          })}
        </div>

        {tab === "requests" && (
          <>
            {/* Filters */}
            <div className="mt-6 rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full rounded-full border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>
              <FilterSelect
                label="Status"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as StatusFilter)}
                options={[
                  ["pending", "Pending"],
                  ["approved", "Approved"],
                  ["rejected", "Rejected"],
                  ["all", "All"],
                ]}
              />
              <FilterSelect
                label="Role"
                value={roleFilter}
                onChange={(v) => setRoleFilter(v as RoleFilter)}
                options={[
                  ["all", "All roles"],
                  ["team_leader", "Team leader"],
                  ["mentor", "Mentor"],
                  ["evaluator", "Evaluator"],
                  ["cfi_admin", "CFI admin"],
                  ["super_admin", "Super admin"],
                ]}
              />
              <FilterSelect
                label="Sort"
                value={sort}
                onChange={(v) => setSort(v as SortOrder)}
                options={[
                  ["newest", "Newest first"],
                  ["oldest", "Oldest first"],
                ]}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {filtered.length === 0
                  ? "No matching requests."
                  : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
              </div>
              <div className="flex items-center gap-2">
                {pendingOnPage.length > 0 && (
                  <button
                    onClick={togglePageSelection}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    {allPendingSelected ? "Clear page" : "Select page (pending)"}
                  </button>
                )}
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"
                  title="Export filtered rows to CSV"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              </div>
            </div>

            {selected.size > 0 && (
              <div className="mt-3 rounded-2xl border border-brand/30 bg-brand/5 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {selected.size} selected
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => { setBulkMode("approved"); setBulkNote(""); }}
                      disabled={bulkBusy}
                      className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Bulk approve
                    </button>
                    <button
                      onClick={() => { setBulkMode("rejected"); setBulkNote(""); }}
                      disabled={bulkBusy}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Bulk reject
                    </button>
                    <button
                      onClick={clearSelection}
                      disabled={bulkBusy}
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                {bulkMode && (
                  <div className={`mt-3 rounded-xl border p-3 ${
                    bulkMode === "approved" ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60"
                  }`}>
                    <label className="block text-xs font-semibold mb-1">
                      Shared {bulkMode === "approved" ? "approval notes" : "reject reason"}{" "}
                      <span className="text-red-600">*</span>
                    </label>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      This note is saved to every selected request and included in each
                      requester's notification email.
                    </p>
                    <textarea
                      value={bulkNote}
                      onChange={(e) => setBulkNote(e.target.value)}
                      rows={3}
                      required
                      placeholder={bulkMode === "approved"
                        ? "e.g. Batch onboarding cohort — welcome aboard."
                        : "e.g. Applications outside current eligibility window."}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        onClick={() => { setBulkMode(null); setBulkNote(""); }}
                        disabled={bulkBusy}
                        className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmBulk}
                        disabled={bulkBusy || !bulkNote.trim()}
                        className={`inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
                          bulkMode === "approved" ? "bg-brand hover:bg-brand/90" : "bg-red-600 hover:bg-red-700"
                        }`}
                      >
                        {bulkBusy ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</>
                        ) : (
                          <>{bulkMode === "approved" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                          Confirm {bulkMode === "approved" ? "approve" : "reject"} {selected.size}</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 space-y-3">
              {pageRows.length === 0 ? (
                <EmptyNote
                  icon={<BellRing className="h-8 w-8 text-brand" />}
                  title="No requests match"
                  subtitle="Try clearing the search or changing the filters."
                />
              ) : (
                pageRows.map((p) => (
                  <ApprovalCard
                    key={p.id}
                    row={p}
                    busy={busy}
                    decidingId={decidingId}
                    decidingMode={decidingMode}
                    decisionNote={decisionNote}
                    setDecisionNote={setDecisionNote}
                    onOpenDecide={openDecide}
                    onCancelDecide={() => { setDecidingId(null); setDecisionNote(""); }}
                    onConfirmDecide={confirmDecide}
                    expanded={!!expanded[p.id]}
                    onToggleExpand={() =>
                      setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))
                    }
                    audit={auditMap[p.id]}
                    emails={emailMap[p.id]}
                    selected={selected.has(p.id)}
                    onToggleSelect={() => toggleSelect(p.id)}
                    onResendEmail={resendEmail}
                    resendBusy={resendBusy === p.id}
                  />
                ))
              )}
            </div>


            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <span className="text-xs text-muted-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        )}

        {tab === "mentor-apps" && (
          <div className="mt-6 space-y-3">
            {mentorApps.length === 0 ? (
              <EmptyNote icon={<GraduationCap className="h-8 w-8 text-brand" />} title="No mentor applications" subtitle="When someone applies via /rakshak-platform/mentor-apply they'll show up here." />
            ) : (
              mentorApps.map((a) => (
                <div key={a.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center shrink-0">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold">{a.full_name}</span>
                        <span className="text-xs text-muted-foreground">{a.email}</span>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {a.designation && <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />{a.designation}{a.organization ? ` · ${a.organization}` : ""}</span>}
                        {(a.city || a.state) && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[a.city, a.state].filter(Boolean).join(", ")}</span>}
                        {a.years_experience != null && <span>{a.years_experience} yr exp.</span>}
                        {a.linkedin_url && <a href={a.linkedin_url} target="_blank" rel="noreferrer" className="text-brand hover:underline">LinkedIn</a>}
                      </div>
                      {a.expertise && <div className="mt-2 text-sm"><span className="text-muted-foreground">Expertise: </span>{a.expertise}</div>}
                      {a.motivation && <div className="mt-1 text-sm italic text-muted-foreground line-clamp-3">"{a.motivation}"</div>}
                      <div className="mt-1 text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {new Date(a.created_at).toLocaleString()}
                      </div>
                    </div>
                    {a.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => approveMentorApp(a)}
                          disabled={busy === "ma" + a.id}
                          className="inline-flex items-center gap-1 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {busy === "ma" + a.id ? "Approving…" : "Approve"}
                        </button>
                        <button
                          onClick={() => rejectMentorApp(a)}
                          disabled={busy === "mr" + a.id}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "team-requests" && (
          <div className="mt-6">
            <AdminMentorTeamRequestsPanel />
          </div>
        )}



        {tab === "invites" && (
          <div className="mt-6 space-y-6">
            <InviteSection
              title="Pending invites"
              rows={pendingInvites}
              empty="No open invites. Use the + button on the admin dashboard to add Gmail IDs."
              busy={busy}
              onRevoke={revokeInvite}
              onResend={null}
            />
            <InviteSection
              title="History"
              rows={otherInvites}
              empty="No past invites yet."
              busy={busy}
              onRevoke={null}
              onResend={resendInvite}
            />
          </div>
        )}

        {tab === "roles" && <RolesAssignmentsPanel />}
      </Section>
    </PlatformShell>
  );
}

function ApprovalCard({
  row, busy, decidingId, decidingMode, decisionNote, setDecisionNote,
  onOpenDecide, onCancelDecide, onConfirmDecide,
  expanded, onToggleExpand, audit, emails,
  selected, onToggleSelect, onResendEmail, resendBusy,
}: {
  row: ApprovalRow;
  busy: string | null;
  decidingId: string | null;
  decidingMode: "approved" | "rejected";
  decisionNote: string;
  setDecisionNote: (s: string) => void;
  onOpenDecide: (r: ApprovalRow, mode: "approved" | "rejected") => void;
  onCancelDecide: () => void;
  onConfirmDecide: (r: ApprovalRow) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  audit: ApprovalAuditEntry[] | undefined;
  emails: ApprovalEmailEntry[] | undefined;
  selected: boolean;
  onToggleSelect: () => void;
  onResendEmail: (r: ApprovalRow) => void;
  resendBusy: boolean;
}) {
  const isDeciding = decidingId === row.id;
  const isPending = row.status === "pending";
  const tone =
    row.status === "approved" ? "bg-emerald-100 text-emerald-700" :
    row.status === "rejected" ? "bg-red-100 text-red-700" :
    "bg-amber-100 text-amber-700";
  const latestEmail = (emails ?? [])[0];

  // SLA / age tracking
  const ageHours = isPending
    ? Math.floor((Date.now() - new Date(row.requested_at).getTime()) / 3_600_000)
    : 0;
  const overdue = isPending && ageHours >= 48;
  const warning = isPending && ageHours >= 24 && ageHours < 48;

  return (
    <div className={`rounded-2xl border bg-card p-4 sm:p-5 shadow-sm ${
      overdue ? "border-red-300 ring-1 ring-red-200" : "border-border"
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {isPending && (
          <label className="shrink-0 inline-flex items-center pt-1">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
              aria-label="Select request for bulk action"
            />
          </label>
        )}
        <div className={`h-10 w-10 rounded-full ${tone} grid place-items-center shrink-0`}>
          <UserPlus className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm">
            <span className="font-semibold">{row.full_name ?? row.email ?? "User"}</span>{" "}
            <span className="text-muted-foreground">requested</span>{" "}
            <span className="inline-flex items-center rounded-full bg-brand/10 text-brand px-2 py-0.5 text-xs font-medium">
              {row.requested_role}
            </span>{" "}
            <span className="text-muted-foreground">access</span>
            {!isPending && <span className="ml-2"><StatusBadge status={row.status} /></span>}
            {isPending && (
              <span
                className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  overdue
                    ? "bg-red-100 text-red-700"
                    : warning
                      ? "bg-amber-100 text-amber-700"
                      : "bg-muted text-muted-foreground"
                }`}
                title={`Requested ${new Date(row.requested_at).toLocaleString()}`}
              >
                <AlarmClock className="h-3 w-3" />
                {overdue
                  ? `Overdue · pending ${ageHours}h`
                  : `Pending ${ageHours < 1 ? "<1h" : `${ageHours}h`}`}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 truncate">{row.email}</div>
          {row.notes && (
            <div className="text-xs text-muted-foreground mt-1 italic whitespace-pre-wrap">"{row.notes}"</div>
          )}
          <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> Requested {new Date(row.requested_at).toLocaleString()}
            </span>
            {row.reviewed_at && (
              <span className="inline-flex items-center gap-1">
                · Reviewed {new Date(row.reviewed_at).toLocaleString()}
              </span>
            )}
            {!isPending && latestEmail && <EmailStatusBadge entry={latestEmail} />}
            {!isPending && !latestEmail && emails !== undefined && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                <MailX className="h-3 w-3" /> No email sent
              </span>
            )}
          </div>
        </div>
        {isPending && !isDeciding && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => onOpenDecide(row, "approved")}
              disabled={busy === "approved" + row.id}
              className="inline-flex items-center gap-1 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </button>
            <button
              onClick={() => onOpenDecide(row, "rejected")}
              disabled={busy === "rejected" + row.id}
              className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Reject
            </button>
          </div>
        )}
        {!isPending && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => onResendEmail(row)}
              disabled={resendBusy}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
              title="Re-queue the decision email to the requester"
            >
              {resendBusy
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Send className="h-3.5 w-3.5" />}
              Resend email
            </button>
            <button
              onClick={onToggleExpand}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Audit log
            </button>
          </div>
        )}
      </div>


      {isDeciding && (
        <div className={`mt-4 rounded-xl border p-3 ${
          decidingMode === "approved"
            ? "border-emerald-200 bg-emerald-50/60"
            : "border-red-200 bg-red-50/60"
        }`}>
          <label className="block text-xs font-semibold mb-1">
            {decidingMode === "approved" ? "Approval notes" : "Reason for rejection"}{" "}
            <span className="text-red-600">*</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            Required — this message is included in the email sent to the requester and saved to the audit log.
          </p>
          <textarea
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            rows={3}
            required
            placeholder={
              decidingMode === "approved"
                ? "e.g. Verified your university affiliation — welcome aboard! Your portal opens immediately."
                : "e.g. We could not verify your affiliation. Please reply with your university ID and reapply."
            }
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={onCancelDecide}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirmDecide(row)}
              disabled={busy === decidingMode + row.id || !decisionNote.trim()}
              className={`inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
                decidingMode === "approved" ? "bg-brand hover:bg-brand/90" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {decidingMode === "approved" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {busy === decidingMode + row.id
                ? (decidingMode === "approved" ? "Approving…" : "Rejecting…")
                : `Confirm ${decidingMode === "approved" ? "approve" : "reject"}`}
            </button>
          </div>
        </div>
      )}

      {expanded && !isPending && (
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 space-y-3">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Email deliveries
            </div>
            {emails === undefined ? (
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            ) : emails.length === 0 ? (
              <div className="text-xs text-muted-foreground">No notification email recorded.</div>
            ) : (
              <ul className="space-y-1">
                {emails.map((em) => (
                  <li key={em.message_id ?? em.created_at} className="text-xs flex flex-wrap items-center gap-2">
                    <EmailStatusBadge entry={em} />
                    <span className="text-muted-foreground">{em.recipient_email}</span>
                    <span className="text-muted-foreground">· {new Date(em.created_at).toLocaleString()}</span>
                    {em.error_message && (
                      <span className="text-red-600 inline-flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {em.error_message}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              History
            </div>
            {audit === undefined ? (
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            ) : audit.length === 0 ? (
              <div className="text-xs text-muted-foreground">No audit entries.</div>
            ) : (
              <ol className="space-y-2 border-l-2 border-border pl-3">
                {audit.map((a) => (
                  <li key={a.id} className="text-xs">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-semibold">{prettyAction(a.action)}</span>
                      <span className="text-muted-foreground">
                        by {a.actor_name ?? a.actor_email ?? (a.actor_id ? a.actor_id.slice(0, 8) : "system")}
                      </span>
                      <span className="text-muted-foreground">· {new Date(a.created_at).toLocaleString()}</span>
                    </div>
                    {a.new_value?.notes && (
                      <div className="mt-0.5 text-muted-foreground italic whitespace-pre-wrap">"{a.new_value.notes}"</div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function prettyAction(action: string): string {
  return action
    .replace(/^role_approval_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function EmailStatusBadge({ entry }: { entry: ApprovalEmailEntry }) {
  const s = entry.status;
  let cls = "bg-muted text-muted-foreground";
  let Icon = MailWarning;
  let label = s;
  if (s === "sent") { cls = "bg-emerald-100 text-emerald-700"; Icon = MailCheck; label = "Email sent"; }
  else if (s === "pending") { cls = "bg-amber-100 text-amber-700"; Icon = Mail; label = "Email queued"; }
  else if (s === "failed" || s === "bounced" || s === "dlq") { cls = "bg-red-100 text-red-700"; Icon = MailX; label = `Email ${s}`; }
  else if (s === "suppressed") { cls = "bg-zinc-200 text-zinc-700"; Icon = MailX; label = "Email suppressed"; }
  else if (s === "complained") { cls = "bg-orange-100 text-orange-700"; Icon = MailWarning; label = "Spam complaint"; }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-brand"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

function SummaryCard({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: number; tone: "amber" | "brand" | "muted" | "emerald" }) {
  const tones = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    brand: "bg-brand/10 text-brand border-brand/20",
    muted: "bg-muted text-muted-foreground border-border",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  } as const;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl grid place-items-center border ${tones[tone]}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
}

function EmptyNote({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-brand/10 grid place-items-center">{icon}</div>
      <div className="mt-3 font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground">{subtitle}</div>
    </div>
  );
}

function InviteSection({
  title, rows, empty, busy, onRevoke, onResend,
}: {
  title: string;
  rows: Invite[];
  empty: string;
  busy: string | null;
  onRevoke: ((i: Invite) => void) | null;
  onResend: ((i: Invite) => void) | null;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h3>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
          {empty}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Sent</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-t border-border align-top">
                  <td className="p-3">
                    <div className="font-medium">{i.email}</div>
                    {i.note && <div className="text-xs text-muted-foreground italic mt-1">{i.note}</div>}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center rounded-full bg-brand/10 text-brand px-2 py-0.5 text-xs">{i.role}</span>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    {onRevoke && i.status === "pending" && (
                      <button
                        onClick={() => onRevoke(i)}
                        disabled={busy === "rv" + i.id}
                        className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    )}
                    {onResend && i.status === "revoked" && (
                      <button
                        onClick={() => onResend(i)}
                        disabled={busy === "rs" + i.id}
                        className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
                      >
                        Re-open
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "accepted" || status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
    status === "rejected" ? "bg-red-50 text-red-700 border-red-200" :
    "bg-muted text-muted-foreground border-border";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${tone}`}>{status}</span>;
}
