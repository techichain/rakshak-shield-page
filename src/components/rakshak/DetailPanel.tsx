import { LOCATIONS } from '@/data/locations';
import { useRakshakStore } from '@/store/rakshakStore';
import { RISK_COLORS, RISK_LABELS, STATUS, getAuthShort } from '@/data/constants';
import { getSiteMapUrl } from '@/data/siteMaps';
import { ProgressSteps } from './ProgressSteps';

export function DetailPanel() {
  const activeId = useRakshakStore((s) => s.activeId);
  const setActiveId = useRakshakStore((s) => s.setActiveId);
  const openPetition = useRakshakStore((s) => s.openPetition);
  const openReport = useRakshakStore((s) => s.openReport);

  const loc = activeId ? LOCATIONS.find((l) => l.id === activeId) : null;
  const open = !!loc;

  if (!loc) return <div className="detail" />;

  const primary = loc.auths.find((a) => a.p);
  const authShort = primary ? getAuthShort(primary.n) : 'Authority';
  const status = STATUS[loc.status];
  const siteMapUrl = getSiteMapUrl(loc.id);

  return (
    <div className={`detail${open ? ' open' : ''}`}>
      <div className="d-scroll">
        <div className="d-hero">
          <button className="d-close-btn" onClick={() => setActiveId(null)} title="Close">
            ×
          </button>
          <div className={`risk-badge ${loc.risk}`}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: RISK_COLORS[loc.risk],
                display: 'inline-block',
              }}
            />
            {RISK_LABELS[loc.risk]}
          </div>
          <div className="d-city-state">
            <span className="risk-dot" style={{ background: RISK_COLORS[loc.risk] }} />
            {loc.ci} ({loc.st})
          </div>
          <div className="d-name">{loc.n}</div>
          <div className="d-type">{loc.type}</div>
        </div>

        {siteMapUrl && (
          <div className="sitemap-wrap">
            <div className="sitemap-hdr">🗺️ Site Map</div>
            <div className="sitemap-img-wrap">
              <img
                className="sitemap-img"
                src={siteMapUrl}
                alt={`Site map of ${loc.n}`}
                loading="lazy"
                onClick={() => window.open(siteMapUrl, '_blank')}
              />
              <span className="sitemap-expand">↗ Full view</span>
            </div>
          </div>
        )}

        <div className="prog-wrap">
          <div className="prog-hdr">
            <span className="prog-ttl">Implementation Progress</span>
            <span className="prog-curr" style={{ color: status.c }}>
              {status.i} {status.l}
            </span>
          </div>
          <ProgressSteps status={loc.status} />
          <div className="prog-team">Audit Team: {loc.team}</div>
        </div>

        <div className="d-sec">
          <div className="d-sec-h">⚠️ Why This Location is Crash-Prone</div>
          <div className="crash-box">{loc.crash}</div>
        </div>
        <div className="d-sec">
          <div className="d-sec-h">🔍 Audit Findings</div>
          {loc.findings.map((f, i) => (
            <div key={i} className="finding">
              <span className="fdot" />
              {f}
            </div>
          ))}
        </div>
        <div className="d-sec">
          <div className="d-sec-h">🛠️ Recommended Solutions & Costs</div>
          {loc.sols.map((s, i) => (
            <div key={i} className="sol">
              <div className="sol-t">{s.i}</div>
              <div className="sol-c">{s.c}</div>
            </div>
          ))}
        </div>
        <div className="d-sec">
          <div className="d-sec-h">📈 Estimated Impact</div>
          <div className="impact-box">{loc.impact}</div>
        </div>
        <div className="d-sec">
          <div className="d-sec-h">🏛️ Responsible Authorities</div>
          {loc.auths.map((a, i) => (
            <div key={i} className={`auth${a.p ? ' primary' : ''}`}>
              <div className="auth-n">
                {a.n}
                {a.p && <span className="prim-tag">PRIMARY</span>}
              </div>
              <div className="auth-r">{a.r}</div>
            </div>
          ))}
        </div>
        <div className="d-sec">
          <div className="d-sec-h">❓ Why Not Yet Implemented</div>
          <div className="stall-box">{loc.why}</div>
        </div>
        <div className="cta-row">
          <button className="petition-btn" onClick={() => openPetition(loc.id)}>
            ✊ Write to {authShort}
          </button>
          <button className="report-btn" onClick={() => openReport(loc.id)}>
            ⚠️ Report an Issue
          </button>
        </div>
      </div>
    </div>
  );
}
