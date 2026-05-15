import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listLookups, saveObservation, deleteDraft, recordPhoto,
} from "@/lib/gigrider/observations.functions";
import {
  ROAD_ENV, ROAD_HAZARDS, VEHICLE_TYPE, CONSENT, CONSENT_OPTIONAL,
  RUSHED, LED, RATING, PLATFORM_GEAR, PLATFORMS, HELMET_STATUS, ENGAGEMENT,
  RESPONSE_CONSISTENCY,
} from "@/lib/gigrider/constants";

type Lookups = Awaited<ReturnType<typeof listLookups>>;

export type ObsFormData = {
  id?: string | null;
  hotspot_id: string | null;
  surveyor_name: string;
  gig_worker_id: string;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy_meters: number | null;
  gps_captured_at: string | null;
  road_env_type: string | null;
  road_env_type_other: string;
  road_hazards: string[];
  vehicle_observed: boolean;
  vehicle_type: string | null;
  vehicle_brand_model: string;
  consent_interview: string | null;
  consent_interview_notes: string;
  consent_screenshot: string | null;
  consent_screenshot_notes: string;
  consent_optional_items: string[];
  surveyor_rushed: string | null;
  surveyor_rushed_notes: string;
  surveyor_led: string | null;
  surveyor_led_notes: string;
  surveyor_rating: string | null;
  platform_gear: string[];
  platform_gear_other: string;
  helmet_status: string | null;
  rider_engagement: string | null;
  response_consistency: string | null;
  response_consistency_notes: string;
  additional_notes: string;
  flagged: boolean;
  flag_reason: string;
};

export const emptyForm: ObsFormData = {
  id: null,
  hotspot_id: null, surveyor_name: "", gig_worker_id: "",
  gps_lat: null, gps_lng: null, gps_accuracy_meters: null, gps_captured_at: null,
  road_env_type: null, road_env_type_other: "", road_hazards: [],
  vehicle_observed: false, vehicle_type: null, vehicle_brand_model: "",
  consent_interview: null, consent_interview_notes: "",
  consent_screenshot: null, consent_screenshot_notes: "",
  consent_optional_items: [],
  surveyor_rushed: null, surveyor_rushed_notes: "",
  surveyor_led: null, surveyor_led_notes: "",
  surveyor_rating: null,
  platform_gear: [], platform_gear_other: "",
  helmet_status: null, rider_engagement: null,
  response_consistency: null, response_consistency_notes: "",
  additional_notes: "", flagged: false, flag_reason: "",
};

const SECTIONS = [
  "Location & Vehicle", "Surveyor & Consent", "Surveyor Conduct",
  "Rider Gear & Helmet", "Rider Engagement", "Notes & Photos",
];

export function ObservationForm({ initial }: { initial: ObsFormData }) {
  const navigate = useNavigate();
  const fetchLookups = useServerFn(listLookups);
  const save = useServerFn(saveObservation);
  const del = useServerFn(deleteDraft);
  const photoFn = useServerFn(recordPhoto);

  const [form, setForm] = useState<ObsFormData>(initial);
  const [section, setSection] = useState(0);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [gpsState, setGpsState] = useState<"idle"|"capturing"|"ok"|"failed">(form.gps_lat != null ? "ok" : "idle");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const draftKey = `gigrider:draft:${form.id ?? "new"}`;

  // Load lookups
  useEffect(() => { fetchLookups({}).then(setLookups).catch(() => {}); }, [fetchLookups]);

  // Hydrate from localStorage if no id (new draft)
  useEffect(() => {
    if (form.id) return;
    try {
      const cached = localStorage.getItem(draftKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setForm((f) => ({ ...f, ...parsed }));
        if (parsed.gps_lat != null) setGpsState("ok");
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify(form)); } catch { /* ignore */ }
  }, [form, draftKey]);

  // Auto-capture GPS
  useEffect(() => {
    if (form.gps_lat != null) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsState("failed"); setGpsError("Geolocation not supported"); return;
    }
    setGpsState("capturing");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          gps_lat: pos.coords.latitude,
          gps_lng: pos.coords.longitude,
          gps_accuracy_meters: pos.coords.accuracy,
          gps_captured_at: new Date().toISOString(),
        }));
        setGpsState("ok");
      },
      (err) => { setGpsState("failed"); setGpsError(err.message); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recapture = () => {
    setGpsError(null);
    if (!navigator.geolocation) return;
    setGpsState("capturing");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f, gps_lat: pos.coords.latitude, gps_lng: pos.coords.longitude,
          gps_accuracy_meters: pos.coords.accuracy, gps_captured_at: new Date().toISOString(),
        }));
        setGpsState("ok");
      },
      (err) => { setGpsState("failed"); setGpsError(err.message); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const update = <K extends keyof ObsFormData>(k: K, v: ObsFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleArr = (k: "road_hazards"|"consent_optional_items"|"platform_gear", v: string) => {
    setForm((f) => {
      const arr = f[k];
      return { ...f, [k]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
    });
  };

  const submit = async (asSubmit: boolean) => {
    setBusy(true); setError(null);
    try {
      const payload = {
        ...form,
        id: form.id ?? null,
        submit: asSubmit,
        surveyor_name: form.surveyor_name || null,
        gig_worker_id: form.gig_worker_id || null,
        road_env_type_other: form.road_env_type_other || null,
        vehicle_brand_model: form.vehicle_brand_model || null,
        consent_interview_notes: form.consent_interview_notes || null,
        consent_screenshot_notes: form.consent_screenshot_notes || null,
        surveyor_rushed_notes: form.surveyor_rushed_notes || null,
        surveyor_led_notes: form.surveyor_led_notes || null,
        platform_gear_other: form.platform_gear_other || null,
        response_consistency_notes: form.response_consistency_notes || null,
        additional_notes: form.additional_notes || null,
        flag_reason: form.flag_reason || null,
      };
      const res = await save({ data: payload });
      if (asSubmit) {
        try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
        navigate({ to: "/gigrider-checklist/observer" });
      } else {
        if (!form.id) {
          try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
          navigate({ to: "/gigrider-checklist/observer/$id", params: { id: res.id } });
        }
      }
      return res?.id ?? form.id ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return null;
    } finally { setBusy(false); }
  };

  // Silently create/update draft and return id, without navigating
  const ensureDraftId = async (): Promise<string | null> => {
    if (form.id) return form.id;
    try {
      const payload = {
        ...form,
        id: null,
        submit: false,
        surveyor_name: form.surveyor_name || null,
        gig_worker_id: form.gig_worker_id || null,
        road_env_type_other: form.road_env_type_other || null,
        vehicle_brand_model: form.vehicle_brand_model || null,
        consent_interview_notes: form.consent_interview_notes || null,
        consent_screenshot_notes: form.consent_screenshot_notes || null,
        surveyor_rushed_notes: form.surveyor_rushed_notes || null,
        surveyor_led_notes: form.surveyor_led_notes || null,
        platform_gear_other: form.platform_gear_other || null,
        response_consistency_notes: form.response_consistency_notes || null,
        additional_notes: form.additional_notes || null,
        flag_reason: form.flag_reason || null,
      };
      const res = await save({ data: payload });
      setForm((f) => ({ ...f, id: res.id }));
      return res.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start draft");
      return null;
    }
  };

  const handlePhoto = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setError("Photo must be under 20MB."); return;
    }
    setUploading(true); setError(null);
    try {
      const obsId = await ensureDraftId();
      if (!obsId) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${obsId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("observation-photos").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      await photoFn({ data: {
        observation_id: obsId, storage_path: path,
        file_name: file.name.slice(0, 200), mime_type: file.type || "image/jpeg",
        size_bytes: file.size,
      }});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo upload failed");
    } finally { setUploading(false); }
  };

  const discardDraft = async () => {
    if (!confirm("Discard this draft?")) return;
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    if (form.id) await del({ data: { id: form.id } }).catch(() => {});
    navigate({ to: "/gigrider-checklist/observer" });
  };

  return (
    <div className="pb-32">
      {/* Progress */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 sticky top-[57px] z-10">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">{section + 1} of {SECTIONS.length}</span>
          <span className="text-slate-500 truncate ml-2">{SECTIONS[section]}</span>
          <GpsBadge state={gpsState} />
        </div>
        <div className="mt-1.5 flex gap-1">
          {SECTIONS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= section ? "bg-emerald-500" : "bg-slate-200"}`} />
          ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        {section === 0 && (
          <Section title="Location & Vehicle">
            <Field label="Hotspot *">
              <select
                value={form.hotspot_id ?? ""} onChange={(e) => update("hotspot_id", e.target.value || null)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
              >
                <option value="">Select hotspot…</option>
                {(lookups?.hotspots ?? []).map((h) => (
                  <option key={h.id} value={h.id}>{h.city} — {h.name}</option>
                ))}
              </select>
            </Field>

            <Field label="GPS location *">
              {gpsState === "ok" && form.gps_lat != null ? (
                <div className="text-sm text-slate-700">
                  {form.gps_lat.toFixed(5)}, {form.gps_lng?.toFixed(5)}
                  {form.gps_accuracy_meters != null && <span className="text-slate-400"> · ±{Math.round(form.gps_accuracy_meters)}m</span>}
                </div>
              ) : gpsState === "capturing" ? (
                <p className="text-sm text-slate-500">Capturing GPS…</p>
              ) : (
                <div className="text-sm text-red-600">
                  <p>{gpsError ?? "Not captured"}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    If you denied location, allow it in your browser site settings (lock icon → Permissions → Location), then tap Re-capture. Or enter coordinates manually below.
                  </p>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <button type="button" onClick={recapture}
                  className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-600 text-white">
                  Re-capture GPS
                </button>
              </div>
              {gpsState !== "ok" && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input type="number" step="any" placeholder="Latitude"
                    value={form.gps_lat ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      setForm((f) => ({ ...f, gps_lat: v, gps_captured_at: new Date().toISOString() }));
                      if (v != null && form.gps_lng != null) setGpsState("ok");
                    }}
                    className="px-2 py-1.5 border border-slate-300 rounded-md text-sm" />
                  <input type="number" step="any" placeholder="Longitude"
                    value={form.gps_lng ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      setForm((f) => ({ ...f, gps_lng: v, gps_captured_at: new Date().toISOString() }));
                      if (v != null && form.gps_lat != null) setGpsState("ok");
                    }}
                    className="px-2 py-1.5 border border-slate-300 rounded-md text-sm" />
                </div>
              )}
            </Field>

            <Field label="Where is the interview taking place? *">
              <ChipGroup options={ROAD_ENV.map((o) => ({ v: o.v, l: o.l }))}
                value={form.road_env_type} onChange={(v) => update("road_env_type", v)} />
              {form.road_env_type === "other" && (
                <input value={form.road_env_type_other} maxLength={200}
                  onChange={(e) => update("road_env_type_other", e.target.value)}
                  placeholder="Specify…" className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              )}
            </Field>

            <Field label="What road hazards are visible nearby? * (select at least one)">
              <Chips multi options={ROAD_HAZARDS.map((h) => ({ v: h, l: h }))}
                values={form.road_hazards} onToggle={(v) => toggleArr("road_hazards", v)} />
            </Field>

            <Field label="Road environment photos (optional, 3–4 photos)">
              {!form.id ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  Save draft first to attach photos.
                </p>
              ) : (
                <label className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-md text-sm font-medium bg-white hover:bg-slate-50 cursor-pointer">
                  📷 {uploading ? "Uploading…" : "Add road photo"}
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.target.value = ""; }} />
                </label>
              )}
              <p className="text-xs text-slate-500 mt-1.5 leading-snug">
                Take 3–4 photos facing different directions around you — front, back, left, right. Capture what the road and surroundings look like. You can do this during the first few intro questions with the rider.
              </p>
            </Field>

            <Field label="Vehicle observed?">
              <Segmented options={[{v:"yes",l:"Yes"},{v:"no",l:"No"}]}
                value={form.vehicle_observed ? "yes" : "no"}
                onChange={(v) => update("vehicle_observed", v === "yes")} />
            </Field>

            {form.vehicle_observed && (
              <>
                <Field label="Vehicle type">
                  <ChipGroup options={VEHICLE_TYPE.map((o) => ({ v: o.v, l: o.l }))}
                    value={form.vehicle_type} onChange={(v) => update("vehicle_type", v)} />
                </Field>
                <Field label="Brand / model (optional)">
                  <input value={form.vehicle_brand_model} maxLength={120}
                    onChange={(e) => update("vehicle_brand_model", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
                </Field>
              </>
            )}
          </Section>
        )}

        {section === 1 && (
          <Section title="Surveyor & Consent">
            <Field label="Surveyor name *">
              <input value={form.surveyor_name} maxLength={120} list="surveyor-list"
                onChange={(e) => update("surveyor_name", e.target.value)}
                placeholder="e.g. Priya Sharma"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              <datalist id="surveyor-list">
                {(lookups?.surveyors ?? []).map((s) => <option key={s.id} value={s.name} />)}
              </datalist>
            </Field>
            <Field label="Gig worker ID (if known)">
              <input value={form.gig_worker_id} maxLength={120}
                onChange={(e) => update("gig_worker_id", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
            </Field>
            <Field label="Consent for interview *">
              <Segmented options={CONSENT.map((o) => ({ v: o.v, l: o.l }))}
                value={form.consent_interview} onChange={(v) => update("consent_interview", v)} />
            </Field>
            <Field label="Consent for screenshot *">
              <Segmented options={CONSENT.map((o) => ({ v: o.v, l: o.l }))}
                value={form.consent_screenshot} onChange={(v) => update("consent_screenshot", v)} />
            </Field>
            <Field label="Optional consent steps observed">
              <Chips multi options={CONSENT_OPTIONAL.map((c) => ({ v: c, l: c }))}
                values={form.consent_optional_items} onToggle={(v) => toggleArr("consent_optional_items", v)} />
            </Field>
          </Section>
        )}

        {section === 2 && (
          <Section title="Surveyor Conduct">
            <Field label="Was the surveyor rushed? *">
              <Segmented options={RUSHED.map((o) => ({ v: o.v, l: o.l }))}
                value={form.surveyor_rushed} onChange={(v) => update("surveyor_rushed", v)} />
              {(form.surveyor_rushed === "yes" || form.surveyor_rushed === "somewhat") && (
                <textarea value={form.surveyor_rushed_notes} maxLength={1000} rows={2}
                  onChange={(e) => update("surveyor_rushed_notes", e.target.value)}
                  placeholder="What did you observe?"
                  className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              )}
            </Field>
            <Field label="Did the surveyor lead the rider's answers? *">
              <Segmented options={LED.map((o) => ({ v: o.v, l: o.l }))}
                value={form.surveyor_led} onChange={(v) => update("surveyor_led", v)} />
              {form.surveyor_led === "yes" && (
                <textarea value={form.surveyor_led_notes} maxLength={1000} rows={2}
                  onChange={(e) => update("surveyor_led_notes", e.target.value)}
                  placeholder="Describe…"
                  className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              )}
            </Field>
            <Field label="Overall surveyor rating *">
              <ChipGroup options={RATING.map((o) => ({ v: o.v, l: o.l }))}
                value={form.surveyor_rating} onChange={(v) => update("surveyor_rating", v)} />
            </Field>
          </Section>
        )}

        {section === 3 && (
          <Section title="Rider Gear & Helmet">
            <Field label="Platform gear visible (multi-select)">
              <Chips multi options={PLATFORM_GEAR.map((g) => ({ v: g, l: g }))}
                values={form.platform_gear} onToggle={(v) => toggleArr("platform_gear", v)} />
              {form.platform_gear.includes("Other") && (
                <input value={form.platform_gear_other} maxLength={200}
                  onChange={(e) => update("platform_gear_other", e.target.value)}
                  placeholder="Specify…"
                  className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              )}
            </Field>
            <Field label="Helmet status *">
              <ChipGroup options={HELMET_STATUS.map((o) => ({ v: o.v, l: o.l }))}
                value={form.helmet_status} onChange={(v) => update("helmet_status", v)} />
            </Field>
          </Section>
        )}

        {section === 4 && (
          <Section title="Rider Engagement">
            <Field label="How was the rider engaging? *">
              <ChipGroup options={ENGAGEMENT.map((o) => ({ v: o.v, l: o.l }))}
                value={form.rider_engagement} onChange={(v) => update("rider_engagement", v)} />
            </Field>
          </Section>
        )}

        {section === 5 && (
          <Section title="Notes & Photos">
            <Field label="Additional notes">
              <textarea value={form.additional_notes} maxLength={2000} rows={4}
                onChange={(e) => update("additional_notes", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
            </Field>
            <Field label="Photos">
              {!form.id && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">Save draft first to attach photos.</p>}
              {form.id && (
                <label className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-md text-sm font-medium bg-white hover:bg-slate-50 cursor-pointer">
                  📷 {uploading ? "Uploading…" : "Add photo"}
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.target.value = ""; }} />
                </label>
              )}
            </Field>
            <Field label="Flag this observation for admin review?">
              <Segmented options={[{v:"no",l:"No"},{v:"yes",l:"Yes"}]}
                value={form.flagged ? "yes" : "no"}
                onChange={(v) => update("flagged", v === "yes")} />
              {form.flagged && (
                <textarea value={form.flag_reason} maxLength={500} rows={2}
                  onChange={(e) => update("flag_reason", e.target.value)}
                  placeholder="Reason for flagging *"
                  className="mt-2 w-full px-3 py-2 border border-red-300 rounded-md text-sm" />
              )}
            </Field>
          </Section>
        )}

        {/* Section nav */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <button type="button" onClick={() => setSection((s) => Math.max(0, s - 1))}
            disabled={section === 0}
            className="px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-30">
            ← Previous
          </button>
          {section < SECTIONS.length - 1 ? (
            <button type="button" onClick={() => setSection((s) => s + 1)}
              className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-md">
              Next →
            </button>
          ) : (
            <button type="button" onClick={() => submit(true)} disabled={busy}
              className="px-5 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-md disabled:opacity-50">
              {busy ? "Submitting…" : "Submit observation"}
            </button>
          )}
        </div>
      </main>

      {/* Sticky footer */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-2">
        <button type="button" onClick={discardDraft}
          className="text-sm text-red-600 hover:underline">Discard</button>
        <button type="button" onClick={() => submit(false)} disabled={busy}
          className="px-4 py-2 text-sm font-semibold border border-emerald-600 text-emerald-700 rounded-md disabled:opacity-50">
          {busy ? "Saving…" : "Save draft"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function GpsBadge({ state }: { state: "idle"|"capturing"|"ok"|"failed" }) {
  const map = {
    idle: { l: "GPS …", c: "bg-slate-100 text-slate-600" },
    capturing: { l: "GPS…", c: "bg-blue-100 text-blue-700" },
    ok: { l: "GPS ✓", c: "bg-emerald-100 text-emerald-800" },
    failed: { l: "GPS ✕", c: "bg-red-100 text-red-700" },
  } as const;
  const { l, c } = map[state];
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${c}`}>{l}</span>;
}

function ChipGroup({ options, value, onChange }: {
  options: ReadonlyArray<{ v: string; l: string }>;
  value: string | null; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button type="button" key={o.v} onClick={() => onChange(o.v)}
            className={`px-3 py-1.5 text-sm rounded-full border transition ${
              active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
            }`}>{o.l}</button>
        );
      })}
    </div>
  );
}

function Chips({ options, values, onToggle, multi }: {
  options: ReadonlyArray<{ v: string; l: string }>;
  values: string[]; onToggle: (v: string) => void; multi?: boolean;
}) {
  void multi;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = values.includes(o.v);
        return (
          <button type="button" key={o.v} onClick={() => onToggle(o.v)}
            className={`px-3 py-1.5 text-sm rounded-full border transition ${
              active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
            }`}>{o.l}</button>
        );
      })}
    </div>
  );
}

function Segmented({ options, value, onChange }: {
  options: ReadonlyArray<{ v: string; l: string }>;
  value: string | boolean | null; onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-0.5">
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button type="button" key={o.v} onClick={() => onChange(o.v)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}>{o.l}</button>
        );
      })}
    </div>
  );
}


