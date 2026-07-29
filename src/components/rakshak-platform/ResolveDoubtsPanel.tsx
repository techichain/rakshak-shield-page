import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HelpCircle, Loader2, Clock } from "lucide-react";
import { listPendingDoubtsForResolver, resolveDoubt } from "@/lib/rakshak-platform/doubts.functions";
import { EmptyState } from "@/components/rakshak-platform/EmptyState";

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return iso; }
}

export function ResolveDoubtsPanel({ title = "Doubts to resolve" }: { title?: string }) {
  const list = useServerFn(listPendingDoubtsForResolver);
  const resolve = useServerFn(resolveDoubt);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    try {
      const res = await list({ data: {} } as any) as any;
      setItems(res?.doubts ?? []);
    } catch {
      setItems([]);
    } finally {
      setBusy(false);
    }
  }

  // refresh is intentionally omitted: it is recreated each render and would re-fetch in a loop.
  useEffect(() => { void refresh(); }, []);

  async function submit(id: string) {
    if (!text.trim()) return;
    setSaving(true); setErr(null);
    try {
      await resolve({ data: { doubt_id: id, resolution_text: text.trim() } } as any);
      setActiveId(null); setText("");
      void refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to resolve");
    } finally {
      setSaving(false);
    }
  }

  const usingDummy = items.length === 0;
  const rows = usingDummy ? SAMPLE : items;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-brand" />
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {!busy && (
          <span className="ml-auto text-xs text-muted-foreground">{usingDummy ? "0 pending" : `${items.length} pending`}</span>
        )}
      </div>
      {busy ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {usingDummy && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-[11px] text-amber-800">
              Nothing pending right now — showing sample entries so you know what to expect.
            </div>
          )}
          <ul className="mt-3 space-y-3">
            {rows.map((d: any) => (
              <li key={d.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{d.team_name}</span>
                      {" · "}{d.posted_by_name} ({d.posted_by_role})
                      {" · "}{fmt(d.created_at)}
                      {d.phase_number != null && <> · Phase {d.phase_number}</>}
                      {d.escalated_at && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-orange-300 bg-orange-50 text-orange-700">
                          Escalated{d.follow_up_count ? ` · ${d.follow_up_count} follow-up${d.follow_up_count > 1 ? "s" : ""}` : ""}
                        </span>
                      )}
                      {d.sample && <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-amber-300 text-amber-700">Sample</span>}
                    </div>
                    <div className="mt-1 text-sm whitespace-pre-wrap">{d.question}</div>

                    {!d.sample && activeId !== d.id && (
                      <button
                        type="button"
                        onClick={() => { setActiveId(d.id); setText(""); setErr(null); }}
                        className="mt-2 h-8 rounded-full bg-brand px-4 text-xs text-brand-foreground hover:bg-brand/90"
                      >
                        Resolve
                      </button>
                    )}
                    {!d.sample && activeId === d.id && (
                      <div className="mt-2 space-y-2">
                        <textarea
                          rows={3}
                          maxLength={4000}
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          placeholder="Write your resolution — the team will see this."
                          className="rp-input w-full"
                        />
                        {err && <div className="text-sm text-red-600">{err}</div>}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => submit(d.id)}
                            className="h-9 rounded-full bg-brand px-4 text-xs text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
                          >
                            {saving ? "Saving…" : "Submit resolution"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setActiveId(null); setText(""); setErr(null); }}
                            className="h-9 rounded-full border border-border px-4 text-xs hover:border-brand/40"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
