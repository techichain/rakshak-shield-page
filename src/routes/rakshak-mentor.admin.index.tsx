import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  APPLICATION_STATUSES,
  STATUS_META,
  type ApplicationStatus,
} from "@/lib/mentor/constants";
import { bulkRequestFiles } from "@/lib/mentor/file-requests.functions";
import { Loader2, Mail, FileText, FileCheck2 } from "lucide-react";

export const Route = createFileRoute("/rakshak-mentor/admin/")({
  component: AdminDashboard,
});

type Application = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  state: string | null;
  country: string;
  organisation: string | null;
  designation: string | null;
  linkedin_url: string | null;
  expertise_domain: string | null;
  years_experience: number | null;
  status: ApplicationStatus;
  internal_score: number | null;
  decision_notes: string | null;
  track_data: { motivation?: string; relevant_experience?: string; application_reference?: string } | null;
  submitted_at: string;
  updated_at: string;
};

type FileRow = {
  application_id: string;
  kind: string;
  storage_bucket: string;
  storage_path: string;
};

type ReviewRow = {
  application_id: string;
  reviewer_id: string;
  score: number | null;
  notes: string | null;
  recommendation: string | null;
  created_at: string;
};

type RequestRow = {
  id: string;
  application_id: string;
  kind: "resume" | "assignment";
  status: "sent" | "fulfilled" | "expired" | "cancelled";
  sent_at: string;
  fulfilled_at: string | null;
};

type FileFilter =
  | "all"
  | "has_resume"
  | "missing_resume"
  | "has_assignment"
  | "missing_assignment"
  | "requested_resume"
  | "requested_assignment";

const FILE_FILTERS: { value: FileFilter; label: string }[] = [
  { value: "all", label: "All files" },
  { value: "has_resume", label: "✓ Has resume" },
  { value: "missing_resume", label: "✗ Missing resume" },
  { value: "has_assignment", label: "✓ Has assignment" },
  { value: "missing_assignment", label: "✗ Missing assignment" },
  { value: "requested_resume", label: "✉ Resume requested" },
  { value: "requested_assignment", label: "✉ Assignment requested" },
];

function AdminDashboard() {
  const [rows, setRows] = useState<Application[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [sending, setSending] = useState<"resume" | "assignment" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ApplicationStatus>("all");
  const [fileFilter, setFileFilter] = useState<FileFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const bulkRequest = useServerFn(bulkRequestFiles);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [apps, fs, rs, reqs] = await Promise.all([
      supabase.from("applications").select("*").eq("track", "mentor").order("submitted_at", { ascending: false }),
      supabase.from("application_files").select("application_id, kind, storage_bucket, storage_path"),
      supabase.from("application_reviews").select("application_id, reviewer_id, score, notes, recommendation, created_at").order("created_at", { ascending: false }),
      supabase.from("application_file_requests").select("id, application_id, kind, status, sent_at, fulfilled_at").order("sent_at", { ascending: false }),
    ]);
    if (apps.error) setError(apps.error.message);
    setRows((apps.data as Application[]) ?? []);
    setFiles((fs.data as FileRow[]) ?? []);
    setReviews((rs.data as ReviewRow[]) ?? []);
    setRequests((reqs.data as RequestRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filesByApp = useMemo(() => {
    const m = new Map<string, { assignment?: FileRow; cv?: FileRow }>();
    for (const f of files) {
      const cur = m.get(f.application_id) ?? {};
      if (f.kind === "assignment") cur.assignment = f;
      else if (f.kind === "cv") cur.cv = f;
      m.set(f.application_id, cur);
    }
    return m;
  }, [files]);

  // Latest request per (app, kind). Used to show status badges & filter.
  const latestRequestByApp = useMemo(() => {
    const m = new Map<string, { resume?: RequestRow; assignment?: RequestRow }>();
    for (const r of requests) {
      const cur = m.get(r.application_id) ?? {};
      if (r.kind === "resume" && !cur.resume) cur.resume = r;
      if (r.kind === "assignment" && !cur.assignment) cur.assignment = r;
      m.set(r.application_id, cur);
    }
    return m;
  }, [requests]);

  const latestReviewByApp = useMemo(() => {
    const m = new Map<string, ReviewRow>();
    for (const r of reviews) {
      if (!m.has(r.application_id)) m.set(r.application_id, r);
    }
    return m;
  }, [reviews]);

  const filtered = useMemo(() => {
    const lower = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      const fset = filesByApp.get(r.id) ?? {};
      const reqs = latestRequestByApp.get(r.id) ?? {};
      switch (fileFilter) {
        case "has_resume": if (!fset.cv) return false; break;
        case "missing_resume": if (fset.cv) return false; break;
        case "has_assignment": if (!fset.assignment) return false; break;
        case "missing_assignment": if (fset.assignment) return false; break;
        case "requested_resume": if (!reqs.resume) return false; break;
        case "requested_assignment": if (!reqs.assignment) return false; break;
      }
      if (!lower) return true;
      return (
        r.full_name.toLowerCase().includes(lower) ||
        r.email.toLowerCase().includes(lower) ||
        (r.city ?? "").toLowerCase().includes(lower) ||
        (r.organisation ?? "").toLowerCase().includes(lower) ||
        (r.expertise_domain ?? "").toLowerCase().includes(lower)
      );
    });
  }, [rows, q, statusFilter, fileFilter, filesByApp, latestRequestByApp]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: rows.length };
    for (const s of APPLICATION_STATUSES) m[s] = 0;
    for (const r of rows) m[r.status] = (m[r.status] ?? 0) + 1;
    return m;
  }, [rows]);

  // Multi-select helpers (selection is across all rows, filter only shows what's visible).
  const visibleIds = filtered.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = visibleIds.some((id) => selected.has(id));
  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  async function sendBulk(kind: "resume" | "assignment") {
    if (selected.size === 0) return;
    if (!confirm(`Email ${selected.size} applicant(s) asking them to upload their ${kind}?`)) return;
    setSending(kind);
    setError(null);
    setFlash(null);
    try {
      const res = await bulkRequest({
        data: { application_ids: Array.from(selected), kind },
      });
      setFlash(`Sent ${res.sent_count} ${kind} request${res.sent_count === 1 ? "" : "s"}.${res.failed_count ? ` ${res.failed_count} failed.` : ""}`);
      clearSelection();
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to send");
    } finally {
      setSending(null);
    }
  }

  const buildSignedUrl = async (f: FileRow | undefined): Promise<string> => {
    if (!f) return "";
    const { data } = await supabase.storage.from(f.storage_bucket).createSignedUrl(f.storage_path, 60 * 60 * 24 * 7);
    return data?.signedUrl ?? "";
  };

  const exportXLSX = async () => {
    setExporting(true);
    try {
      const data = await Promise.all(
        filtered.map(async (r) => {
          const fset = filesByApp.get(r.id) ?? {};
          const rev = latestReviewByApp.get(r.id);
          const reqs = latestRequestByApp.get(r.id) ?? {};
          const [resumeUrl, assignmentUrl] = await Promise.all([
            buildSignedUrl(fset.cv),
            buildSignedUrl(fset.assignment),
          ]);
          return {
            "Application Reference ID": r.track_data?.application_reference ?? r.id.replaceAll("-", "").slice(0, 8).toUpperCase(),
            "Application Date": new Date(r.submitted_at).toISOString(),
            "Full Name": r.full_name,
            "Email": r.email,
            "Phone": r.phone,
            "City": r.city,
            "State": r.state ?? "",
            "Country": r.country,
            "Current Organisation": r.organisation ?? "",
            "Designation": r.designation ?? "",
            "Years of Experience": r.years_experience ?? "",
            "LinkedIn URL": r.linkedin_url ?? "",
            "Primary Expertise": r.expertise_domain ?? "",
            "Motivation Statement": r.track_data?.motivation ?? "",
            "Relevant Road Safety / Mentoring Experience": r.track_data?.relevant_experience ?? "",
            "Resume URL": resumeUrl,
            "Assignment URL": assignmentUrl,
            "Resume Requested": reqs.resume ? `${reqs.resume.status} on ${new Date(reqs.resume.sent_at).toLocaleDateString()}` : "",
            "Assignment Requested": reqs.assignment ? `${reqs.assignment.status} on ${new Date(reqs.assignment.sent_at).toLocaleDateString()}` : "",
            "Application Status": STATUS_META[r.status]?.label ?? r.status,
            "Internal Score": r.internal_score ?? "",
            "Reviewer Score": rev?.score ?? "",
            "Recommendation": rev?.recommendation ?? "",
            "Reviewer Notes": rev?.notes ?? "",
            "Decision Notes": r.decision_notes ?? "",
            "Last Updated": new Date(r.updated_at).toISOString(),
          };
        }),
      );
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Applications");
      const fname = `mentor-applications-${statusFilter}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fname);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mentor Applications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {rows.length} total · {filtered.length} shown · {selected.size} selected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:border-slate-900"
          >
            Refresh
          </button>
          <button
            onClick={exportXLSX}
            disabled={exporting || filtered.length === 0}
            className="px-3 py-2 text-sm rounded-md bg-[#4A35FF] text-white hover:bg-[#3A28D9] disabled:opacity-50"
          >
            {exporting ? "Preparing…" : "Export to Excel (.xlsx)"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Metric label="Total" value={counts.all} />
        {APPLICATION_STATUSES.map((s) => (
          <Metric key={s} label={STATUS_META[s].label} value={counts[s] ?? 0} />
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <StatChip label={`All (${counts.all})`} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        {APPLICATION_STATUSES.map((s) => (
          <StatChip
            key={s}
            label={`${STATUS_META[s].label} (${counts[s] ?? 0})`}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {FILE_FILTERS.map((f) => (
          <StatChip key={f.value} label={f.label} active={fileFilter === f.value} onClick={() => setFileFilter(f.value)} />
        ))}
      </div>

      <div className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, city, org, expertise…"
          className="w-full md:max-w-md px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#4A35FF]/30 focus:border-[#4A35FF]"
        />
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}
      {flash && (
        <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3 mb-4">
          {flash}
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-[#4A35FF]/30 bg-[#4A35FF]/5 px-4 py-3 mb-4">
          <span className="text-sm font-semibold text-[#4A35FF]">
            {selected.size} selected
          </span>
          <button
            disabled={sending !== null}
            onClick={() => sendBulk("resume")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-white border border-slate-300 hover:border-[#4A35FF] disabled:opacity-50"
          >
            {sending === "resume" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            Email: request resume
          </button>
          <button
            disabled={sending !== null}
            onClick={() => sendBulk("assignment")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-white border border-slate-300 hover:border-[#4A35FF] disabled:opacity-50"
          >
            {sending === "assignment" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            Email: request assignment
          </button>
          <button
            onClick={clearSelection}
            className="ml-auto text-xs text-slate-500 hover:text-slate-900"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <Th className="w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                  onChange={toggleAllVisible}
                  aria-label="Select all visible"
                />
              </Th>
              <Th>Applicant</Th>
              <Th>Expertise</Th>
              <Th>Yrs</Th>
              <Th>Location</Th>
              <Th>Files / requests</Th>
              <Th>Status</Th>
              <Th>Score</Th>
              <Th>Submitted</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={10} className="text-center py-10 text-slate-500">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={10} className="text-center py-10 text-slate-500">No applications match.</td></tr>
            )}
            {filtered.map((r) => {
              const fset = filesByApp.get(r.id) ?? {};
              const reqs = latestRequestByApp.get(r.id) ?? {};
              return (
                <tr key={r.id} className={`hover:bg-slate-50 ${selected.has(r.id) ? "bg-[#4A35FF]/5" : ""}`}>
                  <Td>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      aria-label={`Select ${r.full_name}`}
                    />
                  </Td>
                  <Td>
                    <div className="font-semibold text-slate-900">{r.full_name}</div>
                    <div className="text-xs text-slate-500">{r.email}</div>
                    {r.organisation && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {r.organisation}{r.designation ? ` · ${r.designation}` : ""}
                      </div>
                    )}
                  </Td>
                  <Td className="text-slate-700">{r.expertise_domain ?? "—"}</Td>
                  <Td className="text-slate-700">{r.years_experience ?? "—"}</Td>
                  <Td className="text-slate-700">
                    {r.city}{r.state ? `, ${r.state}` : ""}
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1 text-xs">
                      <FileOrRequest label="Resume" file={fset.cv} req={reqs.resume} />
                      <FileOrRequest label="Assignment" file={fset.assignment} req={reqs.assignment} />
                    </div>
                  </Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td className="text-slate-700">{r.internal_score ?? "—"}</Td>
                  <Td className="text-slate-500 text-xs whitespace-nowrap">
                    {new Date(r.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </Td>
                  <Td>
                    <Link
                      to="/rakshak-mentor/admin/$id"
                      params={{ id: r.id }}
                      className="text-[#4A35FF] font-semibold hover:underline"
                    >
                      Review →
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FileOrRequest({
  label, file, req,
}: { label: string; file: FileRow | undefined; req: RequestRow | undefined }) {
  const open = async () => {
    if (!file) return;
    const { data } = await supabase.storage.from(file.storage_bucket).createSignedUrl(file.storage_path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };
  if (file) {
    return (
      <button onClick={open} className="inline-flex items-center gap-1 text-left text-[#4A35FF] hover:underline">
        <FileCheck2 className="h-3 w-3" /> {label} ↗
      </button>
    );
  }
  if (req) {
    const tone =
      req.status === "fulfilled" ? "text-emerald-700"
      : req.status === "expired" || req.status === "cancelled" ? "text-slate-400"
      : "text-amber-700";
    return (
      <span className={`inline-flex items-center gap-1 ${tone}`}>
        <Mail className="h-3 w-3" />
        {label}: {req.status} {req.status === "sent" && `· ${new Date(req.sent_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-slate-400">
      <FileText className="h-3 w-3" /> {label}: —
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left font-semibold px-4 py-3 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
function StatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-full border transition ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-700 border-slate-300 hover:border-slate-900"
      }`}
    >
      {label}
    </button>
  );
}
export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${m.bg} ${m.fg} ${m.ring}`}>
      {m.label}
    </span>
  );
}
