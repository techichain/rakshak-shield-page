import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
type PhotoContext = "road_environment" | "notes";
type ObservationPhoto = {
  id?: string;
  name: string;
  path: string;
  context: PhotoContext;
  url?: string | null;
};

const NO_ROAD_HAZARDS = "None visible";

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

export function ObservationForm({
  initial,
  initialPhotos = [],
  initialStatus = "draft",
}: {
  initial: ObsFormData;
  initialPhotos?: ObservationPhoto[];
  initialStatus?: string;
}) {
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
  const [photos, setPhotos] = useState<ObservationPhoto[]>(initialPhotos);
  const isDraftObservation = initialStatus !== "submitted" && initialStatus !== "reviewed";

  const draftKey = `gigrider:draft:${form.id ?? "new"}`;
  const sectionKey = `gigrider:draft-section:${form.id ?? "new"}`;
  const latestFormRef = useRef(form);
  const draftSavePromiseRef = useRef<Promise<string | null> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    latestFormRef.current = form;
  }, [form]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load lookups
  useEffect(() => { fetchLookups({}).then(setLookups).catch(() => {}); }, [fetchLookups]);

  // Hydrate unsaved draft progress from localStorage.
  useEffect(() => {
    if (!isDraftObservation) return;
    try {
      const cached = localStorage.getItem(draftKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setForm((f) => ({ ...f, ...parsed }));
        if (parsed.gps_lat != null) setGpsState("ok");
      }
      const cachedSection = localStorage.getItem(sectionKey);
      if (cachedSection != null) setSection(Math.min(SECTIONS.length - 1, Math.max(0, Number(cachedSection) || 0)));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (!isDraftObservation) return;
    try { localStorage.setItem(draftKey, JSON.stringify(form)); } catch { /* ignore */ }
  }, [form, draftKey, isDraftObservation]);

  useEffect(() => {
    if (!isDraftObservation) return;
    try { localStorage.setItem(sectionKey, String(section)); } catch { /* ignore */ }
  }, [section, sectionKey, isDraftObservation]);

  useEffect(() => {
    if (!isDraftObservation) return;
    const timer = window.setTimeout(() => {
      saveDraftSilently().catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, isDraftObservation]);

  // Attempt auto-capture once; if browser blocks without a user gesture,
  // the user can tap "Capture GPS" to trigger the permission pop-up.
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
      (err) => {
        setGpsState("failed");
        setGpsError(
          err.code === 1
            ? "Location permission denied. Tap 'Capture GPS' and allow access in the pop-up."
            : err.code === 2
            ? "Location unavailable. Move outdoors and tap 'Capture GPS' again."
            : err.code === 3
            ? "Location request timed out. Tap 'Capture GPS' to retry."
            : err.message,
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recapture = () => {
    setGpsError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsState("failed"); setGpsError("Geolocation not supported by this browser"); return;
    }
    setGpsState("capturing");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f, gps_lat: pos.coords.latitude, gps_lng: pos.coords.longitude,
          gps_accuracy_meters: pos.coords.accuracy, gps_captured_at: new Date().toISOString(),
        }));
        setGpsState("ok");
      },
      (err) => {
        setGpsState("failed");
        setGpsError(
          err.code === 1
            ? "Permission denied. Open browser site settings (lock icon → Permissions → Location), set to Allow, then tap 'Capture GPS' again."
            : err.code === 2
            ? "Location unavailable. Move outdoors or near a window and try again."
            : err.code === 3
            ? "Timed out getting location. Try again."
            : err.message,
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
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

  const toggleRoadHazard = (v: string) => {
    setForm((f) => {
      if (v === NO_ROAD_HAZARDS) {
        return { ...f, road_hazards: f.road_hazards.includes(NO_ROAD_HAZARDS) ? [] : [NO_ROAD_HAZARDS] };
      }
      const current = f.road_hazards.filter((x) => x !== NO_ROAD_HAZARDS);
      return { ...f, road_hazards: current.includes(v) ? current.filter((x) => x !== v) : [...current, v] };
    });
  };

  const validateClient = (f: ObsFormData): string | null => {
    if (!f.hotspot_id) return "Hotspot is required";
    if (f.gps_lat == null || f.gps_lng == null) return "GPS location is required";
    if (!f.road_env_type) return "Interview location is required";
    if (!f.road_hazards || f.road_hazards.length === 0) return "Select at least one road hazard (or 'None visible')";
    if (!f.surveyor_name?.trim()) return "Surveyor name is required";
    if (!f.consent_interview) return "Consent for interview is required";
    if (!f.consent_screenshot) return "Consent for screenshot is required";
    if (!f.surveyor_rushed) return "Was the surveyor rushed?";
    if (!f.surveyor_led) return "Did the surveyor lead the rider?";
    if (!f.surveyor_rating) return "Surveyor rating is required";
    if (!f.helmet_status) return "Helmet status is required";
    if (!f.rider_engagement) return "Rider engagement is required";
    if (!f.response_consistency) return "Response consistency is required";
    if ((f.response_consistency === "minor_doubts" || f.response_consistency === "strong_doubts") && !f.response_consistency_notes?.trim()) {
      return "Note briefly what didn't add up.";
    }
    if (f.flagged && !f.flag_reason?.trim()) return "Flag reason is required when flagged";
    return null;
  };

  const toSavePayload = (source: ObsFormData, asSubmit: boolean) => ({
    ...source,
    id: source.id ?? null,
    submit: asSubmit,
    surveyor_name: source.surveyor_name || null,
    gig_worker_id: source.gig_worker_id || null,
    road_env_type_other: source.road_env_type_other || null,
    vehicle_brand_model: source.vehicle_brand_model || null,
    consent_interview_notes: source.consent_interview_notes || null,
    consent_screenshot_notes: source.consent_screenshot_notes || null,
    surveyor_rushed_notes: source.surveyor_rushed_notes || null,
    surveyor_led_notes: source.surveyor_led_notes || null,
    platform_gear_other: source.platform_gear_other || null,
    response_consistency_notes: source.response_consistency_notes || null,
    additional_notes: source.additional_notes || null,
    flag_reason: source.flag_reason || null,
  });

  const saveDraftSilently = async (): Promise<string | null> => {
    if (draftSavePromiseRef.current) return draftSavePromiseRef.current;
    const run = (async () => {
      const latestForm = latestFormRef.current;
      const res = await save({ data: toSavePayload(latestForm, false) });
      if (!latestForm.id && res?.id) {
        latestFormRef.current = { ...latestFormRef.current, id: res.id };
        setForm((f) => ({ ...f, id: res.id }));
      }
      return res?.id ?? latestForm.id ?? null;
    })();
    draftSavePromiseRef.current = run;
    try {
      return await run;
    } finally {
      draftSavePromiseRef.current = null;
    }
  };

  const submit = async (asSubmit: boolean) => {
    setBusy(true); setError(null);
    const latestForm = latestFormRef.current;
    if (asSubmit) {
      const v = validateClient(latestForm);
      if (v) {
        setError(v);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
        setBusy(false);
        return null;
      }
    }
    try {
      const res = await save({ data: toSavePayload(latestForm, asSubmit) });
      if (asSubmit) {
        try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
        try { localStorage.removeItem(sectionKey); } catch { /* ignore */ }
        navigate({ to: "/gigrider-checklist/observer" });
      } else {
        if (!latestForm.id) {
          try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
          navigate({ to: "/gigrider-checklist/observer/$id", params: { id: res.id } });
        }
      }
      return res?.id ?? latestForm.id ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      return null;
    } finally { setBusy(false); }
  };

  // Silently create/update draft and return id, without navigating
  const ensureDraftId = async (): Promise<string | null> => {
    try {
      return await saveDraftSilently();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start draft");
      return null;
    }
  };

  const handlePhoto = async (file: File, context: PhotoContext) => {
    if (file.size > 20 * 1024 * 1024) {
      setError("Photo must be under 20MB."); return;
    }
    setUploading(true); setError(null);
    try {
      const obsId = await ensureDraftId();
      if (!obsId) return;
      const fallbackExt = file.type.includes("png") ? "png" : file.type.includes("heic") ? "heic" : "jpg";
      const ext = file.name.includes(".") ? file.name.split(".").pop() || fallbackExt : fallbackExt;
      const path = `${obsId}/${context}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("observation-photos").upload(path, file, {
        contentType: file.type || "image/jpeg", upsert: false,
      });
      if (upErr) throw upErr;
      await photoFn({ data: {
        observation_id: obsId, storage_path: path,
        file_name: (file.name || `photo-${new Date().toISOString()}.${ext}`).slice(0, 200),
        mime_type: file.type || "image/jpeg",
        size_bytes: file.size,
        photo_context: context,
      }});
      setPhotos((p) => [...p, { name: file.name || `Photo ${p.length + 1}`, path, context }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo upload failed");
    } finally { setUploading(false); }
  };

  const handlePhotos = async (files: FileList, context: PhotoContext) => {
    for (const f of Array.from(files)) {
      // eslint-disable-next-line no-await-in-loop
      await handlePhoto(f, context);
    }
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
        <div className="flex items-center justify-between text-xs gap-2">
          <Link to="/gigrider-checklist/observer" className="text-slate-600 hover:text-slate-900 font-medium shrink-0">
            ← Dashboard
          </Link>
          <span className="text-slate-500 truncate">{section + 1}/{SECTIONS.length} · {SECTIONS[section]}</span>
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
                  className={`text-sm font-semibold px-4 py-2 rounded-md text-white ${gpsState === "ok" ? "bg-emerald-600" : "bg-emerald-600 shadow-md"}`}>
                  {gpsState === "capturing" ? "Capturing…" : gpsState === "ok" ? "Re-capture GPS" : "📍 Capture GPS"}
                </button>
                {gpsState !== "ok" && (
                  <span className="text-xs text-slate-500">Your browser will ask for location permission.</span>
                )}
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
                values={form.road_hazards} onToggle={toggleRoadHazard}
                disabledValues={form.road_hazards.includes(NO_ROAD_HAZARDS) ? ROAD_HAZARDS.filter((h) => h !== NO_ROAD_HAZARDS) : []} />
            </Field>

            <Field label="Road environment photos (optional, 3–4 photos)">
              <PhotoPicker uploading={uploading} hasPhotos={photos.some((p) => p.context === "road_environment")}
                onFiles={(files) => handlePhotos(files, "road_environment")} idPrefix="road" />
              {photos.some((p) => p.context === "road_environment") && (
                <ul className="mt-2 text-xs text-emerald-700 space-y-0.5">
                  {photos.filter((p) => p.context === "road_environment").map((p, i) => (
                    <li key={p.path}>✓ {i + 1}. {p.name}</li>
                  ))}
                </ul>
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
              {(form.consent_interview === "no" || form.consent_interview === "unclear") && (
                <textarea value={form.consent_interview_notes} maxLength={1000} rows={2}
                  onChange={(e) => update("consent_interview_notes", e.target.value)}
                  placeholder="What happened? (e.g. rider declined, surveyor didn't ask clearly)"
                  className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              )}
            </Field>
            <Field label="Consent for screenshot *">
              <Segmented options={CONSENT.map((o) => ({ v: o.v, l: o.l }))}
                value={form.consent_screenshot} onChange={(v) => update("consent_screenshot", v)} />
              {(form.consent_screenshot === "no" || form.consent_screenshot === "unclear") && (
                <textarea value={form.consent_screenshot_notes} maxLength={1000} rows={2}
                  onChange={(e) => update("consent_screenshot_notes", e.target.value)}
                  placeholder="What happened? (e.g. rider declined, surveyor didn't ask clearly)"
                  className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              )}
            </Field>
            <Field label="Optional asks (surveyor must request once — rider may decline)">
              <Chips multi options={CONSENT_OPTIONAL.map((c) => ({ v: c, l: c }))}
                values={form.consent_optional_items} onToggle={(v) => toggleArr("consent_optional_items", v)} />
              <p className="text-xs text-slate-500 mt-1.5">Tick each one the surveyor actually asked for, regardless of whether the rider agreed.</p>
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
              {(form.surveyor_led === "yes" || form.surveyor_led === "unsure") && (
                <textarea value={form.surveyor_led_notes} maxLength={1000} rows={2}
                  onChange={(e) => update("surveyor_led_notes", e.target.value)}
                  placeholder={form.surveyor_led === "yes" ? "Describe how…" : "What made you unsure?"}
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
              <PlatformGearPicker
                gearOptions={PLATFORM_GEAR}
                platforms={PLATFORMS}
                values={form.platform_gear}
                onChange={(next) => update("platform_gear", next)}
              />
              {form.platform_gear.some((v) => v.startsWith("Other")) && (
                <input value={form.platform_gear_other} maxLength={200}
                  onChange={(e) => update("platform_gear_other", e.target.value)}
                  placeholder="Specify other gear…"
                  className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              )}
            </Field>
            <Field label="Helmet type / status *">
              <ChipGroup options={HELMET_STATUS.map((o) => ({ v: o.v, l: o.l }))}
                value={form.helmet_status} onChange={(v) => update("helmet_status", v)} />
              <p className="text-xs text-slate-500 mt-1.5">Riders typically remove helmets during the interview — record what you saw on arrival.</p>
            </Field>
          </Section>
        )}

        {section === 4 && (
          <Section title="Rider Engagement">
            <Field label="How would you describe the rider's engagement during the interview? *">
              <ChipGroup options={ENGAGEMENT.map((o) => ({ v: o.v, l: o.l }))}
                value={form.rider_engagement} onChange={(v) => update("rider_engagement", v)} />
            </Field>
            <Field label="Did the rider's responses seem internally consistent? *">
              <ChipGroup options={RESPONSE_CONSISTENCY.map((o) => ({ v: o.v, l: o.l }))}
                value={form.response_consistency} onChange={(v) => update("response_consistency", v)} />
              <p className="text-xs text-slate-500 mt-1.5">
                Quick logic checks — e.g. hours worked don't align with schedule mentioned, income figure doesn't match platform described, claims to work for a platform not operating in this area.
              </p>
              {(form.response_consistency === "minor_doubts" || form.response_consistency === "strong_doubts") && (
                <textarea value={form.response_consistency_notes} maxLength={1000} rows={2}
                  onChange={(e) => update("response_consistency_notes", e.target.value)}
                  placeholder="Note briefly what didn't add up."
                  className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              )}
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
              <PhotoPicker uploading={uploading} hasPhotos={photos.some((p) => p.context === "notes")}
                onFiles={(files) => handlePhotos(files, "notes")} idPrefix="notes" />
              {photos.some((p) => p.context === "notes") && (
                <ul className="mt-2 text-xs text-emerald-700 space-y-0.5">
                  {photos.filter((p) => p.context === "notes").map((p, i) => (
                    <li key={p.path}>✓ {i + 1}. {p.name}</li>
                  ))}
                </ul>
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

function Chips({ options, values, onToggle, disabledValues = [], multi }: {
  options: ReadonlyArray<{ v: string; l: string }>;
  values: string[]; onToggle: (v: string) => void; multi?: boolean;
  disabledValues?: ReadonlyArray<string>;
}) {
  void multi;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = values.includes(o.v);
        const disabled = disabledValues.includes(o.v) && !active;
        return (
          <button type="button" key={o.v} onClick={() => onToggle(o.v)} disabled={disabled}
            className={`px-3 py-1.5 text-sm rounded-full border transition ${
              active ? "bg-emerald-600 text-white border-emerald-600" : disabled ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
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

// Composite values stored as either "Gear" or "Gear|Platform"
function PlatformGearPicker({
  gearOptions, platforms, values, onChange,
}: {
  gearOptions: ReadonlyArray<string>;
  platforms: ReadonlyArray<string>;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const isGearActive = (g: string) => values.some((v) => v === g || v.startsWith(`${g}|`));
  const platformsForGear = (g: string) =>
    values.filter((v) => v.startsWith(`${g}|`)).map((v) => v.split("|")[1]);

  const toggleGear = (g: string) => {
    if (isGearActive(g)) {
      onChange(values.filter((v) => v !== g && !v.startsWith(`${g}|`)));
    } else {
      onChange([...values, g]);
    }
  };

  const togglePlatform = (g: string, p: string) => {
    const composite = `${g}|${p}`;
    if (values.includes(composite)) {
      const next = values.filter((v) => v !== composite);
      // if no platforms left for this gear, keep gear selected as bare
      const stillHasPlatform = next.some((v) => v.startsWith(`${g}|`));
      if (!stillHasPlatform && !next.includes(g)) next.push(g);
      onChange(next);
    } else {
      // add composite, remove bare gear marker if present
      onChange([...values.filter((v) => v !== g), composite]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {gearOptions.map((g) => {
          const active = isGearActive(g);
          return (
            <button type="button" key={g} onClick={() => toggleGear(g)}
              className={`px-3 py-1.5 text-sm rounded-full border transition ${
                active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
              }`}>{g}</button>
          );
        })}
      </div>
      {gearOptions.filter(isGearActive).map((g) => {
        const selected = platformsForGear(g);
        return (
          <div key={g} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-600 mb-1.5">{g} — which platform(s)?</p>
            <div className="flex flex-wrap gap-1.5">
              {platforms.map((p) => {
                const active = selected.includes(p);
                return (
                  <button type="button" key={p} onClick={() => togglePlatform(g, p)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition ${
                      active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                    }`}>{p}</button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


function PhotoPicker({
  uploading, hasPhotos, onFiles, idPrefix,
}: {
  uploading: boolean;
  hasPhotos: boolean;
  onFiles: (files: FileList) => void;
  idPrefix: string;
}) {
  const cameraId = `${idPrefix}-camera`;
  const galleryId = `${idPrefix}-gallery`;
  return (
    <div className="flex flex-wrap gap-2">
      <label htmlFor={cameraId}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-md text-sm font-medium bg-white hover:bg-slate-50 cursor-pointer">
        📷 {uploading ? "Uploading…" : "Take photo"}
        <input id={cameraId} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const fs = e.target.files; if (fs?.length) onFiles(fs); e.target.value = ""; }} />
      </label>
      <label htmlFor={galleryId}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-md text-sm font-medium bg-white hover:bg-slate-50 cursor-pointer">
        🖼️ {hasPhotos ? "Add from gallery" : "Choose from gallery"}
        <input id={galleryId} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { const fs = e.target.files; if (fs?.length) onFiles(fs); e.target.value = ""; }} />
      </label>
    </div>
  );
}
