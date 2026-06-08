import type { Location } from "./types";
import { RC, getAuthShort } from "./data";
import { X } from "lucide-react";

interface Props {
  active: Location | null;
  onClose: () => void;
}

export function StatsBar({ active, onClose }: Props) {
  const primary = active?.auths.find((a) => a.p);
  return (
    <div className="stats-bar">
      <div className="stat">
        <span className="stat-val">31</span>
        <span className="stat-lbl">Audited Sites</span>
      </div>
      <div className="stat">
        <span className="stat-val">18</span>
        <span className="stat-lbl">Cities</span>
      </div>
      <div className="stat">
        <span className="stat-val">25</span>
        <span className="stat-lbl">Approvals</span>
      </div>
      <div className="stat" style={{ borderRight: "none" }}>
        <span className="stat-val">30%</span>
        <span className="stat-lbl">Crash Reduction Est.</span>
      </div>
      <div className={"stat-ctx" + (active ? " show" : "")}>
        <div className="ctx-block">
          <div className="ctx-loc">
            <span
              className="ctx-loc-dot"
              style={{ background: active ? RC[active.risk] : "transparent" }}
            />
            <span>{active ? `${active.ci} (${active.st})` : "—"}</span>
          </div>
          <div className="ctx-auth">
            {active ? `Primary: ${getAuthShort(primary?.n)}` : "Primary Authority"}
          </div>
        </div>
        <button className="ctx-x" onClick={onClose} title="Close">
          ×
        </button>
      </div>
    </div>
  );
}
