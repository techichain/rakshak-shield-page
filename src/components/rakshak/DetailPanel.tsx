import type { Location } from "./types";
import { RC, RL, ST, PROG, getSiteMapUrl, getAuthShort } from "./data";
import { X, Check, Maximize2 } from "lucide-react";
import { STATUS_DESCRIPTIONS } from "./StatusLegend";

interface Props {
  loc: Location | null;
  onClose: () => void;
  onPetition: (id: number) => void;
  onReport: (id: number) => void;
}

function ProgressBar({ status }: { status: Location["status"] }) {
  if (status === "stalled") {
    return (
      <div className="prog-stall">
        Stalled — No response from responsible authorities. Escalation needed.
      </div>
    );
  }
  const cur = ST[status]?.s || 1;
  return (
    <div className="prog-steps">
      {PROG.map((s) => {
        const stepMeta = ST[s.k];
        const done = stepMeta?.s <= cur;
        const curr = s.k === status;
        return (
          <div
            key={s.k}
            className={"prog-step" + (done ? " done" : "") + (curr ? " current" : "")}
          >
            <div className="prog-circ">
              {done && <Check size={9} strokeWidth={3} color="#fff" aria-hidden />}
            </div>
            <div className="prog-lbl">{s.l}</div>
          </div>
        );
      })}
    </div>
  );
}

export function DetailPanel({ loc, onClose, onPetition, onReport }: Props) {
  return (
    <div className={"detail" + (loc ? " open" : "")}>
      <div className="d-scroll">
        {loc && <DetailContent loc={loc} onClose={onClose} onPetition={onPetition} onReport={onReport} />}
      </div>
    </div>
  );
}

function DetailContent({ loc, onClose, onPetition, onReport }: { loc: Location } & Omit<Props, "loc">) {
  const primary = loc.auths.find((a) => a.p);
  const authShort = primary ? getAuthShort(primary.n) : "Authority";
  const s = ST[loc.status];
  const siteMapUrl = getSiteMapUrl(loc.id);

  return (
    <>
      <div className="d-hero">
        <button
          type="button"
          className="d-close-btn"
          onClick={onClose}
          title="Close location details"
          aria-label="Close location details"
        >
          <X size={16} strokeWidth={2.25} aria-hidden />
        </button>
        <div className={"risk-badge " + loc.risk}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: RC[loc.risk],
              display: "inline-block",
            }}
          />
          {RL[loc.risk]}
        </div>
        <div className="d-city-state">
          <span className="risk-dot" style={{ background: RC[loc.risk] }} />
          {loc.ci} ({loc.st})
        </div>
        <div className="d-name">{loc.n}</div>
        <div className="d-type">{loc.type}</div>
      </div>

      {siteMapUrl && (
        <div className="sitemap-wrap">
          <div className="sitemap-hdr">Site Map</div>
          <div className="sitemap-img-wrap">
            <img
              className="sitemap-img"
              src={siteMapUrl}
              alt={`Site map of ${loc.n}`}
              loading="lazy"
            />
            <span className="sitemap-expand" aria-hidden><Maximize2 size={11} strokeWidth={2.25} style={{ verticalAlign: -1, marginRight: 3 }} /> Full view</span>
          </div>
        </div>
      )}

      <div className="prog-wrap">
        <div className="prog-hdr">
          <span className="prog-ttl">Implementation Progress</span>
          <span className="prog-curr" style={{ color: s.c }}>{s.i ? s.i + " " : ""}{s.l}</span>
        </div>
        <ProgressBar status={loc.status} />
        <div className="prog-team">Audit Team: {loc.team}</div>
      </div>

      <div className="d-sec">
        <div className="d-sec-h">Why This Location is Crash-Prone</div>
        <div className="crash-box">{loc.crash}</div>
      </div>

      <div className="d-sec">
        <div className="d-sec-h">Audit Findings</div>
        {loc.findings.map((f, i) => (
          <div key={i} className="finding">
            <span className="fdot" />
            {f}
          </div>
        ))}
      </div>

      <div className="d-sec">
        <div className="d-sec-h">Recommended Solutions & Costs</div>
        {loc.sols.map((sol, i) => (
          <div key={i} className="sol">
            <div className="sol-t">{sol.i}</div>
            <div className="sol-c">{sol.c}</div>
          </div>
        ))}
      </div>

      <div className="d-sec">
        <div className="d-sec-h">Estimated Impact</div>
        <div className="impact-box">{loc.impact}</div>
      </div>

      <div className="d-sec">
        <div className="d-sec-h">Responsible Authorities</div>
        {loc.auths.map((a, i) => (
          <div key={i} className={"auth" + (a.p ? " primary" : "")}>
            <div className="auth-n">
              {a.n}
              {a.p && <span className="prim-tag">PRIMARY</span>}
            </div>
            <div className="auth-r">{a.r}</div>
          </div>
        ))}
      </div>

      <div className="d-sec">
        <div className="d-sec-h">Why Not Yet Implemented</div>
        <div className="stall-box">{loc.why}</div>
      </div>

      <div className="cta-row">
        <button className="petition-btn" onClick={() => onPetition(loc.id)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Write to {authShort}
        </button>
        <button className="report-btn" onClick={() => onReport(loc.id)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Report an Issue
        </button>
      </div>
    </>
  );
}
