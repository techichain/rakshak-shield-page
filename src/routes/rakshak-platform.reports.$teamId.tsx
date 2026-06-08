import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getTeamReport } from "@/lib/rakshak-platform/reports.functions";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/reports/$teamId")({
  component: PrintableReport,
});

function PrintableReport() {
  const { teamId } = useParams({ from: "/rakshak-platform/reports/$teamId" });
  const fetchReport = useServerFn(getTeamReport);
  const { data, isLoading, error } = useQuery({
    queryKey: ["rp-team-report", teamId],
    queryFn: () => fetchReport({ data: { teamId } }),
  });

  if (isLoading) return <div className="p-10 text-sm">Loading…</div>;
  if (error || !data) return <div className="p-10 text-sm">Report not found.</div>;
  const { team, locations, submissions, reports } = data;

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="no-print sticky top-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="text-sm font-medium">Project Rakshak — Team report</div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 h-10 rounded-full bg-black px-5 text-sm text-white">
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>

      <article className="mx-auto max-w-3xl px-8 py-12 print:py-6">
        <div className="text-xs tracking-[0.25em] uppercase text-gray-500">Crashfree India · Project Rakshak</div>
        <h1 className="mt-2 text-4xl font-bold">{team.team_name}</h1>
        <p className="mt-2 text-gray-600">{team.college ? `${team.college} · ` : ""}{team.city}, {team.state}</p>

        <section className="mt-8 grid grid-cols-3 gap-4 text-sm">
          <Stat label="Current phase" value={`Phase ${team.current_phase ?? 0}`} />
          <Stat label="Status" value={team.status} />
          <Stat label="Final score" value={team.final_score?.toFixed?.(1) ?? "—"} />
        </section>

        <Section title="Phase submissions">
          {submissions.length === 0 ? <Empty>No submissions yet.</Empty> :
            <ul className="space-y-3">
              {submissions.map((s: any) => (
                <li key={s.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-500">Phase {s.phase_number} · {PHASE_TITLES[s.phase_number] ?? ""}</div>
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-sm mt-1">{s.summary}</div>
                  <div className="text-xs text-gray-500 mt-2">Status: {s.status}{s.submitted_at ? ` · ${new Date(s.submitted_at).toLocaleDateString()}` : ""}</div>
                </li>
              ))}
            </ul>}
        </Section>

        <Section title={`Locations audited (${locations.length})`}>
          {locations.length === 0 ? <Empty>No locations recorded.</Empty> :
            <ul className="space-y-2">
              {locations.map((l: any) => (
                <li key={l.id} className="border-l-4 border-gray-300 pl-4 py-1">
                  <div className="font-medium">{l.location_name} {l.is_final_selected && <span className="text-xs ml-2 px-2 py-0.5 bg-black text-white rounded">FINAL</span>}</div>
                  <div className="text-sm text-gray-600">{l.address ?? ""}{l.city ? ` · ${l.city}` : ""}</div>
                  <div className="text-xs text-gray-500">{l.issue_type} · severity {l.severity}</div>
                </li>
              ))}
            </ul>}
        </Section>

        <Section title={`Authority engagement (${reports.length})`}>
          {reports.length === 0 ? <Empty>No authority letters sent.</Empty> :
            <ul className="space-y-3">
              {reports.map((r: any) => (
                <li key={r.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="font-medium">{r.subject}</div>
                  <div className="text-xs text-gray-500 mt-1">{r.authority_name} ({r.authority_category}) · {r.status}</div>
                  {r.response_status && <div className="text-xs mt-1">Response: {r.response_status}{r.response_at ? ` · ${new Date(r.response_at).toLocaleDateString()}` : ""}</div>}
                </li>
              ))}
            </ul>}
        </Section>

        <footer className="mt-16 pt-6 border-t border-gray-200 text-xs text-gray-500">
          Generated {new Date().toLocaleDateString()} · crashfreeindia.org
        </footer>
      </article>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 14mm; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 break-inside-avoid">
      <h2 className="text-xl font-bold border-b border-gray-300 pb-2 mb-4">{title}</h2>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-gray-500 italic">{children}</div>;
}
