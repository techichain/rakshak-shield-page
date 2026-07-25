import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { exportDataset } from "@/lib/rakshak-platform/exports.functions";
import {
  Loader2, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, Printer,
} from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/data")({
  component: DataPage,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return <PlatformShell><Section><p>{String(error)}</p></Section></PlatformShell>;
  },
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

const DATASETS = [
  { id: "teams",        label: "Teams",        desc: "All teams with phase, score, status." },
  { id: "submissions",  label: "Submissions",  desc: "Phase submissions with review state." },
  { id: "locations",    label: "Locations",    desc: "Audited locations with coordinates." },
] as const;


type Row = { team_name: string; college?: string; city?: string; state?: string };

function parseCSV(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const obj: any = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx]?.trim() ?? ""; });
    if (!obj.team_name) continue;
    rows.push(obj);
  }
  return rows;
}
function splitLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; continue; }
    if (ch === "," && !q) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function DataPage() {
  const navigate = useNavigate();
  const { loading, userId, isAdmin } = useRPAuth();
  const [tab, setTab] = useState<"import" | "export">("import");

  // Import state
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [cohortId, setCohortId] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);

  // Export state
  const run = useServerFn(exportDataset);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    supabase.from("rp_cohorts").select("id, name").order("created_at", { ascending: false })
      .then(({ data }) => { setCohorts(data ?? []); if (data?.[0]) setCohortId(data[0].id); })
      .catch(() => { setCohorts([]); });
  }, [loading, userId, isAdmin, navigate]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setRows(parseCSV(String(reader.result ?? "")));
    reader.readAsText(f);
  }

  async function importAll() {
    if (!cohortId || rows.length === 0) return;
    setImportBusy(true);
    const errors: string[] = [];
    let ok = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50).map((r) => ({
        cohort_id: cohortId,
        team_name: r.team_name,
        college: r.college || null,
        city: r.city || null,
        state: r.state || null,
        status: "approved" as const,
      }));
      const { error, count } = await supabase.from("rp_teams").insert(chunk, { count: "exact" });
      if (error) errors.push(error.message);
      else ok += count ?? chunk.length;
    }
    setResult({ ok, fail: rows.length - ok, errors });
    setImportBusy(false);
  }

  async function download(id: typeof DATASETS[number]["id"]) {
    setExportBusy(id); setExportErr(null);
    try {
      const { csv, filename } = await run({ data: { dataset: id } });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setExportErr(e?.message ?? "Export failed");
    } finally {
      setExportBusy(null);
    }
  }

  if (loading || !isAdmin) {
    return <PlatformShell><Section><Loader2 className="h-5 w-5 animate-spin text-brand" /></Section></PlatformShell>;
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Data operations</Eyebrow>
        <h1 className="font-heading text-4xl font-bold mt-4">Import & export</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Bulk-load teams from CSV or download snapshots of programme data.
        </p>

        <div className="mt-8 inline-flex rounded-full border border-border p-1 bg-background">
          <button
            onClick={() => setTab("import")}
            className={`h-9 px-5 rounded-full text-sm font-medium ${tab === "import" ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Import
          </button>
          <button
            onClick={() => setTab("export")}
            className={`h-9 px-5 rounded-full text-sm font-medium ${tab === "export" ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Export
          </button>
        </div>

        {tab === "import" && (
          <div className="mt-8 grid gap-6 max-w-2xl">
            <p className="text-sm text-muted-foreground">
              Upload a CSV with columns: <code className="bg-muted px-1.5 py-0.5 rounded">team_name, college, city, state</code>.
              All rows will be added to the cohort you select below.
            </p>

            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cohort</span>
              <select value={cohortId} onChange={(e) => setCohortId(e.target.value)}
                className="mt-1 w-full h-11 rounded-md border border-border bg-background px-3 text-sm">
                {cohorts.length === 0 && <option>No cohorts — create one first</option>}
                {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CSV file</span>
              <div className="mt-2 flex items-center gap-3">
                <label className="inline-flex items-center gap-2 h-11 px-4 rounded-full border border-border cursor-pointer hover:border-brand">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">Choose file</span>
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
                </label>
                {fileName && (
                  <span className="text-sm text-muted-foreground inline-flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />{fileName} · {rows.length} rows
                  </span>
                )}
              </div>
            </label>

            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent("team_name,college,city,state\nRakshak Team Demo,IIT Delhi,New Delhi,Delhi\n")}`}
              download="rakshak-teams-template.csv"
              className="text-sm text-brand underline self-start"
            >
              Download CSV template
            </a>

            {rows.length > 0 && (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border text-sm font-semibold">Preview (first 5)</div>
                <table className="w-full text-sm">
                  <thead className="bg-brand-lite text-xs uppercase text-muted-foreground">
                    <tr><th className="text-left px-4 py-2">Team</th><th className="text-left px-4 py-2">College</th><th className="text-left px-4 py-2">City</th><th className="text-left px-4 py-2">State</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 font-medium">{r.team_name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.college ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.city ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.state ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              disabled={importBusy || rows.length === 0 || !cohortId}
              onClick={importAll}
              className="h-12 rounded-full bg-brand px-6 text-sm text-brand-foreground hover:bg-brand/90 inline-flex items-center gap-2 disabled:opacity-50 self-start"
            >
              {importBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              Import {rows.length} teams
            </button>

            {result && (
              <div className={`rounded-xl border p-4 ${result.fail === 0 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-2 font-semibold">
                  {result.fail === 0
                    ? <><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Imported {result.ok} teams.</>
                    : <><AlertTriangle className="h-5 w-5 text-amber-600" /> Imported {result.ok}, failed {result.fail}.</>}
                </div>
                {result.errors.length > 0 && (
                  <ul className="mt-2 text-xs text-red-700 list-disc pl-5">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "export" && (
          <div className="mt-8">
            {exportErr && <p className="mb-4 text-sm text-red-600">{exportErr}</p>}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DATASETS.map((d) => (
                <div key={d.id} className="rounded-2xl border border-border bg-background p-6 flex flex-col">
                  <h3 className="font-heading text-lg">{d.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{d.desc}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      onClick={() => download(d.id)}
                      disabled={exportBusy === d.id}
                      className="inline-flex items-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" />
                      {exportBusy === d.id ? "Exporting…" : "CSV"}
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
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
