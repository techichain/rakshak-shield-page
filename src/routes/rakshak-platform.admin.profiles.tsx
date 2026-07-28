import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { EmptyState } from "@/components/rakshak-platform/EmptyState";
import { Loader2, Download, Search, ChevronDown, ChevronRight, FileText, Users } from "lucide-react";
import {
  adminListProfiles,
  adminExportProfilesCsv,
  getProfileFileUrl,
} from "@/lib/rakshak-platform/profile.functions";

export const Route = createFileRoute("/rakshak-platform/admin/profiles")({
  ssr: false,
  component: AdminProfilesPage,
});

const ROLE_OPTIONS = [
  "team_leader", "team_member", "mentor", "evaluator",
  "cfi_admin", "super_admin", "authority", "finance", "leadership_viewer",
];

function AdminProfilesPage() {
  const navigate = useNavigate();
  const { loading, isAdmin } = useRPAuth();
  const list = useServerFn(adminListProfiles);
  const exportCsv = useServerFn(adminExportProfilesCsv);
  const fileUrl = useServerFn(getProfileFileUrl);

  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [completion, setCompletion] = useState<"" | "complete" | "incomplete">("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) { navigate({ to: "/rakshak-platform" }); return; }
    list({ data: {} })
      .then((r) => setRows(r.profiles as any[]))
      .catch((e: any) => setErr(e?.message ?? "Could not load profiles."));
  }, [loading, isAdmin, navigate, list]);

  const filtered = useMemo(() => {
    let out = rows ?? [];
    const s = q.trim().toLowerCase();
    if (s) {
      out = out.filter((p) =>
        [p.full_name, p.email, p.login_id, p.phone]
          .filter(Boolean)
          .some((v: string) => String(v).toLowerCase().includes(s)),
      );
    }
    if (role) out = out.filter((p) => (p.roles ?? []).includes(role));
    if (completion === "complete") out = out.filter((p) => p.is_complete);
    if (completion === "incomplete") out = out.filter((p) => !p.is_complete);
    return out;
  }, [rows, q, role, completion]);

  async function onExport() {
    setBusy(true);
    try {
      const { csv, count } = await exportCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rakshak-profiles-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${count} profiles`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function openCheque(path: string) {
    try {
      const { url } = await fileUrl({ data: { path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open the file");
    }
  }

  if (loading || (!rows && !err)) {
    return <PlatformShell><Section><Loader2 className="animate-spin" /></Section></PlatformShell>;
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Profiles &<br /><span className="text-brand">contact details.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Everyone on the programme, with completion status and bank details for reimbursements.
        </p>

        {err && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">{err}</p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, login ID…"
              className="h-11 w-72 rounded-xl border border-border bg-card pl-9 pr-4 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-11 rounded-xl border border-border bg-card px-4 text-sm focus:border-brand focus:outline-none"
          >
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={completion}
            onChange={(e) => setCompletion(e.target.value as any)}
            className="h-11 rounded-xl border border-border bg-card px-4 text-sm focus:border-brand focus:outline-none"
          >
            <option value="">All profiles</option>
            <option value="complete">Complete only</option>
            <option value="incomplete">Incomplete only</option>
          </select>
          <button
            onClick={onExport}
            disabled={busy}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export all profiles (CSV)
          </button>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          Showing {filtered.length} of {rows?.length ?? 0}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={Users}
              title="No profiles match"
              description="Try clearing the search or filters."
            />
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Complete</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <Fragment key={p.id}>
                    <tr
                      onClick={() => setOpenId(openId === p.id ? null : p.id)}
                      className="cursor-pointer border-t border-border hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          {openId === p.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          {p.full_name ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.email ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.phone ?? "—"}</td>
                      <td className="px-4 py-3">{p.role ?? "—"}</td>
                      <td className="px-4 py-3">{p.team_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={p.is_complete ? "text-emerald-600" : "text-amber-600"}>
                          {p.profile_completion_pct}%
                        </span>
                      </td>
                    </tr>
                    {openId === p.id && (
                      <tr className="border-t border-border bg-muted/20">
                        <td colSpan={6} className="px-4 py-5">
                          <div className="grid gap-4 md:grid-cols-3">
                            <Detail label="Blood group" value={p.blood_group} />
                            <Detail label="College" value={p.college} />
                            <Detail label="Organization" value={p.organization} />
                            <Detail label="City" value={p.city} />
                            <Detail label="State" value={p.state} />
                            <Detail label="Login ID" value={p.login_id} />
                            <div className="md:col-span-3">
                              <Detail label="Address" value={p.address} />
                            </div>
                            <Detail label="Account holder" value={p.bank_account_name} />
                            <Detail label="Account number" value={p.bank_account_number} />
                            <Detail label="IFSC" value={p.bank_ifsc} />
                            <Detail label="Branch" value={p.bank_branch} />
                            <div>
                              <span className="block text-xs uppercase tracking-wider text-muted-foreground">
                                Cancelled cheque
                              </span>
                              {p.cancelled_cheque_path ? (
                                <button
                                  onClick={() => openCheque(p.cancelled_cheque_path)}
                                  className="mt-1 inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
                                >
                                  <FileText className="h-4 w-4" /> Download
                                </button>
                              ) : (
                                <span className="mt-1 block text-sm text-muted-foreground">—</span>
                              )}
                            </div>
                            {p.missing_fields?.length > 0 && (
                              <div className="md:col-span-3 text-xs text-amber-600">
                                Missing: {p.missing_fields.join(", ")}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="block text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="mt-1 block text-sm">{value || "—"}</span>
    </div>
  );
}
