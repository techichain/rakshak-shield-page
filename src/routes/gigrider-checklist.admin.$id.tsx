import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getObservationAdmin } from "@/lib/gigrider/admin.functions";
import { useAuth } from "@/lib/gigrider/auth";
import { useRole } from "@/lib/gigrider/useRole";

export const Route = createFileRoute("/gigrider-checklist/admin/$id")({
  component: AdminObservationDetail,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-2 border-b border-slate-100 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="md:col-span-2 text-sm text-slate-900 break-words">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="text-sm font-semibold text-slate-900 mb-2">{title}</h2>
      <dl>{children}</dl>
    </section>
  );
}

function AdminObservationDetail() {
  const { id } = Route.useParams();
  const { user, loading: al } = useAuth();
  const { role, loading: rl } = useRole();
  const navigate = useNavigate();
  const fetchOne = useServerFn(getObservationAdmin);

  useEffect(() => {
    if (al || rl) return;
    if (!user) navigate({ to: "/gigrider-checklist/login" });
    else if (role !== "admin") navigate({ to: "/gigrider-checklist/observer" });
  }, [user, role, al, rl, navigate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["gigrider-admin-obs", id],
    queryFn: () => fetchOne({ data: { id } }),
    enabled: !!user && role === "admin",
  });

  if (al || rl || isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-sm text-slate-500">Loading…</p></div>;
  }
  if (error) return <div className="p-8 text-red-600">{(error as Error).message}</div>;
  if (!data) return <div className="p-8">Not found.</div>;

  const o: any = data;
  const fmt = (v: unknown) => (v == null || v === "" ? "—" : String(v));
  const fmtArr = (a: string[] | null | undefined) => (a && a.length ? a.join(", ") : null);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <Link to="/gigrider-checklist/admin" className="text-sm text-slate-600 hover:text-slate-900">← Back to dashboard</Link>
        <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === "submitted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{o.status}</span>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Section title="Overview">
          <Row label="Observer" value={o.observer ? `${o.observer.name} (${o.observer.username ?? "—"})` : "—"} />
          <Row label="Surveyor" value={o.surveyor?.name} />
          <Row label="Gig worker ID" value={o.gig_worker_id} />
          <Row label="Hotspot" value={o.hotspot ? `${o.hotspot.city} — ${o.hotspot.name}` : null} />
          <Row label="Started" value={new Date(o.started_at).toLocaleString()} />
          <Row label="Submitted" value={o.submitted_at ? new Date(o.submitted_at).toLocaleString() : null} />
          <Row label="Updated" value={new Date(o.updated_at).toLocaleString()} />
        </Section>

        <Section title="GPS">
          <Row label="Coordinates" value={
            o.gps_lat != null && o.gps_lng != null ? (
              <a className="text-blue-600 hover:underline" target="_blank" rel="noreferrer"
                 href={`https://www.google.com/maps?q=${o.gps_lat},${o.gps_lng}`}>
                {Number(o.gps_lat).toFixed(6)}, {Number(o.gps_lng).toFixed(6)}
              </a>
            ) : null
          } />
          <Row label="Accuracy (m)" value={o.gps_accuracy_meters} />
          <Row label="Captured at" value={o.gps_captured_at ? new Date(o.gps_captured_at).toLocaleString() : null} />
        </Section>

        <Section title="Road environment">
          <Row label="Type" value={o.road_env_type} />
          <Row label="Other" value={o.road_env_type_other} />
          <Row label="Hazards" value={fmtArr(o.road_hazards)} />
        </Section>

        <Section title="Vehicle">
          <Row label="Observed" value={o.vehicle_observed ? "Yes" : "No"} />
          <Row label="Type" value={o.vehicle_type} />
          <Row label="Brand / model" value={o.vehicle_brand_model} />
        </Section>

        <Section title="Consent">
          <Row label="Interview" value={o.consent_interview} />
          <Row label="Interview notes" value={o.consent_interview_notes} />
          <Row label="Screenshot" value={o.consent_screenshot} />
          <Row label="Screenshot notes" value={o.consent_screenshot_notes} />
          <Row label="Optional items requested" value={fmtArr(o.consent_optional_items)} />
        </Section>

        <Section title="Surveyor behaviour">
          <Row label="Rushed" value={o.surveyor_rushed} />
          <Row label="Rushed notes" value={o.surveyor_rushed_notes} />
          <Row label="Led the rider" value={o.surveyor_led} />
          <Row label="Led notes" value={o.surveyor_led_notes} />
          <Row label="Rating" value={o.surveyor_rating} />
        </Section>

        <Section title="Rider">
          <Row label="Platform gear" value={fmtArr(o.platform_gear)} />
          <Row label="Other gear" value={o.platform_gear_other} />
          <Row label="Helmet" value={o.helmet_status} />
          <Row label="Engagement" value={o.rider_engagement} />
          <Row label="Response consistency" value={o.response_consistency} />
          <Row label="Consistency notes" value={o.response_consistency_notes} />
        </Section>

        <Section title="Notes & flag">
          <Row label="Additional notes" value={o.additional_notes} />
          <Row label="Flagged" value={o.flagged ? "Yes" : "No"} />
          <Row label="Flag reason" value={o.flag_reason} />
        </Section>

        <Section title={`Photos (${o.photos?.length ?? 0})`}>
          {o.photos?.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {o.photos.map((p: any) => (
                <a key={p.id} href={p.url ?? "#"} target="_blank" rel="noreferrer" className="block">
                  {p.url ? (
                    <img src={p.url} alt={p.file_name} className="w-full h-32 object-cover rounded-md border border-slate-200" />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-slate-100 text-xs text-slate-500 rounded-md">{p.file_name}</div>
                  )}
                </a>
              ))}
            </div>
          ) : <p className="text-sm text-slate-500">No photos uploaded.</p>}
        </Section>

        <p className="text-xs text-slate-400 text-center pt-2">ID: {fmt(o.id)}</p>
      </main>
    </div>
  );
}
