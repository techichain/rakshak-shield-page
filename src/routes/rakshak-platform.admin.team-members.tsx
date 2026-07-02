import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { toast } from "sonner";
import {
  listTeamMembers,
  addTeamMember,
  removeTeamMember,
} from "@/lib/rakshak-platform/team-members.functions";
import { Loader2, Plus, Trash2, UsersRound } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/team-members")({
  ssr: false,
  beforeLoad: async () => {
    try {
      await rpRequireRole(["cfi_admin", "super_admin"], { blockAdmin: false });
    } catch (e) {
      throw e instanceof Response ? e : redirect({ to: "/rakshak-platform/unauthorized" });
    }
  },
  component: AdminTeamMembersPage,
});

type TeamOpt = { id: string; team_name: string; college: string | null };

function AdminTeamMembersPage() {
  const [teams, setTeams] = useState<TeamOpt[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    college: "",
    department: "",
    year: "",
  });

  const listFn = useServerFn(listTeamMembers);
  const addFn = useServerFn(addTeamMember);
  const removeFn = useServerFn(removeTeamMember);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("rp_teams")
        .select("id, team_name, college")
        .order("team_name");
      setTeams((data as TeamOpt[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!teamId) {
      setMembers([]);
      return;
    }
    (async () => {
      try {
        const res = await listFn({ data: { team_id: teamId } });
        setMembers(res.members);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load members");
      }
    })();
  }, [teamId, listFn]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId) return toast.error("Pick a team first");
    if (!form.full_name.trim() || !form.email.trim()) {
      return toast.error("Name and email are required");
    }
    setBusy(true);
    try {
      const res = await addFn({
        data: {
          team_id: teamId,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          college: form.college.trim() || undefined,
          department: form.department.trim() || undefined,
          year: form.year.trim() || undefined,
        },
      });
      toast.success(
        res.invited
          ? "Member added and invite email sent"
          : "Member added and linked to existing account",
      );
      setForm({ full_name: "", email: "", phone: "", college: "", department: "", year: "" });
      const refreshed = await listFn({ data: { team_id: teamId } });
      setMembers(refreshed.members);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add member");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(memberId: string, name: string) {
    if (!confirm(`Remove ${name} from this team?`)) return;
    try {
      await removeFn({ data: { member_id: memberId } });
      toast.success("Member removed");
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    }
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Team members</Eyebrow>
        <h1 className="mt-6 font-heading text-3xl sm:text-4xl font-bold leading-tight">
          Manage <span className="text-brand">team rosters</span>
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
          Add team members to a team. They'll receive a magic-link invite by email and, once signed in, get
          a simplified read-only dashboard mapped to the same mentor and team.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Team picker + form */}
          <div className="lg:col-span-1 rounded-2xl border border-border bg-card p-6">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Team</label>
            {loading ? (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="mt-2 w-full h-11 rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">Select a team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.team_name}
                    {t.college ? ` — ${t.college}` : ""}
                  </option>
                ))}
              </select>
            )}

            <form onSubmit={handleAdd} className="mt-6 space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Full name*</label>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="mt-1 w-full h-11 rounded-lg border border-border bg-background px-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Email*</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full h-11 rounded-lg border border-border bg-background px-3 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="mt-1 w-full h-11 rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Year</label>
                  <input
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                    className="mt-1 w-full h-11 rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">College</label>
                <input
                  value={form.college}
                  onChange={(e) => setForm((f) => ({ ...f, college: e.target.value }))}
                  className="mt-1 w-full h-11 rounded-lg border border-border bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Department</label>
                <input
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  className="mt-1 w-full h-11 rounded-lg border border-border bg-background px-3 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !teamId}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add member & send invite
              </button>
            </form>
          </div>

          {/* Members list */}
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-brand" />
              <h2 className="font-heading text-xl font-semibold">
                Members {teamId ? `(${members.length})` : ""}
              </h2>
            </div>
            {!teamId ? (
              <p className="mt-4 text-sm text-muted-foreground">Pick a team on the left to view its roster.</p>
            ) : members.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Role</th>
                      <th className="py-2 pr-3">Linked</th>
                      <th className="py-2 pr-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-b border-border/60">
                        <td className="py-2 pr-3">{m.full_name}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{m.email ?? "—"}</td>
                        <td className="py-2 pr-3 capitalize">{m.role_in_team}</td>
                        <td className="py-2 pr-3">
                          {m.profile_id ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs">
                              Invite pending
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemove(m.id, m.full_name)}
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}
