import { useCallback, useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import type { Location } from "./types";
import { LOC, RC, RL, ST, SB, GEO_NAME_MAP } from "./data";
import { report } from "@/lib/client-error-reporter";

interface Props {
  visibleIds: Set<number>;
  onSelect: (id: number) => void;
  /** Imperative-style callback registration for parent to trigger zooms */
  registerApi: (api: { zoomToState: (s: string) => void; resetIndia: () => void }) => void;
}

const GEO_URLS = [
  "https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/e388c4cae20aa53cb5090210a42ebb9b765c0a36/india_states.geojson",
  "https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson",
  "https://raw.githubusercontent.com/datameet/maps/master/States/India_State_Boundary.geojson",
];

function makeIcon(L: typeof Leaflet, risk: Location["risk"]) {
  return L.divIcon({
    className: "rk-marker",
    html: `<span class="rk-marker-dot" style="background:${RC[risk]}"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -13],
  });
}

export function MapView({ visibleIds, onSelect, registerApi }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markersRef = useRef<Record<number, { m: Leaflet.Marker; vis: boolean }>>({});
  const indiaGeoRef = useRef<Leaflet.GeoJSON | null>(null);
  const stateLayerMapRef = useRef<Record<string, Leaflet.Layer[]>>({});
  const loadGeoRef = useRef<((signal?: AbortSignal) => Promise<void>) | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [geoStatus, setGeoStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [geoError, setGeoError] = useState<string | null>(null);


  // Init map once
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let disposed = false;
    const geoCtl = new AbortController();


    (async () => {
      const L = await import("leaflet");
      if (disposed || !mapEl.current || mapRef.current) return;
      leafletRef.current = L;

      const map = L.map(mapEl.current, {
      zoomControl: true,
      minZoom: 4,
      maxZoom: 14,
      attributionControl: false,
    }).setView([22.5, 80.5], 5);
    map.setMaxBounds([
      [2, 60],
      [40, 102],
    ]);
    mapRef.current = map;

    // Markers
    LOC.forEach((loc) => {
      const m = L.marker([loc.lat, loc.lng], { icon: makeIcon(L, loc.risk), riseOnHover: true }).addTo(map);
      const s = ST[loc.status];
      const popupHtml = `<div class="map-tip" data-loc-id="${loc.id}">
        <div class="mt-name">${loc.n}</div>
        <div class="mt-city">${loc.ci}, ${loc.st}</div>
        <div class="mt-risk" style="background:${
          loc.risk === "high" ? "var(--high-bg)" : loc.risk === "medium" ? "var(--med-bg)" : "var(--low-bg)"
        };color:${RC[loc.risk]}">${RL[loc.risk]}</div>
        <div class="mt-status" style="color:${s.c}">${s.i} ${s.l}</div>
        <div class="mt-cta">Click to view full audit →</div>
      </div>`;
      m.bindPopup(popupHtml, { closeButton: false, maxWidth: 200 });
      m.on("click", () => {
        map.closePopup();
        onSelectRef.current(loc.id);
        zoomToState(loc.st);
      });
      m.on("popupopen", (e) => {
        const node = (e.popup.getElement() as HTMLElement | null)?.querySelector(".map-tip");
        if (node) {
          (node as HTMLElement).style.cursor = "pointer";
          node.addEventListener("click", () => {
            onSelectRef.current(loc.id);
            map.closePopup();
          });
        }
      });
      m.on("mouseover", () => m.openPopup());
      m.on("mouseout", () => m.closePopup());
      markersRef.current[loc.id] = { m, vis: true };
    });

    // India GeoJSON loader (with multi-URL fallback + retry support)
    const loadGeo = async (signal?: AbortSignal) => {
      setGeoStatus("loading");
      setGeoError(null);
      const errs: string[] = [];
      for (const url of GEO_URLS) {
        try {
          const r = await fetch(url, { signal });
          if (!r.ok) { errs.push(`${url} → HTTP ${r.status}`); continue; }
          const data = await r.json();
          if (!data?.features?.length) { errs.push(`${url} → empty features`); continue; }
          if (signal?.aborted) return;
          renderIndia(data);
          setGeoStatus("loaded");
          return;
        } catch (e) {
          if ((e as any)?.name === "AbortError") return;
          errs.push(`${url} → ${(e as Error).message}`);
        }
      }
      const msg = errs.join(" | ");
      report("geojson-fetch-failed", new Error(msg));
      setGeoError(msg);
      setGeoStatus("failed");
    };
    loadGeoRef.current = loadGeo;
    const geoCtl = new AbortController();
    loadGeo(geoCtl.signal);



    function renderIndia(data: any) {
      if (!mapRef.current) return;
      const sample = data.features[0].properties;
      const prop = sample.ST_NM ? "ST_NM" : sample.NAME_1 ? "NAME_1" : "name";
      const geo = L.geoJSON(data, {
        style: { fillColor: "#EDE8DE", fillOpacity: 1, color: "#BEB8AE", weight: 1.2, opacity: 1 },
        onEachFeature: (f, layer) => {
          const raw = f.properties[prop] || "";
          const name = GEO_NAME_MAP[raw] || raw;
          if (!stateLayerMapRef.current[name]) stateLayerMapRef.current[name] = [];
          stateLayerMapRef.current[name].push(layer);
          layer.on("mouseover", () =>
            (layer as L.Path).setStyle({ fillColor: "#DDD7C8", fillOpacity: 1 })
          );
          layer.on("mouseout", () =>
            (layer as L.Path).setStyle({ fillColor: "#EDE8DE", fillOpacity: 1 })
          );
        },
      });
      indiaGeoRef.current = geo;
      geo.addTo(mapRef.current);
      // Bring markers above
      Object.values(markersRef.current).forEach((mk) => mk.m.addTo(mapRef.current!));
      mapRef.current.flyToBounds(geo.getBounds().pad(0.02), { duration: 0.8, easeLinearity: 0.5 });
    }

    function resetIndia() {
      const opts = { duration: 0.9, easeLinearity: 0.5 };
      if (indiaGeoRef.current) mapRef.current!.flyToBounds(indiaGeoRef.current.getBounds().pad(0.02), opts);
      else
        mapRef.current!.flyToBounds(
          [
            [6.5, 68],
            [37, 97.5],
          ],
          opts
        );
    }

    function zoomToState(name: string) {
      const opts = { duration: 0.85, easeLinearity: 0.5 };
      if (!name || name === "all") return resetIndia();
      const layers = stateLayerMapRef.current[name];
      if (layers?.length) {
        mapRef.current!.flyToBounds(L.featureGroup(layers).getBounds().pad(0.12), opts);
      } else if (SB[name]) {
        mapRef.current!.flyToBounds(L.latLngBounds(SB[name]).pad(0.1), opts);
      } else {
        const pts = LOC.filter((l) => l.st === name).map((l) => [l.lat, l.lng] as [number, number]);
        if (pts.length) mapRef.current!.flyToBounds(L.latLngBounds(pts).pad(0.35), opts);
      }
    }

    registerApi({ zoomToState, resetIndia });
    })();

    return () => {
      disposed = true;
      geoCtl.abort();
      loadGeoRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markersRef.current = {};
      indiaGeoRef.current = null;
      stateLayerMapRef.current = {};
    };
  }, [registerApi]);

  // Toggle marker visibility on filter changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    LOC.forEach((loc) => {
      const mk = markersRef.current[loc.id];
      if (!mk) return;
      const shouldShow = visibleIds.has(loc.id);
      if (shouldShow && !mk.vis) {
        mk.m.addTo(map);
        mk.vis = true;
      } else if (!shouldShow && mk.vis) {
        map.removeLayer(mk.m);
        mk.vis = false;
      }
    });
  }, [visibleIds]);

  return (
    <div className="map-wrap">
      <div id="map" ref={mapEl} />
      {geoStatus === "loading" && (
        <div className="map-loading">🗺️ Loading India map…</div>
      )}
      {geoStatus === "failed" && (
        <div
          className="map-loading"
          role="alert"
          style={{ textAlign: "center", maxWidth: 320, lineHeight: 1.4 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            Couldn't load the India map outline
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>
            Markers are still usable. Check your connection and retry.
          </div>
          <button
            type="button"
            onClick={() => loadGeoRef.current?.()}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid currentColor",
              background: "transparent",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Retry
          </button>
          {geoError && import.meta.env.DEV && (
            <pre
              style={{
                marginTop: 10,
                fontSize: 10,
                opacity: 0.7,
                whiteSpace: "pre-wrap",
                textAlign: "left",
              }}
            >
              {geoError}
            </pre>
          )}
        </div>
      )}
      <button
        className="map-reset"
        onClick={() => {
          // call via registered api side-effect: trigger fresh reset
          const opts = { duration: 0.9, easeLinearity: 0.5 } as Leaflet.FitBoundsOptions;
          const map = mapRef.current!;
          if (indiaGeoRef.current) map.flyToBounds(indiaGeoRef.current.getBounds().pad(0.02), opts);
          else map.flyToBounds([[6.5, 68], [37, 97.5]], opts);
        }}
        title="Reset to India view"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        India View
      </button>
      <div className="legend">
        <div className="l-title">Risk Level</div>
        <div className="l-row">
          <span className="l-dot" style={{ background: "#C8201A" }} />
          High Risk
        </div>
        <div className="l-row">
          <span className="l-dot" style={{ background: "#C45D0A" }} />
          Medium Risk
        </div>
        <div className="l-row">
          <span className="l-dot" style={{ background: "#1A6E3A" }} />
          Lower Risk
        </div>
      </div>
    </div>
  );
}

/**
 * Invalidate map size after the detail panel opens/closes (parent should call).
 */
export function invalidateMapSize(map: Leaflet.Map | null) {
  if (map) map.invalidateSize();
}
