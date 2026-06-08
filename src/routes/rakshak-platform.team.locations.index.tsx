import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { LocationMap, type MapMarker } from "@/components/rakshak-platform/LocationMap";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { MapPin, Plus, Star, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/team/locations/")({
  component: TeamLocationsIndex,
});

const SEV = ["low", "medium", "high", "critical"] as const;
const ISSUE_TYPES = [
  "Unsafe pedestrian crossing",
  "Pothole-heavy road",
  "Missing signage",
  "Dangerous U-turn",
  "Poor lighting",
  "School-zone speeding",
  "Broken divider",
  "Blind curve",
  "Missing lane markings",
  "Other",
];

function TeamLocationsIndex() {
  const navigate = useNavigate();
  const { loading, userId, isTeam } = useRPAuth();
  const [team, setTeam] = useState<any>(null);
  const [locs, setLocs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [form, setForm] = useState({
    location_name: "",
    address: "",
    city: "",
    state: "",
    issue_type: ISSUE_TYPES[0],
    severity: "medium" as (typeof SEV)[number],
    description: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isTeam) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    void load();
  }, [loading, userId, isTeam, navigate]);

  async function load() {
    const { data: t } = await supabase
      .from("rp_teams")
      .select("*")
      .eq("team_leader_id", userId!)
      .maybeSingle();
    setTeam(t);
    if (!t) return;
    setForm((f) => ({ ...f, city: t.city, state: t.state }));
    const { data: l } = await supabase
      .from("rp_locations")
      .select("*")
      .eq("team_id", t.id)
      .order("priority_rank", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    setLocs(l ?? []);
  }

  const markers: MapMarker[] = useMemo(
    () =>
      locs
        .filter((l) => l.latitude != null && l.longitude != null)
        .map((l) => ({
          id: l.id,
          lat: Number(l.latitude),
          lng: Number(l.longitude),
          title: l.location_name,
          subtitle: `${l.issue_type ?? ""} · ${l.city ?? ""}`,
          severity: l.severity,
          isFinal: l.is_final_selected,
        })),
    [locs],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!team) return;
    if (form.latitude == null || form.longitude == null) {
      setErr("Click on the map to pick a location.");
      return;
    }
    setSaving(true);
    setErr(null);
    const { error } = await supabase.from("rp_locations").insert({
      team_id: team.id,
      phase_number: team.current_phase ?? 0,
      location_name: form.location_name.trim(),
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      latitude: form.latitude,
      longitude: form.longitude,
      issue_type: form.issue_type,
      severity: form.severity,
      description: form.description.trim() || null,
      is_final_selected: false,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setShowForm(false);
    setForm({
      location_name: "", address: "",
      city: team.city, state: team.state,
      issue_type: ISSUE_TYPES[0], severity: "medium",
      description: "", latitude: null, longitude: null,
    });
    void load();
  }

  async function toggleFinal(loc: any) {
    const next = !loc.is_final_selected;
    await supabase.from("rp_locations").update({ is_final_selected: next }).eq("id", loc.id);
    void load();
  }

  if (loading || !team) {
    return <PlatformShell><Section>Loading…</Section></PlatformShell>;
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Evidence · Phase {team.current_phase} — {PHASE_TITLES[team.current_phase]}</Eyebrow>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
            Unsafe locations<br />
            <span className="text-brand">your team has mapped.</span>
          </h1>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="h-12 rounded-full bg-brand px-7 text-sm text-brand-foreground inline-flex items-center gap-2 hover:bg-brand/90"
          >
            <Plus className="h-4 w-4" /> {showForm ? "Cancel" : "Add location"}
          </button>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-3 overflow-hidden">
            <LocationMap
              markers={markers}
              picker={showForm}
              onPick={(lat, lng) => setForm((f) => ({ ...f, latitude: lat, longitude: lng }))}
              onMarkerClick={(id) => navigate({ to: "/rakshak-platform/team/locations/$id", params: { id } })}
              height="520px"
            />
            {showForm && (
              <p className="mt-2 text-xs text-muted-foreground px-2">
                Click anywhere on the map to drop a pin. The selected coords get attached to the new location.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">{locs.length} location{locs.length === 1 ? "" : "s"}</h2>
            </div>
            <div className="mt-4 space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {locs.length === 0 && (
                <p className="text-sm text-muted-foreground">No locations yet. Drop a pin on the map and add one.</p>
              )}
              {locs.map((l) => (
                <div key={l.id} className="rounded-xl border border-border p-3 hover:border-brand/40 transition">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-brand shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{l.location_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{l.issue_type} · {l.city}</div>
                    </div>
                    <button
                      onClick={() => toggleFinal(l)}
                      title={l.is_final_selected ? "Unmark as final" : "Mark as final selection"}
                      className={`h-7 w-7 rounded-full flex items-center justify-center border ${l.is_final_selected ? "bg-brand text-brand-foreground border-brand" : "border-border text-muted-foreground hover:border-brand/40"}`}
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Link
                    to="/rakshak-platform/team/locations/$id"
                    params={{ id: l.id }}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-brand hover:underline"
                  >
                    Open details <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        {showForm && (
          <form onSubmit={submit} className="mt-10 rounded-2xl border border-border bg-card p-7 grid gap-4 md:grid-cols-2">
            <h2 className="md:col-span-2 font-heading text-xl font-semibold">New unsafe location</h2>
            <Field label="Location name">
              <input required maxLength={200}
                value={form.location_name}
                onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))}
                className="rp-input" placeholder="e.g. M.G. Road junction near St. Mary's school" />
            </Field>
            <Field label="Issue type">
              <select className="rp-input"
                value={form.issue_type}
                onChange={(e) => setForm((f) => ({ ...f, issue_type: e.target.value }))}>
                {ISSUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Address">
              <input maxLength={300} value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="rp-input" />
            </Field>
            <Field label="Severity">
              <select className="rp-input"
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as any }))}>
                {SEV.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="City">
              <input value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="rp-input" />
            </Field>
            <Field label="State">
              <input value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                className="rp-input" />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <textarea rows={3} maxLength={1000}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="rp-input" placeholder="Why is this location unsafe? Observed patterns, time of day, near which institutions…" />
            </Field>
            <div className="md:col-span-2 text-xs text-muted-foreground">
              Coordinates: {form.latitude != null && form.longitude != null
                ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}`
                : "— click the map to set —"}
            </div>
            {err && <div className="md:col-span-2 text-sm text-red-600">{err}</div>}
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={saving}
                className="h-12 rounded-full bg-brand px-7 text-sm text-brand-foreground inline-flex items-center hover:bg-brand/90 disabled:opacity-60">
                {saving ? "Saving…" : "Save location"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="h-12 rounded-full border border-border px-7 text-sm hover:border-brand/40">
                Cancel
              </button>
            </div>
          </form>
        )}
      </Section>
    </PlatformShell>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      {children}
    </label>
  );
}
