import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HelpCircle, Loader2, CheckCircle2, Clock } from "lucide-react";
import { createDoubt, listTeamDoubts, followUpDoubt } from "@/lib/rakshak-platform/doubts.functions";
import { EmptyState } from "@/components/rakshak-platform/EmptyState";

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return iso; }
}

export function DoubtsCard({ teamId, phaseNumber }: { teamId: string; phaseNumber?: number }) {
  const post = useServerFn(createDoubt);
  const list = useServerFn(listTeamDoubts);
  const followUp = useServerFn(followUpDoubt);
  const [followingUp, setFollowingUp] = useState<string | null>(null);
  const [doubts, setDoubts] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    try {
      const res = await list({ data: { team_id: teamId } } as any) as any;
      setDoubts(res?.doubts ?? []);
    } catch {
      setDoubts([]);
    } finally {
      setBusy(false);
    }
  }

  // refresh is intentionally omitted: it is recreated each render and would re-fetch in a loop.
  useEffect(() => { void refresh(); }, [teamId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setSaving(true); setErr(null);
    try {
      await post({ data: { team_id: teamId, question: question.trim(), phase_number: phaseNumber ?? null } } as any);
      setQuestion(""); setShowForm(false);
      void refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to post");
    } finally {
      setSaving(false);
    }
  }

  async function sendFollowUp(id: string) {
    setFollowingUp(id); setErr(null);
    try {
      await followUp({ data: { doubt_id: id } } as any);
      void refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Could not send follow-up");
    } finally {
      setFollowingUp(null);
    }
  }

  const items = doubts;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-brand" />
        <h2 className="font-heading text-lg font-semibold">Doubts</h2>
        <span className="ml-auto text-xs text-muted-foreground">Ask your mentor or admin</span>
      </div>

      <div className="mt-4">
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90"
          >
            Ask a doubt
          </button>
        ) : (
          <form onSubmit={submit} className="space-y-2">
            <textarea
              rows={3}
              maxLength={2000}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What are you stuck on? Be specific — mentors and admins can see this."
              className="rp-input w-full"
            />
            {err && <div className="text-sm text-red-600">{err}</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-60">
                {saving ? "Posting…" : "Post doubt"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setQuestion(""); setErr(null); }}
                className="h-10 rounded-full border border-border px-5 text-sm hover:border-brand/40">Cancel</button>
            </div>
          </form>
        )}
      </div>

      {busy ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          className="mt-4"
          tone="card"
          icon={HelpCircle}
          title="No doubts yet"
          description="Your team hasn't raised any doubts yet."
        />
      ) : (
        <>
          <ul className="mt-3 space-y-3">
            {items.map((d) => (
              <li key={d.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start gap-2">
                  {d.status === "resolved" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{d.posted_by_name}</span>
                      {" · "}{d.posted_by_role}
                      {" · "}{d.team_name}
                      {" · "}{fmt(d.created_at)}
                      {d.sample && <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-amber-300 text-amber-700">Sample</span>}
                    </div>
                    <div className="mt-1 text-sm whitespace-pre-wrap">{d.question}</div>
                    {d.escalated_at && (
                      <div className="mt-2 text-[11px] text-orange-700">
                        Follow-up sent · escalated to the programme team
                        {d.follow_up_count > 1 ? ` · ${d.follow_up_count} follow-ups` : ""}
                      </div>
                    )}
                    {!d.sample && d.status !== "resolved" && (
                      <button
                        type="button"
                        disabled={followingUp === d.id}
                        onClick={() => void sendFollowUp(d.id)}
                        className="mt-2 h-8 rounded-full border border-border px-4 text-xs hover:border-brand/40 disabled:opacity-60"
                      >
                        {followingUp === d.id ? "Sending…" : "Follow up / still unresolved"}
                      </button>
                    )}
                    {d.status === "resolved" && d.resolution_text && (
                      <div className="mt-2 rounded-lg border-l-2 border-emerald-400 bg-emerald-50/50 pl-3 py-1 text-sm">
                        <div className="text-[11px] text-muted-foreground">
                          Resolved by {d.resolved_by_name ?? "reviewer"}{d.resolved_at ? ` · ${fmt(d.resolved_at)}` : ""}
                        </div>
                        <div className="whitespace-pre-wrap">{d.resolution_text}</div>
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${d.status === "resolved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : d.escalated_at ? "border-orange-300 bg-orange-50 text-orange-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                    {d.status === "resolved" ? d.status : d.escalated_at ? "escalated" : d.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
