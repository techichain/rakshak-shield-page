import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  APPLICATION_STATUSES,
  STATUS_META,
  type ApplicationStatus,
} from "@/lib/mentor/constants";

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
  organisation: string | null;
  designation: string | null;
  expertise_domain: string | null;
  years_experience: number | null;
  status: ApplicationStatus;
  internal_score: number | null;
  submitted_at: string;
};

function AdminDashboard() {
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ApplicationStatus>("all");

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("applications")
      .select(
        "id, full_name, email, phone, city, state, organisation, designation, expertise_domain, years_experience, status, internal_score, submitted_at",
      )
      .eq("track", "mentor")
      .order("submitted_at", { ascending: false });
    if (error) setError(error.message);
    setRows((data as Application[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const lower = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!lower) return true;
      return (
        r.full_name.toLowerCase().includes(lower) ||
        r.email.toLowerCase().includes(lower) ||
        (r.city ?? "").toLowerCase().includes(lower) ||
        (r.organisation ?? "").toLowerCase().includes(lower) ||
        (r.expertise_domain ?? "").toLowerCase().includes(lower)
      );
    });
  }, [rows, q, statusFilter]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: rows.length };
    for (const s of APPLICATION_STATUSES) m[s] = 0;
    for (const r of rows) m[r.status] = (m[r.status] ?? 0) + 1;
    return m;
  }, [rows]);

  const exportCSV = () => {
    const headers = [
      "id","submitted_at","full_name","email","phone","city","state",
      "organisation","designation","expertise_domain","years_experience",
      "status","internal_score",
    ];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push(headers.map((h) => escape((r as never)[h])).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mentor-applications-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mentor Applications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {rows.length} total · {filtered.length} shown
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
            onClick={exportCSV}
            className="px-3 py-2 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* status chips */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
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

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <Th>Applicant</Th>
              <Th>Expertise</Th>
              <Th>Yrs</Th>
              <Th>Location</Th>
              <Th>Status</Th>
              <Th>Score</Th>
              <Th>Submitted</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={8} className="text-center py-10 text-slate-500">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-slate-500">No applications match.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left font-semibold px-4 py-3">{children}</th>;
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
