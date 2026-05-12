import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { LOCATIONS } from '@/data/locations';
import { useRakshakStore } from '@/store/rakshakStore';
import { RISK_COLORS, RISK_LABELS, STATUS, STATE_BOUNDS, GEO_NAME_MAP } from '@/data/constants';
import { getVisibleLocations } from './Sidebar';

// Fix default icon path issue (we use divIcon anyway)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;

const GEO_URLS = [
  'https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/e388c4cae20aa53cb5090210a42ebb9b765c0a36/india_states.geojson',
  'https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson',
  'https://raw.githubusercontent.com/datameet/maps/master/States/India_State_Boundary.geojson',
];

export function MapView() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<number, { m: L.Marker; vis: boolean }>>({});
  const indiaLayerRef = useRef<L.GeoJSON | null>(null);
  const stateLayerMapRef = useRef<Record<string, L.Layer[]>>({});
  const [loading, setLoading] = useState(true);

  const filters = useRakshakStore((s) => s.filters);
  const setActiveId = useRakshakStore((s) => s.setActiveId);

  const visibleIds = useMemo(
    () => new Set(getVisibleLocations(filters).map((l) => l.id)),
    [filters]
  );

  // init map
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      zoomControl: true,
      minZoom: 4,
      maxZoom: 14,
      attributionControl: false,
    }).setView([22.5, 80.5], 5);
    map.setMaxBounds([[2, 60], [40, 102]]);
    mapRef.current = map;

    // markers
    LOCATIONS.forEach((loc) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;background:${RISK_COLORS[loc.risk]};border-radius:50%;border:2.5px solid rgba(255,255,255,.9);box-shadow:0 2px 8px rgba(0,0,0,.32);cursor:pointer;"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -13],
      });
      const m = L.marker([loc.lat, loc.lng], { icon, riseOnHover: true }).addTo(map);
      const s = STATUS[loc.status];
      const riskBg =
        loc.risk === 'high' ? 'var(--high-bg)' : loc.risk === 'medium' ? 'var(--med-bg)' : 'var(--low-bg)';
      m.bindPopup(
        `<div class="map-tip">
          <div class="mt-name">${loc.n}</div>
          <div class="mt-city">${loc.ci}, ${loc.st}</div>
          <div class="mt-risk" style="background:${riskBg};color:${RISK_COLORS[loc.risk]}">${RISK_LABELS[loc.risk]}</div>
          <div class="mt-status" style="color:${s.c}">${s.i} ${s.l}</div>
          <div class="mt-cta">Click to view full audit →</div>
        </div>`,
        { closeButton: false, maxWidth: 200 }
      );
      m.on('click', () => {
        map.closePopup();
        setActiveId(loc.id);
        zoomToState(loc.st);
      });
      m.on('mouseover', () => m.openPopup());
      m.on('mouseout', () => m.closePopup());
      markersRef.current[loc.id] = { m, vis: true };
    });

    // load india geojson
    (async () => {
      for (const url of GEO_URLS) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const data = await r.json();
          if (!data?.features?.length) continue;
          const sample = data.features[0].properties;
          const prop = sample.ST_NM ? 'ST_NM' : sample.NAME_1 ? 'NAME_1' : 'name';
          const layer = L.geoJSON(data, {
            style: () => ({
              fillColor: '#EDE8DE',
              fillOpacity: 1,
              color: '#BEB8AE',
              weight: 1.2,
              opacity: 1,
            }),
            onEachFeature: (f, lyr) => {
              const raw = f.properties[prop] || '';
              const name = GEO_NAME_MAP[raw] || raw;
              if (!stateLayerMapRef.current[name]) stateLayerMapRef.current[name] = [];
              stateLayerMapRef.current[name].push(lyr);
              lyr.on('mouseover', () =>
                (lyr as L.Path).setStyle({ fillColor: '#DDD7C8', fillOpacity: 1 })
              );
              lyr.on('mouseout', () =>
                (lyr as L.Path).setStyle({ fillColor: '#EDE8DE', fillOpacity: 1 })
              );
            },
          });
          layer.addTo(map);
          indiaLayerRef.current = layer;
          // re-add markers above
          Object.values(markersRef.current).forEach((mk) => mk.m.addTo(map));
          map.flyToBounds(layer.getBounds().pad(0.02), { duration: 0.8, easeLinearity: 0.5 });
          setLoading(false);
          return;
        } catch {
          /* try next */
        }
      }
      setLoading(false);
    })();

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      indiaLayerRef.current = null;
      stateLayerMapRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync marker visibility with filters
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    LOCATIONS.forEach((loc) => {
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

  // zoom on state filter change
  useEffect(() => {
    if (filters.state) zoomToState(filters.state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.state]);

  function zoomToState(name: string) {
    const map = mapRef.current;
    if (!map) return;
    const opts = { duration: 0.85, easeLinearity: 0.5 };
    if (!name || name === 'all') {
      if (indiaLayerRef.current)
        map.flyToBounds(indiaLayerRef.current.getBounds().pad(0.02), opts);
      else map.flyToBounds([[6.5, 68], [37, 97.5]], opts);
      return;
    }
    const layers = stateLayerMapRef.current[name];
    if (layers?.length) {
      map.flyToBounds(L.featureGroup(layers).getBounds().pad(0.12), opts);
    } else if (STATE_BOUNDS[name]) {
      map.flyToBounds(L.latLngBounds(STATE_BOUNDS[name]).pad(0.1), opts);
    } else {
      const pts = LOCATIONS.filter((l) => l.st === name).map((l) => [l.lat, l.lng] as [number, number]);
      if (pts.length) map.flyToBounds(L.latLngBounds(pts).pad(0.35), opts);
    }
  }

  // resize map when detail panel opens/closes
  const activeId = useRakshakStore((s) => s.activeId);
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 280);
    return () => clearTimeout(t);
  }, [activeId]);

  return (
    <div className="map-wrap">
      <div ref={mapEl} id="map" />
      <div className={`map-loading${loading ? '' : ' hide'}`}>🗺️ Loading India map…</div>
      <button className="map-reset" onClick={() => zoomToState('all')} title="Reset to India view">
        ↻ India View
      </button>
      <div className="legend">
        <div className="l-title">Risk Level</div>
        <div className="l-row"><span className="l-dot" style={{ background: '#C8201A' }} />High Risk</div>
        <div className="l-row"><span className="l-dot" style={{ background: '#C45D0A' }} />Medium Risk</div>
        <div className="l-row"><span className="l-dot" style={{ background: '#1A6E3A' }} />Lower Risk</div>
      </div>
    </div>
  );
}
