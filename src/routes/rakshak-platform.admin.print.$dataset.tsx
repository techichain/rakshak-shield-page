import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { exportDataset } from "@/lib/rakshak-platform/exports.functions";
import { Printer } from "lucide-react";

const TITLES: Record<string, string> = {
  teams: "Teams report",
  submissions: "Submissions report",
  locations: "Locations report",
};

export const Route = createFileRoute("/rakshak-platform/admin/print/$dataset")({
  component: PrintPage,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return <div className="p-8 text-red-600">{String(error)}</div>;
  },
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function parseCsv(csv: string): { headers: string[]; rows: string[][] } {
  if (!csv.trim()) return { headers: [], rows: [] };
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"' && csv[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n") { cur.push(field); lines.push(cur); cur = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
  }
  if (field.length || cur.length) { cur.push(field); lines.push(cur); }
  const headers = lines[0] ?? [];
  return { headers, rows: lines.slice(1) };
}

function PrintPage() {
  const { dataset } = Route.useParams();
  const run = useServerFn(exportDataset);
  const { data } = useSuspenseQuery({
    queryKey: ["rp-print", dataset],
    queryFn: () => run({ data: { dataset: dataset as any } }),
  });

  const { headers, rows } = parseCsv(data.csv);
  const title = TITLES[dataset] ?? "Report";

  useEffect(() => {
    document.title = `${title} · Rakshak`;
  }, [title]);

  return (
    <div className="bg-white text-black p-10 print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          table { font-size: 10pt; }
        }
        @page { margin: 1.5cm; }
      `}</style>
      <div className="no-print mb-6 flex items-center justify-between">
        <a href="/rakshak-platform/admin/data" className="text-sm text-brand">← Back to data</a>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground">
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>
      <div className="border-b-2 border-black/80 pb-4 mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-black/60">Crashfree India · Project Rakshak</div>
        <h1 className="font-bold text-3xl mt-2">{title}</h1>
        <div className="text-sm text-black/70 mt-1">
          Generated {new Date().toLocaleString("en-IN")} · {rows.length} record{rows.length === 1 ? "" : "s"}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-black/60">No records to print.</p>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-left border border-black/30 px-2 py-1 bg-black/5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="even:bg-black/[0.02]">
                {headers.map((_, j) => (
                  <td key={j} className="border border-black/15 px-2 py-1 align-top break-words">{r[j] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-10 text-xs text-black/50 border-t border-black/20 pt-4">
        Project Rakshak · Crashfree India · This report is generated automatically from the platform database.
      </div>
    </div>
  );
}
