import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { Trash2, Plus, Search } from "lucide-react";

const ASSIGNABLE_ROLES = [
  "super_admin",
  "cfi_admin",
  "evaluator",
  "mentor",
  "authority",
  "finance",
  "leadership_viewer",
] as const;

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  roles: string[];
};

export function RolesAssignmentsPanel() {
  const { userId, roles: myRoles } = useRPAuth();
  const isSuper = myRoles.includes("super_admin");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [assignRole, setAssignRole] = useState<string>("evaluator");

  const load = useCallback(async () => {
    const { data: profs } = await supabase
      .from("rp_profiles")
      .select("id, full_name, email")
      .order("created_at", { ascending: false })
      .limit(500);
    const ids = (profs ?? []).map((p) => p.id);
    const { data: rolesData } = await supabase
      .from("rp_user_roles")
      .select("user_id, role")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const roleMap = new Map<string, string[]>();
    (rolesData ?? []).forEach((r: any) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    setRows((profs ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      roles: roleMap.get(p.id) ?? [],
    })));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function revoke(user_id: string, role: string) {
    if (!confirm(`Revoke ${role} from this user?`)) return;
    setBusy(user_id + role);
    setError(null);
    const { error } = await supabase.from("rp_user_roles").delete().eq("user_id", user_id).eq("role", role as any);
    if (error) setError(error.message); else await load();
    setBusy(null);
  }

  async function assign(user_id: string, role: string) {
    setBusy(user_id + role);
    setError(null);
    const { error } = await supabase.from("rp_user_roles").insert({ user_id, role: role as any });
    if (error && !String(error.message).includes("duplicate")) setError(error.message);
    await supabase
      .from("rp_role_approvals")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: userId })
      .eq("user_id", user_id)
      .eq("requested_role", role as any)
      .eq("status", "pending");
    setAssignFor(null);
    await load();
    setBusy(null);
  }

  const filtered = query
    ? rows.filter((r) => [r.full_name, r.email, ...r.roles].some((v) => String(v ?? "").toLowerCase().includes(query.toLowerCase())))
    : rows;

  return (
    <div className="mt-6">
      {!isSuper && (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          You can view all roles, but only super-admins can grant or revoke <strong>super_admin</strong> and <strong>cfi_admin</strong>. The database still enforces this.
        </p>
      )}

      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 h-11 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, or role…"
          className="flex-1 bg-transparent text-sm outline-none" />
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3">User</th><th className="p-3">Roles</th><th className="p-3 text-right">Assign</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No users.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="p-3">
                  <div className="font-medium">{r.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {r.roles.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                    {r.roles.map((role) => (
                      <span key={role} className="inline-flex items-center gap-1 rounded-full bg-brand/10 text-brand px-2 py-0.5 text-xs">
                        {role}
                        <button onClick={() => revoke(r.id, role)} disabled={busy === r.id + role}
                          className="hover:text-red-600" title="Revoke">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3 text-right">
                  {assignFor === r.id ? (
                    <div className="inline-flex items-center gap-2">
                      <select value={assignRole} onChange={(e) => setAssignRole(e.target.value)}
                        className="h-8 rounded-lg border border-border bg-card px-2 text-xs">
                        {ASSIGNABLE_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                      <button onClick={() => assign(r.id, assignRole)} disabled={busy === r.id + assignRole}
                        className="rounded-full bg-brand px-3 py-1 text-xs text-brand-foreground hover:bg-brand/90 disabled:opacity-50">
                        Grant
                      </button>
                      <button onClick={() => setAssignFor(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { setAssignFor(r.id); setAssignRole("evaluator"); }}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted">
                      <Plus className="h-3 w-3" /> Assign role
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
