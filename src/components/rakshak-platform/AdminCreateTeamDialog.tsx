import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, X, Users } from "lucide-react";
import { adminCreateTeamDirect } from "@/lib/rakshak-platform/mentor-team-requests.functions";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (teamId: string) => void;
};

export function AdminCreateTeamDialog({ open, onClose, onCreated }: Props) {
  const submit = useServerFn(adminCreateTeamDirect);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    teamName: "",
    leaderEmail: "",
    membersRaw: "",
    mentorEmail: "",
    college: "",
    city: "",
    state: "",
  });

  if (!open) return null;

  function parseEmails(raw: string): string[] {
    return raw
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await submit({
        data: {
          teamName: form.teamName.trim(),
          leaderEmail: form.leaderEmail.trim().toLowerCase(),
          memberEmails: parseEmails(form.membersRaw),
          mentorEmail: form.mentorEmail.trim().toLowerCase() || undefined,
          college: form.college.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
        },
      });
      toast.success("Team created");
      onCreated?.(res.teamId);
      setForm({ teamName: "", leaderEmail: "", membersRaw: "", mentorEmail: "", college: "", city: "", state: "" });
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create team");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand/10 text-brand grid place-items-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="font-heading text-lg font-semibold leading-tight">Create team</div>
              <div className="text-xs text-muted-foreground">Admin · accepts any email (invites will be issued)</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 text-xs font-medium text-muted-foreground">Team name *
            <input required value={form.teamName}
              onChange={(e) => setForm({ ...form, teamName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>

          <label className="sm:col-span-2 text-xs font-medium text-muted-foreground">Team leader email *
            <input required type="email" value={form.leaderEmail}
              onChange={(e) => setForm({ ...form, leaderEmail: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>

          <label className="sm:col-span-2 text-xs font-medium text-muted-foreground">
            Team member emails (comma / newline separated)
            <textarea rows={3} value={form.membersRaw}
              onChange={(e) => setForm({ ...form, membersRaw: e.target.value })}
              placeholder="alice@school.edu, bob@school.edu"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>

          <label className="sm:col-span-2 text-xs font-medium text-muted-foreground">
            Assigned mentor email (optional)
            <input type="email" value={form.mentorEmail}
              onChange={(e) => setForm({ ...form, mentorEmail: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>

          <label className="sm:col-span-2 text-xs font-medium text-muted-foreground">College
            <input value={form.college}
              onChange={(e) => setForm({ ...form, college: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>

          <label className="text-xs font-medium text-muted-foreground">City
            <input value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">State
            <input value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>

          <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose}
              className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted">
              Cancel
            </button>
            <button disabled={busy}
              className="px-4 py-2 text-sm rounded-lg bg-brand text-brand-foreground inline-flex items-center gap-1 hover:opacity-90 disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create team
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
