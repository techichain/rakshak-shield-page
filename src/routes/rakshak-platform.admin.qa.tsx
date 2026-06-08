import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { runQAChecks } from "@/lib/rakshak-platform/qa.functions";
import { ShieldCheck, AlertTriangle, AlertOctagon, CheckCircle2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/qa")({
  component: QAPage,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>;
  },
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

function QAPage() {
  const qc = useQueryClient();
  const run = useServerFn(runQAChecks);
  const { data } = useSuspenseQuery({ queryKey: ["rp-qa-checks"], queryFn: () => run() });

  const grouped = new Map<string, typeof data.checks>();
  for (const c of data.checks) {
    const arr = grouped.get(c.category) ?? [];
    arr.push(c);
    grouped.set(c.category, arr);
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · QA sweep</Eyebrow>
        <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-heading text-4xl tracking-tight">
            Data integrity check.<br /><span className="text-brand">Catch problems early.</span>
          </h1>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["rp-qa-checks"] })}
            className="inline-flex items-center gap-2 h-10 rounded-full border border-border px-4 text-sm hover:border-brand/40"
          >
            <RefreshCw className="h-4 w-4" /> Re-run
          </button>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <SummaryStat label="Checks" value={data.summary.total_checks} tone="brand" icon={<ShieldCheck className="h-4 w-4" />} />
          <SummaryStat label="Errors" value={data.summary.errors} tone="red" icon={<AlertOctagon className="h-4 w-4" />} />
          <SummaryStat label="Warnings" value={data.summary.warnings} tone="amber" icon={<AlertTriangle className="h-4 w-4" />} />
          <SummaryStat label="Clean" value={data.summary.clean} tone="emerald" icon={<CheckCircle2 className="h-4 w-4" />} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Generated {new Date(data.summary.generated_at).toLocaleString()}</p>

        {Array.from(grouped.entries()).map(([cat, checks]) => (
          <div key={cat} className="mt-12">
            <h2 className="font-heading text-2xl">{cat}</h2>
            <div className="mt-4 grid gap-3">
              {checks.map((c) => <CheckCard key={c.id} c={c} />)}
            </div>
          </div>
        ))}
      </Section>
    </PlatformShell>
  );
}

function CheckCard({ c }: { c: any }) {
  const clean = c.count === 0;
  const tone = clean ? "emerald" : c.severity === "error" ? "red" : c.severity === "warn" ? "amber" : "muted";
  const icon = clean
    ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    : c.severity === "error"
    ? <AlertOctagon className="h-4 w-4 text-red-600" />
    : <AlertTriangle className="h-4 w-4 text-amber-600" />;

  const ring =
    tone === "red" ? "border-red-200 bg-red-50/40" :
    tone === "amber" ? "border-amber-200 bg-amber-50/40" :
    tone === "emerald" ? "border-emerald-200 bg-emerald-50/40" :
    "border-border bg-background";

  return (
    <div className={`rounded-2xl border ${ring} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon}
          <div>
            <div className="font-medium">{c.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {clean ? "All good." : `${c.count} item${c.count === 1 ? "" : "s"}`}
            </div>
          </div>
        </div>
        <div className={`font-heading text-2xl ${clean ? "text-emerald-700" : c.severity === "error" ? "text-red-700" : "text-amber-700"}`}>
          {c.count}
        </div>
      </div>
      {!clean && c.items?.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-brand">Show {Math.min(c.items.length, 20)} item{c.items.length === 1 ? "" : "s"}</summary>
          <ul className="mt-2 space-y-1 text-xs">
            {c.items.map((it: any) => (
              <li key={it.id} className="text-muted-foreground"><span className="font-mono">{String(it.id).slice(0, 8)}</span> · {it.label}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function SummaryStat({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: React.ReactNode }) {
  const cls =
    tone === "brand" ? "text-brand" :
    tone === "red" ? "text-red-700" :
    tone === "amber" ? "text-amber-700" :
    tone === "emerald" ? "text-emerald-700" : "";
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">{icon} {label}</div>
      <div className={`mt-2 font-heading text-3xl ${cls}`}>{value}</div>
    </div>
  );
}
