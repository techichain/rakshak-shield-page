import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getObservation } from "@/lib/gigrider/observations.functions";
import { ObservationForm, emptyForm, type ObsFormData } from "@/components/gigrider/ObservationForm";

export const Route = createFileRoute("/gigrider-checklist/observer/$id")({
  component: EditObservation,
});

function EditObservation() {
  const { id } = Route.useParams();
  const fetchOne = useServerFn(getObservation);
  const [initial, setInitial] = useState<ObsFormData | null>(null);
  const [initialPhotos, setInitialPhotos] = useState<any[]>([]);
  const [initialStatus, setInitialStatus] = useState("draft");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOne({ data: { id } })
      .then((o) => {
        if (!o) { setError("Observation not found"); return; }
        setInitial({
          ...emptyForm,
          id: o.id,
          hotspot_id: o.hotspot_id,
          surveyor_name: o.surveyor_name ?? "",
          gig_worker_id: o.gig_worker_id ?? "",
          gps_lat: o.gps_lat != null ? Number(o.gps_lat) : null,
          gps_lng: o.gps_lng != null ? Number(o.gps_lng) : null,
          gps_accuracy_meters: o.gps_accuracy_meters,
          gps_captured_at: o.gps_captured_at,
          road_env_type: o.road_env_type,
          road_env_type_other: o.road_env_type_other ?? "",
          road_hazards: o.road_hazards ?? [],
          vehicle_observed: o.vehicle_observed ?? false,
          vehicle_type: o.vehicle_type,
          vehicle_brand_model: o.vehicle_brand_model ?? "",
          consent_interview: o.consent_interview,
          consent_screenshot: o.consent_screenshot,
          consent_optional_items: o.consent_optional_items ?? [],
          surveyor_rushed: o.surveyor_rushed,
          surveyor_rushed_notes: o.surveyor_rushed_notes ?? "",
          surveyor_led: o.surveyor_led,
          surveyor_led_notes: o.surveyor_led_notes ?? "",
          surveyor_rating: o.surveyor_rating,
          platform_gear: o.platform_gear ?? [],
          platform_gear_other: o.platform_gear_other ?? "",
          helmet_status: o.helmet_status,
          rider_engagement: o.rider_engagement,
          additional_notes: o.additional_notes ?? "",
          flagged: o.flagged ?? false,
          flag_reason: o.flag_reason ?? "",
        });
        const photos = (o.photos ?? []).map((p: any) => ({
          id: p.id,
          name: p.file_name,
          path: p.storage_path,
          context: p.photo_context ?? "road_environment",
        }));
        setInitialPhotos(photos);
        setInitialStatus(o.status ?? "draft");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [id, fetchOne]);

  if (error) return <main className="max-w-2xl mx-auto p-6"><p className="text-sm text-red-600">{error}</p></main>;
  if (!initial) return <main className="max-w-2xl mx-auto p-6"><p className="text-sm text-slate-500">Loading…</p></main>;
  return <ObservationForm initial={initial} initialPhotos={initialPhotos} initialStatus={initialStatus} />;
}
