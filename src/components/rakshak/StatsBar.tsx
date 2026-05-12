import { LOCATIONS } from '@/data/locations';
import { useRakshakStore } from '@/store/rakshakStore';
import { RISK_COLORS, getAuthShort } from '@/data/constants';

export function StatsBar() {
  const activeId = useRakshakStore((s) => s.activeId);
  const closeDetail = useRakshakStore((s) => s.setActiveId);
  const active = activeId ? LOCATIONS.find((l) => l.id === activeId) : null;
  const primary = active?.auths.find((a) => a.p);

  const total = LOCATIONS.length;
  const high = LOCATIONS.filter((l) => l.risk === 'high').length;
  const states = new Set(LOCATIONS.map((l) => l.st)).size;
  const cities = new Set(LOCATIONS.map((l) => l.ci)).size;
  const inProgress = LOCATIONS.filter((l) => l.status === 'implementation_ongoing').length;
  const implemented = LOCATIONS.filter((l) => l.status === 'implemented').length;

  return (
    <div className="stats-bar">
      <div className="stat"><div className="stat-val">{total}</div><div className="stat-lbl">Locations</div></div>
      <div className="stat"><div className="stat-val">{states}</div><div className="stat-lbl">States</div></div>
      <div className="stat"><div className="stat-val">{cities}</div><div className="stat-lbl">Cities</div></div>
      <div className="stat"><div className="stat-val" style={{ color: RISK_COLORS.high }}>{high}</div><div className="stat-lbl">High Risk</div></div>
      <div className="stat"><div className="stat-val">{inProgress}</div><div className="stat-lbl">In Progress</div></div>
      <div className="stat"><div className="stat-val">{implemented}</div><div className="stat-lbl">Implemented</div></div>
      <div className={`stat-ctx${active ? ' show' : ''}`} id="statCtx">
        <button className="ctx-x" onClick={() => closeDetail(null)} title="Clear selection">×</button>
        <div className="ctx-block">
          <div className="ctx-loc">
            <span className="ctx-loc-dot" style={{ background: active ? RISK_COLORS[active.risk] : '#ccc' }} />
            {active ? `${active.ci} (${active.st})` : ''}
          </div>
          <div className="ctx-auth">Primary: {primary ? getAuthShort(primary.n) : '—'}</div>
        </div>
      </div>
    </div>
  );
}
