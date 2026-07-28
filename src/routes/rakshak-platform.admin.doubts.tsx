import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { listAllDoubts, resolveDoubt } from "@/lib/rakshak-platform/doubts.functions";
import { HelpCircle, Loader2, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/doubts")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["cfi_admin", "super_admin"]);
  },
  component: AdminDoubtsPage,
});

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function AdminDoubtsPage() {
  const list = useServerFn(listAllDoubts);
  const resolve = useServerFn(resolveDoubt);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<"pending" | "resolved">("pending");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    try {
      const res = await list({ data: {} } as any) as any;
      setItems(res?.doubts ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
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

  const filtered = items.filter((d) => d.status === tab);

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · doubts</Eyebrow>
        <h1 className="mt-4 font-heading text-3xl sm:text-4xl font-bold leading-[1.05]">
          Team doubts
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Every question posted by team leaders and members across the programme. Resolving here notifies the whole team.
        </p>

        <div className="mt-8 flex gap-2 border-b border-border">
          {(["pending", "resolved"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "pending" ? "Pending" : "Resolved"}
              <span className="ml-2 text-[10px] text-muted-foreground">
                {items.filter((d) => d.status === t).length}
              </span>
            </button>
          ))}
        </div>

        {busy ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <HelpCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            No {tab} doubts.
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {filtered.map((d) => (
              <li key={d.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  {d.status === "resolved" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                  ) : (
                    <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{d.team_name}</span>
                      {" · "}{d.posted_by_name} ({d.posted_by_role})
                      {" · "}{fmt(d.created_at)}
                      {d.phase_number != null && <> · Phase {d.phase_number}</>}
                      {d.posted_by_role === "mentor" && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-brand/40 bg-brand-lite text-brand">
                          Raised by mentor
                        </span>
                      )}
                      {d.escalated_at && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-orange-300 bg-orange-50 text-orange-700">
                          Escalated{d.follow_up_count ? ` · ${d.follow_up_count} follow-up${d.follow_up_count > 1 ? "s" : ""}` : ""}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm whitespace-pre-wrap">{d.question}</div>
                    {d.status === "resolved" && d.resolution_text && (
                      <div className="mt-2 rounded-lg border-l-2 border-emerald-400 bg-emerald-50/50 pl-3 py-1 text-sm">
                        <div className="text-[11px] text-muted-foreground">
                          Resolved by {d.resolved_by_name ?? "reviewer"}
                          {d.resolved_at ? ` · ${fmt(d.resolved_at)}` : ""}
                        </div>
                        <div className="whitespace-pre-wrap">{d.resolution_text}</div>
                      </div>
                    )}
                    {d.status === "pending" && activeId !== d.id && (
                      <button
                        onClick={() => { setActiveId(d.id); setText(""); setErr(null); }}
                        className="mt-3 h-9 rounded-full bg-brand px-4 text-xs text-brand-foreground hover:bg-brand/90"
                      >
                        Resolve
                      </button>
                    )}
                    {d.status === "pending" && activeId === d.id && (
                      <div className="mt-3 space-y-2">
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
                            disabled={saving}
                            onClick={() => submit(d.id)}
                            className="h-9 rounded-full bg-brand px-4 text-xs text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
                          >
                            {saving ? "Saving…" : "Submit resolution"}
                          </button>
                          <button
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
        )}
      </Section>
    </PlatformShell>
  );
}
