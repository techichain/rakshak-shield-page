import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import {
  listRubricTemplates,
  saveRubricTemplate,
} from "@/lib/rakshak-platform/rubric.functions";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/rubrics")({
  component: AdminRubrics,
  head: () => ({
    meta: [
      { title: "Scoring rubrics · Rakshak's Portal admin" },
      {
        name: "description",
        content:
          "Define the per-phase evaluation criteria, maximum scores and weights used by Rakshak evaluators.",
      },
      { property: "og:title", content: "Scoring rubrics · Rakshak's Portal admin" },
      {
        property: "og:description",
        content: "Per-phase evaluator scoring rubric templates for the Rakshak programme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

interface Criterion {
  key: string;
  label: string;
  max_score: number;
  weight: number;
  description?: string | null;
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60) || "criterion"
  );
}

function AdminRubrics() {
  const listFn = useServerFn(listRubricTemplates);
  const saveFn = useServerFn(saveRubricTemplate);
  const qc = useQueryClient();
  const [phase, setPhase] = useState(0);
  const [rows, setRows] = useState<Criterion[]>([]);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["rp-rubric-templates"],
    queryFn: () => listFn(),
  });

  const active = (data?.byPhase?.[phase] ?? []).find((t: any) => t.is_active) ?? null;

  useEffect(() => {
    const criteria: Criterion[] = ((active?.criteria ?? []) as any[]).map((c) => ({
      key: String(c.key),
      label: String(c.label ?? ""),
      max_score: Number(c.max_score ?? 0),
      weight: Number(c.weight ?? 1),
      description: c.description ?? "",
    }));
    setRows(criteria);
  }, [active, phase]);

  const totalMax = rows.reduce((s, r) => s + (Number(r.max_score) || 0), 0);

  function update(i: number, patch: Partial<Criterion>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    setBusy(true);
    try {
      const criteria = rows
        .filter((r) => r.label.trim())
        .map((r) => ({
          key: r.key?.trim() || slugify(r.label),
          label: r.label.trim(),
          max_score: Number(r.max_score) || 0,
          weight: Number(r.weight) || 1,
          description: r.description?.trim() || null,
        }));
      await saveFn({ data: { phase_number: phase, criteria } });
      await qc.invalidateQueries({ queryKey: ["rp-rubric-templates"] });
      toast.success(`Rubric saved for Phase ${phase}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save rubric");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Scoring rubrics</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">Per-phase evaluation criteria</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Define what evaluators score for each phase. Saving creates a new version and
          deactivates the previous one, so past evaluations keep their context.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((p) => (
            <button
              key={p}
              onClick={() => setPhase(p)}
              className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-wide ${
                phase === p
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border hover:border-brand/40"
              }`}
            >
              Phase {p}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{String(error)}</p>}
        {isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading rubrics…</p>
        ) : (
          <div className="mt-6 rounded-2xl border border-border bg-background p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-heading text-xl">
                Phase {phase} — {PHASE_TITLES[phase]}
              </h2>
              <div className="text-xs text-muted-foreground">
                {active ? `Active version v${active.version}` : "No rubric yet"} · total max{" "}
                <span className="font-mono font-semibold text-foreground">{totalMax}</span>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {rows.map((r, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_110px_110px_auto] md:items-center">
                    <input
                      value={r.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                      placeholder="Criterion label (e.g. Research methodology)"
                      className="rp-input"
                    />
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Max score
                      <input
                        type="number"
                        min={0}
                        value={r.max_score}
                        onChange={(e) => update(i, { max_score: Number(e.target.value) })}
                        className="rp-input mt-1 w-full text-right font-mono"
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Weight
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={r.weight}
                        onChange={(e) => update(i, { weight: Number(e.target.value) })}
                        className="rp-input mt-1 w-full text-right font-mono"
                      />
                    </label>
                    <button
                      onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-red-300 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                  <input
                    value={r.description ?? ""}
                    onChange={(e) => update(i, { description: e.target.value })}
                    placeholder="Description shown to evaluators (optional)"
                    className="rp-input mt-3 w-full text-sm"
                  />
                </div>
              ))}
              {rows.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No criteria yet — add the first one below. Until a rubric is saved, evaluators
                  score this phase freeform out of 100.
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  setRows((rs) => [
                    ...rs,
                    { key: `criterion_${rs.length + 1}`, label: "", max_score: 10, weight: 1, description: "" },
                  ])
                }
                className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-1.5 text-xs hover:border-brand/40"
              >
                <Plus className="h-3.5 w-3.5" /> Add criterion
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-1.5 text-sm text-brand-foreground disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> {busy ? "Saving…" : `Save Phase ${phase} rubric`}
              </button>
            </div>
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
