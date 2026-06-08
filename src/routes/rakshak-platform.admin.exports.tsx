import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { exportDataset } from "@/lib/rakshak-platform/exports.functions";
import { Download, Printer } from "lucide-react";

const DATASETS = [
  { id: "teams",         label: "Teams",         desc: "All teams with phase, score, status." },
  { id: "submissions",   label: "Submissions",   desc: "Phase submissions with review state." },
  { id: "locations",     label: "Locations",     desc: "Audited locations with coordinates." },
  { id: "finance",       label: "Finance",       desc: "Ledger of inflows and expenses." },
  { id: "sponsorships",  label: "Sponsorships",  desc: "Pledges with status and tier." },
] as const;

export const Route = createFileRoute("/rakshak-platform/admin/exports")({
  component: ExportsPage,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return <PlatformShell><Section><p>{String(error)}</p></Section></PlatformShell>;
  },
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

function ExportsPage() {
  const run = useServerFn(exportDataset);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function download(id: typeof DATASETS[number]["id"]) {
    setBusy(id); setErr(null);
    try {
      const { csv, filename } = await run({ data: { dataset: id } });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e?.message ?? "Export failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Data exports</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Download a snapshot.<br /><span className="text-brand">CSV or print-ready PDF.</span>
        </h1>
        {err && <p className="mt-4 text-sm text-red-600">{err}</p>}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DATASETS.map((d) => (
            <div key={d.id} className="rounded-2xl border border-border bg-background p-6 flex flex-col">
              <h3 className="font-heading text-lg">{d.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d.desc}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => download(d.id)}
                  disabled={busy === d.id}
                  className="inline-flex items-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {busy === d.id ? "Exporting…" : "CSV"}
                </button>
                <Link
                  to="/rakshak-platform/admin/print/$dataset"
                  params={{ dataset: d.id }}
                  target="_blank"
                  className="inline-flex items-center gap-2 h-10 rounded-full border border-border px-5 text-sm hover:border-brand/40"
                >
                  <Printer className="h-4 w-4" /> PDF
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </PlatformShell>
  );
}
