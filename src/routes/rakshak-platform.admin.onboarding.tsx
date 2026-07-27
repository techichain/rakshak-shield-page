import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import {
  BULK_KINDS,
  getBulkTemplateCsv,
  getBulkTemplateFilename,
  type BulkKind,
} from "@/lib/rakshak-platform/bulk-onboarding.constants";
import {
  parseAndValidateBulkCsv,
  listRecentBulkImports,
  type BulkValidationResult,
} from "@/lib/rakshak-platform/bulk-onboarding.functions";
import {
  ArrowLeft,
  Download,
  Upload,
  Loader2,
  AlertOctagon,
  CheckCircle2,
  RotateCcw,
  History,
  UsersRound,
} from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["cfi_admin", "super_admin"]);
  },
  component: BulkOnboardingPage,
});

const STATUS_TONE: Record<string, string> = {
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  validating: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-amber-50 text-amber-700 border-amber-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function BulkOnboardingPage() {
  const validate = useServerFn(parseAndValidateBulkCsv);
  const fetchRecent = useServerFn(listRecentBulkImports);

  const [kind, setKind] = useState<BulkKind>("teams");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<BulkValidationResult | null>(null);
  const [recent, setRecent] = useState<any[]>([]);

  const loadRecent = useCallback(() => {
    fetchRecent({})
      .then((rows: any) => setRecent(rows ?? []))
      .catch(() => setRecent([]));
  }, [fetchRecent]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  function downloadTemplate() {
    const blob = new Blob([getBulkTemplateCsv(kind)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = getBulkTemplateFilename(kind);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setResult(null);
    setErr(null);
    setFileName("");
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFileName(f.name);
    setErr(null);
    setResult(null);
    setBusy(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setErr("Could not read that file.");
      setBusy(false);
    };
    reader.onload = () => {
      const text = String(reader.result ?? "");
      validate({ data: { kind, csv_text: text } })
        .then((r: any) => setResult(r))
        .catch((e: any) => setErr(e?.message ?? "Validation failed"))
        .finally(() => {
          setBusy(false);
          loadRecent();
        });
    };
    reader.readAsText(f);
  }

  const errorCount = result?.errors.length ?? 0;

  return (
    <PlatformShell>
      <Section>
        <div className="flex items-center gap-3">
          <Link
            to="/rakshak-platform/admin"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>
        </div>

        <div className="mt-6">
          <Eyebrow>Admin · Bulk onboarding</Eyebrow>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight mt-4">
            Onboard teams, mentors &amp; evaluators
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Download the template for the group you&apos;re adding, fill it in, upload it here, and
            check the preview before any accounts are created.
          </p>
        </div>

        {/* Role picker */}
        <div className="mt-8 inline-flex rounded-full border border-border p-1 bg-background">
          {BULK_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => {
                setKind(k.id);
                reset();
              }}
              aria-pressed={kind === k.id}
              className={`h-9 px-5 rounded-full text-sm font-medium transition-colors ${
                kind === k.id
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {BULK_KINDS.find((k) => k.id === kind)?.blurb}
        </p>

        <div className="mt-8 grid gap-6 max-w-3xl">
          {/* Step 1 */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Step 1 · Download the template</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The template has the exact columns we expect, plus one sample row you can replace.
            </p>
            <button
              type="button"
              onClick={downloadTemplate}
              className="mt-4 inline-flex items-center gap-2 h-10 rounded-full border border-border px-5 text-sm hover:border-brand/40"
            >
              <Download className="h-4 w-4" /> {getBulkTemplateFilename(kind)}
            </button>
          </div>

          {/* Step 2 */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Step 2 · Upload your filled CSV</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing is created yet — we only check the file and show you what would happen.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label
                htmlFor="bulk-csv-input"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-brand text-brand-foreground text-sm cursor-pointer hover:bg-brand/90"
              >
                <Upload className="h-4 w-4" /> Choose CSV file
              </label>
              <input
                id="bulk-csv-input"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                aria-label={`Upload ${kind} CSV file`}
                onChange={onFile}
              />
              {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
              {busy && <Loader2 className="h-4 w-4 animate-spin text-brand" />}
            </div>
          </div>

          {err && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {err}
            </div>
          )}

          {/* Preview */}
          {result && (
            <div className="grid gap-6">
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold">
                  <span className="text-emerald-700">Will create: {result.will_create}</span>
                  <span className="text-muted-foreground">Will skip: {result.will_skip}</span>
                  <span className={errorCount > 0 ? "text-red-700" : "text-muted-foreground"}>
                    Errors: {errorCount}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {result.rows_total} data row{result.rows_total === 1 ? "" : "s"} read. Rows marked
                  &ldquo;skip&rdquo; already have an account with that email.
                </p>
              </div>

              {errorCount > 0 && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 p-6"
                >
                  <div className="flex items-center gap-2 font-heading font-semibold text-red-800">
                    <AlertOctagon className="h-5 w-5" /> Fix these before continuing
                  </div>
                  <ul className="mt-3 grid gap-1.5 text-sm text-red-700">
                    {result.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>
                        <span className="font-semibold">
                          {e.row > 0 ? `Row ${e.row}` : "File"}:
                        </span>{" "}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                  {errorCount > 20 && (
                    <p className="mt-3 text-xs text-red-700/80">Showing 20 of {errorCount}.</p>
                  )}
                </div>
              )}

              {errorCount === 0 && result.will_create > 0 && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                  <div className="flex items-center gap-2 font-heading font-semibold text-emerald-800">
                    <CheckCircle2 className="h-5 w-5" /> Ready to generate credentials.
                  </div>
                  <button
                    type="button"
                    disabled
                    title="Coming in the next release"
                    aria-disabled="true"
                    className="mt-4 inline-flex items-center gap-2 h-12 rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground opacity-50 cursor-not-allowed"
                  >
                    <UsersRound className="h-4 w-4" />
                    Generate credentials ({result.will_create} users)
                  </button>
                  <p className="mt-2 text-xs text-emerald-800/80">Coming in the next release.</p>
                </div>
              )}

              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-6 py-3 border-b border-border text-sm font-semibold">
                  Preview (first 10 rows)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-brand-lite text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-2">Row</th>
                        <th className="text-left px-4 py-2">Action</th>
                        {result.kind === "teams" && <th className="text-left px-4 py-2">Team</th>}
                        <th className="text-left px-4 py-2">Name</th>
                        <th className="text-left px-4 py-2">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {result.preview.slice(0, 10).map((p) => (
                        <tr key={p.row}>
                          <td className="px-4 py-2 text-muted-foreground">{p.row}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                p.action === "create"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-border bg-muted text-muted-foreground"
                              }`}
                            >
                              {p.action === "create" ? "Create" : "Skip"}
                            </span>
                          </td>
                          {result.kind === "teams" && (
                            <td className="px-4 py-2">{p.team_name || "—"}</td>
                          )}
                          <td className="px-4 py-2 font-medium">{p.full_name || "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground">{p.email || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 h-10 rounded-full border border-border px-5 text-sm hover:border-brand/40 self-start"
              >
                <RotateCcw className="h-4 w-4" /> Re-upload
              </button>
            </div>
          )}

          {/* Recent imports */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 font-heading text-lg font-semibold">
              <History className="h-4 w-4" /> Recent uploads
            </div>
            {recent.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No uploads yet.</p>
            ) : (
              <ul className="mt-4 grid gap-2">
                {recent.slice(0, 5).map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border/60 px-4 py-2 text-sm"
                  >
                    <span className="font-semibold capitalize">{r.kind}</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        STATUS_TONE[r.status] ?? "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {r.status}
                    </span>
                    <span className="text-muted-foreground">{r.rows_total ?? 0} rows</span>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {new Date(r.created_at).toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}
