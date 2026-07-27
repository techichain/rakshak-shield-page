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
  executeBulkOnboarding,
  getBulkImportProgress,
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
  const execute = useServerFn(executeBulkOnboarding);
  const fetchProgress = useServerFn(getBulkImportProgress);

  const [kind, setKind] = useState<BulkKind>("teams");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<BulkValidationResult | null>(null);
  const [recent, setRecent] = useState<any[]>([]);

  // Execution state
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [csvB64, setCsvB64] = useState<string | null>(null);
  const [finalCounts, setFinalCounts] = useState<{
    rows_created: number;
    rows_skipped: number;
    rows_failed: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);
  const [downloaded, setDownloaded] = useState(false);

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
    setRunning(false);
    setProgress(null);
    setRunErr(null);
    setCsvB64(null);
    setFinalCounts(null);
    setDownloaded(false);
  }

  // Poll job progress every 2s while a run is in flight.
  useEffect(() => {
    if (!running || !result?.import_id) return;
    const importId = result.import_id;
    let stop = false;
    const tick = () => {
      fetchProgress({ data: { import_id: importId } })
        .then((p: any) => {
          if (!stop) setProgress(p);
        })
        .catch(() => {});
    };
    tick();
    const t = window.setInterval(tick, 2000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [running, result?.import_id, fetchProgress]);

  function startRun() {
    if (!result?.import_id) return;
    setConfirming(false);
    setRunning(true);
    setRunErr(null);
    setProgress(null);
    execute({ data: { import_id: result.import_id } })
      .then((r: any) => {
        setCsvB64(r.results_csv_base64);
        setFinalCounts({
          rows_created: r.rows_created,
          rows_skipped: r.rows_skipped,
          rows_failed: r.rows_failed,
          errors: r.errors ?? [],
        });
      })
      .catch((e: any) => setRunErr(e?.message ?? "The run failed."))
      .finally(() => {
        setRunning(false);
        loadRecent();
      });
  }

  function downloadCredentials() {
    if (!csvB64) return;
    const bin = atob(csvB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rakshak-credentials-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
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

              {errorCount === 0 && result.will_create > 0 && !running && !finalCounts && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                  <div className="flex items-center gap-2 font-heading font-semibold text-emerald-800">
                    <CheckCircle2 className="h-5 w-5" /> Ready to generate credentials.
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    disabled={!result.ok || result.will_create === 0 || running}
                    className="mt-4 inline-flex items-center gap-2 h-12 rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
                  >
                    <UsersRound className="h-4 w-4" />
                    Generate credentials ({result.will_create} users)
                  </button>
                  <p className="mt-2 text-xs text-emerald-800/80">
                    Each person gets a password-reset link by email; you also get a one-time CSV
                    with temporary passwords.
                  </p>
                </div>
              )}

              {confirming && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                  <div className="flex items-center gap-2 font-heading font-semibold text-amber-900">
                    <AlertOctagon className="h-5 w-5" /> Confirm account creation
                  </div>
                  <p className="mt-2 text-sm text-amber-900/90">
                    This will create {result.will_create} accounts and email each user a
                    password-reset link. This cannot be undone (though you can delete individual
                    accounts later). Proceed?
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={startRun}
                      className="inline-flex items-center gap-2 h-11 rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
                    >
                      Yes, generate
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="inline-flex items-center gap-2 h-11 rounded-full border border-border px-6 text-sm hover:border-brand/40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {running && (
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center gap-2 font-heading text-lg font-semibold">
                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                    Processing {(progress?.rows_created ?? 0) + (progress?.rows_failed ?? 0)} of{" "}
                    {result.will_create}…
                  </div>
                  <div className="mt-4 h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-brand transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (((progress?.rows_created ?? 0) + (progress?.rows_failed ?? 0)) /
                              Math.max(1, result.will_create)) *
                              100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Created {progress?.rows_created ?? 0} · Skipped {progress?.rows_skipped ?? 0} ·
                    Failed {progress?.rows_failed ?? 0}. Please keep this tab open — the
                    credentials CSV is only available once, at the end of the run.
                  </p>
                </div>
              )}

              {runErr && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
                  {runErr}
                </div>
              )}

              {finalCounts && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                  <div className="flex items-center gap-2 font-heading text-lg font-semibold text-emerald-800">
                    <CheckCircle2 className="h-5 w-5" /> Done — {finalCounts.rows_created} accounts
                    created, {finalCounts.rows_skipped} skipped, {finalCounts.rows_failed} failed.
                  </div>
                  <button
                    type="button"
                    onClick={downloadCredentials}
                    className={`mt-4 inline-flex items-center gap-2 h-12 rounded-full px-6 text-sm font-semibold ${
                      downloaded
                        ? "bg-brand/70 text-brand-foreground"
                        : "bg-brand text-brand-foreground hover:bg-brand/90"
                    }`}
                  >
                    <Download className="h-4 w-4" />
                    {downloaded ? "Downloaded — click again if needed" : "Download credentials.csv"}
                  </button>
                  <p className="mt-3 text-xs text-emerald-900/80">
                    The reset link email goes out within ~5 minutes via the notifications
                    dispatcher. If a user misses the email, the temp password in the CSV also
                    works. This CSV lives only in this browser tab — navigate away and it is gone
                    for good.
                  </p>
                </div>
              )}

              {finalCounts && finalCounts.errors.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
                  <div className="flex items-center gap-2 font-heading font-semibold text-red-800">
                    <AlertOctagon className="h-5 w-5" /> {finalCounts.errors.length} row(s) failed
                  </div>
                  <ul className="mt-3 grid gap-1 text-sm text-red-800">
                    {finalCounts.errors.map((e, i) => (
                      <li key={i}>
                        <span className="font-semibold">Row {e.row}:</span> {e.message}
                      </li>
                    ))}
                  </ul>
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
                    {(r.status === "done" || r.status === "processing") && (
                      <span className="text-muted-foreground">
                        {r.rows_created ?? 0} created · {r.rows_skipped ?? 0} skipped ·{" "}
                        {r.rows_failed ?? 0} failed
                      </span>
                    )}
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
