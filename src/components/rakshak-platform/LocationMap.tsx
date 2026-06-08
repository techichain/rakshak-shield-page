import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  severity?: "low" | "medium" | "high" | "critical" | null;
  isFinal?: boolean;
}

interface Props {
  markers: MapMarker[];
  /** Show a crosshair and report clicks for picking a new location. */
  picker?: boolean;
  onPick?: (lat: number, lng: number) => void;
  onMarkerClick?: (id: string) => void;
  height?: string;
  /** Initial centre. Default = India centre. */
  center?: [number, number];
  zoom?: number;
}

const SEV_COLOR: Record<string, string> = {
  critical: "#F10015",
  high: "#C8201A",
  medium: "#C45D0A",
  low: "#1A6E3A",
};

function dotIcon(L: typeof Leaflet, color: string, isFinal: boolean) {
  const ring = isFinal ? "box-shadow:0 0 0 3px #4A35FF;" : "";
  return L.divIcon({
    className: "rp-loc-marker",
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid white;${ring}"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export function LocationMap({
  markers,
  picker = false,
  onPick,
  onMarkerClick,
  height = "420px",
  center = [22.5, 80.5],
  zoom = 5,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const pickerMarkerRef = useRef<Leaflet.Marker | null>(null);
  const onPickRef = useRef(onPick);
  const onMarkerClickRef = useRef(onMarkerClick);
  onPickRef.current = onPick;
  onMarkerClickRef.current = onMarkerClick;

  // init map
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    let disposed = false;
    (async () => {
      const L = await import("leaflet");
      if (disposed || !elRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(elRef.current, { zoomControl: true, attributionControl: false }).setView(center, zoom);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);

      if (picker) {
        map.on("click", (e: Leaflet.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          if (pickerMarkerRef.current) pickerMarkerRef.current.remove();
          pickerMarkerRef.current = L.marker([lat, lng], {
            icon: dotIcon(L, "#4A35FF", true),
          }).addTo(map);
          onPickRef.current?.(lat, lng);
        });
      }
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      pickerMarkerRef.current = null;
      leafletRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync markers
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const valid = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
    valid.forEach((m) => {
      const color = SEV_COLOR[m.severity ?? "medium"] ?? "#4A35FF";
      const marker = L.marker([m.lat, m.lng], { icon: dotIcon(L, color, !!m.isFinal) });
      const html = `<div style="font-family:system-ui;font-size:12px;min-width:180px">
        <div style="font-weight:600;margin-bottom:4px">${escapeHtml(m.title)}</div>
        ${m.subtitle ? `<div style="color:#666">${escapeHtml(m.subtitle)}</div>` : ""}
        ${m.severity ? `<div style="margin-top:4px;color:${color};font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:0.08em">${m.severity}</div>` : ""}
        ${m.isFinal ? `<div style="margin-top:4px;color:#4A35FF;font-weight:600">★ Final selected</div>` : ""}
      </div>`;
      marker.bindPopup(html, { closeButton: false, maxWidth: 240 });
      marker.on("mouseover", () => marker.openPopup());
      marker.on("click", () => onMarkerClickRef.current?.(m.id));
      marker.addTo(layer);
    });
    if (valid.length > 1) {
      const bounds = L.latLngBounds(valid.map((m) => [m.lat, m.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.2), { animate: false });
    } else if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], Math.max(map.getZoom(), 12), { animate: false });
    }
  }, [markers]);

  return <div ref={elRef} style={{ height, width: "100%", borderRadius: 16, overflow: "hidden" }} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
