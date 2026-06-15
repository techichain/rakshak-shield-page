import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Check, X, Clock } from "lucide-react";
import {
  requestMentorTeam,
  listMyMentorTeamRequests,
} from "@/lib/rakshak-platform/mentor-team-requests.functions";

type Row = {
  id: string;
  team_name: string;
  leader_email: string;
  college: string | null;
  city: string | null;
  state: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  created_team_id: string | null;
};

export function MentorCreateTeamPanel() {
  const submitFn = useServerFn(requestMentorTeam);
  const listFn = useServerFn(listMyMentorTeamRequests);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ teamName: "", leaderEmail: "", membersRaw: "", college: "", city: "", state: "" });

  async function load() {
    try {
      const data = await listFn();
      setRows(data as Row[]);
    } catch (e: any) {
      console.error(e);
    }
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const memberEmails = form.membersRaw
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      await submitFn({
        data: {
          teamName: form.teamName.trim(),
          leaderEmail: form.leaderEmail.trim(),
          college: form.college.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          memberEmails,
        },
      });
      toast.success("Request submitted. Awaiting admin approval.");
      setForm({ teamName: "", leaderEmail: "", membersRaw: "", college: "", city: "", state: "" });
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-heading text-lg font-semibold">Create a new team</div>
          <p className="text-xs text-muted-foreground mt-1">
            Submit a verified team leader's email. Admin approval is required before the team is created.
          </p>
        </div>
        <button
          onClick={() => setOpen((s) => !s)}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-brand text-brand-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New request
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2">
          <input required placeholder="Team name *" value={form.teamName}
            onChange={(e) => setForm({ ...form, teamName: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2" />
          <input required type="email" placeholder="Verified team leader email *" value={form.leaderEmail}
            onChange={(e) => setForm({ ...form, leaderEmail: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2" />
          <textarea rows={2} placeholder="Verified team member emails (optional · comma or newline)" value={form.membersRaw}
            onChange={(e) => setForm({ ...form, membersRaw: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2" />
          <input placeholder="College (optional)" value={form.college}
            onChange={(e) => setForm({ ...form, college: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2" />
          <input placeholder="City" value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="State" value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded-lg border border-border">Cancel</button>
            <button disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-brand text-brand-foreground inline-flex items-center gap-1">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit request
            </button>
          </div>
        </form>
      )}

      {rows.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Your requests</div>
          {rows.map((r) => {
            const tone =
              r.status === "approved" ? "text-emerald-600 border-emerald-200 bg-emerald-50"
              : r.status === "rejected" ? "text-red-600 border-red-200 bg-red-50"
              : "text-amber-600 border-amber-200 bg-amber-50";
            const Icon = r.status === "approved" ? Check : r.status === "rejected" ? X : Clock;
            return (
              <div key={r.id} className="rounded-lg border border-border p-3 text-sm flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{r.team_name}</div>
                  <div className="text-xs text-muted-foreground truncate">Leader: {r.leader_email}</div>
                  {r.admin_notes && (
                    <div className="mt-1 text-xs text-muted-foreground">Note: {r.admin_notes}</div>
                  )}
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${tone}`}>
                  <Icon className="h-3 w-3" /> {r.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
