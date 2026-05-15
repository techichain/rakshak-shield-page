import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const obsCore = {
  hotspot_id: z.string().uuid().nullable().optional(),
  surveyor_name: z.string().trim().max(120).nullable().optional(),
  gig_worker_id: z.string().trim().max(120).nullable().optional(),
  gps_lat: z.number().nullable().optional(),
  gps_lng: z.number().nullable().optional(),
  gps_accuracy_meters: z.number().nullable().optional(),
  gps_captured_at: z.string().nullable().optional(),
  road_env_type: z.enum(["intersection_signal","mid_road_no_signal","commercial_market","residential_lane","highway_arterial","restaurant_food_outlet","dark_store","mall_entrance","informal_rest_spot","petrol_pump","residential_society","highway_service_lane","other"]).nullable().optional(),
  road_env_type_other: z.string().trim().max(200).nullable().optional(),
  road_hazards: z.array(z.string().max(100)).max(20).optional(),
  vehicle_observed: z.boolean().optional(),
  vehicle_type: z.enum(["petrol_ice","ev_low_speed","ev_high_speed_green_plate","cng","not_visible"]).nullable().optional(),
  vehicle_brand_model: z.string().trim().max(120).nullable().optional(),
  consent_interview: z.enum(["yes","no","unclear"]).nullable().optional(),
  consent_screenshot: z.enum(["yes","no","unclear"]).nullable().optional(),
  consent_optional_items: z.array(z.string().max(120)).max(20).optional(),
  surveyor_rushed: z.enum(["yes","no","somewhat"]).nullable().optional(),
  surveyor_rushed_notes: z.string().trim().max(1000).nullable().optional(),
  surveyor_led: z.enum(["yes","no","unsure"]).nullable().optional(),
  surveyor_led_notes: z.string().trim().max(1000).nullable().optional(),
  surveyor_rating: z.enum(["satisfactory","needs_improvement","unacceptable"]).nullable().optional(),
  platform_gear: z.array(z.string().max(120)).max(20).optional(),
  platform_gear_other: z.string().trim().max(200).nullable().optional(),
  helmet_status: z.enum(["wearing_full_face","wearing_half_open_face","wearing_no_visor","carrying","not_wearing_not_carrying","cannot_observe"]).nullable().optional(),
  rider_engagement: z.enum(["actively_engaged","adequately_engaged","rushing_for_incentive","zoned_out_distracted","uncomfortable_resistant","going_through_motions"]).nullable().optional(),
  additional_notes: z.string().trim().max(2000).nullable().optional(),
  flagged: z.boolean().optional(),
  flag_reason: z.string().trim().max(500).nullable().optional(),
};

const saveSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  submit: z.boolean().optional(),
  ...obsCore,
});

async function ensureSurveyor(name: string | null | undefined): Promise<string | null> {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  const { data: existing } = await supabaseAdmin
    .from("surveyors").select("id").eq("name", trimmed).maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await supabaseAdmin
    .from("surveyors").insert({ name: trimmed }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

function validateForSubmit(data: z.infer<typeof saveSchema>): string | null {
  if (!data.hotspot_id) return "Hotspot is required";
  if (data.gps_lat == null || data.gps_lng == null) return "GPS location is required";
  if (!data.road_env_type) return "Road environment type is required";
  if (data.road_env_type === "other" && !data.road_env_type_other?.trim()) return "Specify the road environment";
  if (!data.surveyor_name?.trim()) return "Surveyor name is required";
  if (!data.consent_interview) return "Consent for interview is required";
  if (!data.consent_screenshot) return "Consent for screenshot is required";
  if (!data.surveyor_rushed) return "Was the surveyor rushed?";
  if (!data.surveyor_led) return "Did the surveyor lead the rider?";
  if (!data.surveyor_rating) return "Surveyor rating is required";
  if (!data.helmet_status) return "Helmet status is required";
  if (!data.rider_engagement) return "Rider engagement is required";
  if (data.flagged && !data.flag_reason?.trim()) return "Flag reason is required when flagged";
  return null;
}

export const listMyObservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("observations")
      .select("id, status, hotspot_id, started_at, submitted_at, updated_at, flagged")
      .eq("observer_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: hotspots } = await supabase.from("hotspots").select("id, name, city");
    const map = new Map((hotspots ?? []).map((h) => [h.id, h]));
    return (data ?? []).map((o) => ({
      ...o,
      hotspot: o.hotspot_id ? map.get(o.hotspot_id) ?? null : null,
    }));
  });

export const listLookups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: hotspots }, { data: surveyors }] = await Promise.all([
      supabase.from("hotspots").select("id, name, city, sublabel").eq("is_active", true).order("sort_order"),
      supabase.from("surveyors").select("id, name").eq("is_active", true).order("name"),
    ]);
    return { hotspots: hotspots ?? [], surveyors: surveyors ?? [] };
  });

export const getObservation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: obs, error } = await supabase
      .from("observations").select("*").eq("id", data.id).eq("observer_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!obs) return null;
    let surveyor_name: string | null = null;
    if (obs.surveyor_id) {
      const { data: s } = await supabase.from("surveyors").select("name").eq("id", obs.surveyor_id).maybeSingle();
      surveyor_name = s?.name ?? null;
    }
    const { data: photos } = await supabase
      .from("observation_photos").select("id, storage_path, file_name").eq("observation_id", data.id);
    return { ...obs, surveyor_name, photos: photos ?? [] };
  });

export const saveObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const submit = !!data.submit;
    if (submit) {
      const err = validateForSubmit(data);
      if (err) throw new Error(err);
    }
    const surveyor_id = await ensureSurveyor(data.surveyor_name);
    const payload = {
      observer_id: userId,
      hotspot_id: data.hotspot_id ?? null,
      surveyor_id,
      gig_worker_id: data.gig_worker_id ?? null,
      gps_lat: data.gps_lat ?? null,
      gps_lng: data.gps_lng ?? null,
      gps_accuracy_meters: data.gps_accuracy_meters ?? null,
      gps_captured_at: data.gps_captured_at ?? null,
      road_env_type: data.road_env_type ?? null,
      road_env_type_other: data.road_env_type_other ?? null,
      road_hazards: data.road_hazards ?? [],
      vehicle_observed: data.vehicle_observed ?? false,
      vehicle_type: data.vehicle_type ?? null,
      vehicle_brand_model: data.vehicle_brand_model ?? null,
      consent_interview: data.consent_interview ?? null,
      consent_screenshot: data.consent_screenshot ?? null,
      consent_optional_items: data.consent_optional_items ?? [],
      surveyor_rushed: data.surveyor_rushed ?? null,
      surveyor_rushed_notes: data.surveyor_rushed_notes ?? null,
      surveyor_led: data.surveyor_led ?? null,
      surveyor_led_notes: data.surveyor_led_notes ?? null,
      surveyor_rating: data.surveyor_rating ?? null,
      platform_gear: data.platform_gear ?? [],
      platform_gear_other: data.platform_gear_other ?? null,
      helmet_status: data.helmet_status ?? null,
      rider_engagement: data.rider_engagement ?? null,
      additional_notes: data.additional_notes ?? null,
      flagged: data.flagged ?? false,
      flag_reason: data.flag_reason ?? null,
      status: submit ? "submitted" as const : "draft" as const,
      submitted_at: submit ? new Date().toISOString() : null,
    };
    if (data.id) {
      const { data: updated, error } = await supabase
        .from("observations").update(payload).eq("id", data.id).eq("observer_id", userId).select("id").single();
      if (error) throw new Error(error.message);
      return { id: updated.id };
    }
    const { data: inserted, error } = await supabase
      .from("observations").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("observations").delete().eq("id", data.id).eq("observer_id", userId).eq("status", "draft");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    observation_id: z.string().uuid(),
    storage_path: z.string().min(1).max(500),
    file_name: z.string().min(1).max(255),
    mime_type: z.string().min(1).max(100),
    size_bytes: z.number().int().min(0).max(20 * 1024 * 1024),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: obs } = await supabase.from("observations").select("id").eq("id", data.observation_id).eq("observer_id", userId).maybeSingle();
    if (!obs) throw new Error("Observation not found");
    const { error } = await supabase.from("observation_photos").insert({
      observation_id: data.observation_id,
      storage_path: data.storage_path,
      file_name: data.file_name,
      mime_type: data.mime_type,
      size_bytes: data.size_bytes,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
