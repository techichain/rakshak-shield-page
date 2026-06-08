import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { aiCheckSubmission } from "@/lib/rakshak-platform/ai-checker.functions";
import { Sparkles, CheckCircle2, AlertTriangle, ListChecks } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/team/ai-check")({
  component: AiCheck,
  errorComponent: ({ error }) => <PlatformShell><Section><p>{String(error)}</p></Section></PlatformShell>,
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

function AiCheck() {
  const run = useServerFn(aiCheckSubmission);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [review, setReview] = useState<any | null>(null);

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null); setReview(null);
    const fd = new FormData(e.currentTarget);
    try {
      const { review } = await run({
        data: {
          phase_number: Number(fd.get("phase_number") || 0),
          title: String(fd.get("title") || ""),
          text: String(fd.get("text") || ""),
        },
      });
      setReview(review);
    } catch (e: any) {
      setErr(e?.message ?? "AI check failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>AI report checker</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Get a mentor-style review<br /><span className="text-brand">before you submit.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          Paste your draft phase write-up. The AI checks it against Project Rakshak rubric — clarity, evidence quality, feasibility, report quality — and returns specific gaps to fix.
        </p>

        <form onSubmit={handle} className="mt-8 rounded-2xl border border-border bg-background p-6 grid gap-3">
          <div className="grid gap-3 md:grid-cols-4">
            <select name="phase_number" className="rp-input md:col-span-1" defaultValue="2">
              {[0, 1, 2, 3, 4].map((p) => (
                <option key={p} value={p}>Phase {p}</option>
              ))}
            </select>
            <input name="title" required maxLength={400} placeholder="Draft title" className="rp-input md:col-span-3" />
          </div>
          <textarea
            name="text" required minLength={50} maxLength={20000} rows={12}
            placeholder="Paste your draft write-up here (problem statement, observations, evidence, proposed solution)…"
            className="rp-input"
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button type="submit" disabled={busy} className="inline-flex w-fit items-center gap-2 h-11 rounded-full bg-brand px-6 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-60">
            <Sparkles className="h-4 w-4" /> {busy ? "Reviewing…" : "Run AI review"}
          </button>
        </form>

        {review && (
          <div className="mt-10 grid gap-6">
            <div className="rounded-2xl border border-brand/30 bg-brand-lite p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="font-heading text-2xl">AI verdict</h2>
                <div className="font-heading text-4xl text-brand">{review.overall_score}<span className="text-base text-muted-foreground">/100</span></div>
              </div>
              <p className="mt-3 text-sm">{review.summary}</p>
              {review.rubric && (
                <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {Object.entries(review.rubric).map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-background border border-border px-3 py-2">
                      <div className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</div>
                      <div className="font-heading text-lg">{String(v)}<span className="text-xs text-muted-foreground">/10</span></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Panel title="Strengths" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} items={review.strengths} />
              <Panel title="Gaps" icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} items={review.gaps} />
            </div>
            <Panel title="Next actions" icon={<ListChecks className="h-4 w-4 text-brand" />} items={review.next_actions} />
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}

function Panel({ title, icon, items }: { title: string; icon: React.ReactNode; items?: string[] }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="flex items-center gap-2"><span>{icon}</span><h3 className="font-heading text-lg">{title}</h3></div>
      {(!items || items.length === 0) ? (
        <p className="mt-3 text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((it, i) => <li key={i} className="flex gap-2"><span className="text-brand">•</span><span>{it}</span></li>)}
        </ul>
      )}
    </div>
  );
}
