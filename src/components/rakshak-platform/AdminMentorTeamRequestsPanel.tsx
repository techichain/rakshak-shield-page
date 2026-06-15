import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Clock, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import {
  listMentorTeamRequests,
  decideMentorTeamRequest,
} from "@/lib/rakshak-platform/mentor-team-requests.functions";

type Row = {
  id: string;
  mentor_profile_id: string;
  mentor_name: string | null;
  mentor_email: string | null;
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

export function AdminMentorTeamRequestsPanel() {
  const listFn = useServerFn(listMentorTeamRequests);
  const decideFn = useServerFn(decideMentorTeamRequest);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [mode, setMode] = useState<"approved" | "rejected">("approved");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  async function load() {
    setLoading(true);
    try { setRows((await listFn()) as Row[]); }
    catch (e: any) { toast.error(e?.message ?? "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function open(id: string, m: "approved" | "rejected") {
    setDecidingId(id); setMode(m); setNote("");
  }

  async function confirm(id: string) {
    if (note.trim().length < 3) { toast.error("Decision notes are required (min 3 chars)."); return; }
    setBusy(true);
    try {
      const res = await decideFn({ data: { requestId: id, decision: mode, notes: note.trim() } });
      toast.success(res.decision === "approved" ? "Team approved and created." : "Request rejected.");
      setDecidingId(null);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  const filtered = rows.filter((r) => statusFilter === "all" ? true : r.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          Mentors submit new teams here. On approval, the team is created with the mentor assigned and the verified team leader linked.
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-full border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No requests.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const tone =
              r.status === "approved" ? "text-emerald-600 border-emerald-200 bg-emerald-50"
              : r.status === "rejected" ? "text-red-600 border-red-200 bg-red-50"
              : "text-amber-600 border-amber-200 bg-amber-50";
            const Icon = r.status === "approved" ? Check : r.status === "rejected" ? X : Clock;
            const isDeciding = decidingId === r.id;
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-heading text-base font-semibold">{r.team_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Mentor: <span className="text-foreground">{r.mentor_name ?? "—"}</span> · {r.mentor_email}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Leader email: <span className="text-foreground">{r.leader_email}</span>
                    </div>
                    {(r.college || r.city || r.state) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {[r.college, r.city, r.state].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Submitted {new Date(r.created_at).toLocaleString()}
                    </div>
                    {r.admin_notes && (
                      <div className="mt-2 text-xs"><span className="font-semibold">Admin note:</span> {r.admin_notes}</div>
                    )}
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${tone}`}>
                    <Icon className="h-3 w-3" /> {r.status}
                  </span>
                </div>

                {r.status === "pending" && !isDeciding && (
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => open(r.id, "approved")}
                      className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1">
                      <Check className="h-4 w-4" /> Approve & create team
                    </button>
                    <button onClick={() => open(r.id, "rejected")}
                      className="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center gap-1">
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </div>
                )}

                {isDeciding && (
                  <div className="mt-4 rounded-lg border border-border bg-background p-3 space-y-2">
                    <div className="text-xs font-semibold">
                      {mode === "approved" ? "Approval note (required)" : "Rejection reason (required)"}
                    </div>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      placeholder={mode === "approved" ? "e.g., Verified leader, approved for Cohort 2." : "e.g., Leader already assigned to another team."}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setDecidingId(null)} className="px-3 py-1.5 text-sm rounded-lg border border-border">Cancel</button>
                      <button disabled={busy} onClick={() => confirm(r.id)}
                        className={`px-3 py-1.5 text-sm rounded-lg text-white inline-flex items-center gap-1 ${mode === "approved" ? "bg-emerald-600" : "bg-red-600"}`}>
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm {mode === "approved" ? "approval" : "rejection"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
