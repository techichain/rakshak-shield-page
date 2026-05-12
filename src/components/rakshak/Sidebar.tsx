import { useMemo } from 'react';
import { LOCATIONS } from '@/data/locations';
import { useRakshakStore } from '@/store/rakshakStore';
import { RISK_COLORS, STATUS, AUTH_CATS, getAuthShort } from '@/data/constants';
import type { Location } from '@/types/rakshak';

export function getVisibleLocations(
  filters: { auth: string; status: string; state: string; search: string }
): Location[] {
  const s = filters.search.toLowerCase();
  return LOCATIONS.filter((loc) => {
    if (filters.auth !== 'all' && loc.auth !== filters.auth) return false;
    if (filters.status !== 'all' && loc.status !== filters.status) return false;
    if (filters.state !== 'all' && loc.st !== filters.state) return false;
    if (s && !`${loc.n} ${loc.ci} ${loc.st}`.toLowerCase().includes(s)) return false;
    return true;
  });
}

const STATUS_CHIPS = [
  { v: 'all', label: 'All' },
  { v: 'implementation_ongoing', label: '🔨 In Progress' },
  { v: 'in_principle_approval', label: '✅ Approved' },
  { v: 'submitted', label: '📤 Submitted' },
  { v: 'audit_complete', label: '✓ Audited' },
  { v: 'stalled', label: '⚠️ Stalled' },
];

export function Sidebar() {
  const filters = useRakshakStore((s) => s.filters);
  const setFilter = useRakshakStore((s) => s.setFilter);
  const setSearch = useRakshakStore((s) => s.setSearch);
  const activeId = useRakshakStore((s) => s.activeId);
  const setActiveId = useRakshakStore((s) => s.setActiveId);

  const visible = useMemo(() => getVisibleLocations(filters), [filters]);
  const states = useMemo(() => [...new Set(LOCATIONS.map((l) => l.st))].sort(), []);
  const active = activeId ? LOCATIONS.find((l) => l.id === activeId) : null;
  const primary = active?.auths.find((a) => a.p);
  const status = active ? STATUS[active.status] : null;

  return (
    <aside className="sidebar">
      <div className="sb-head">
        <div className="sb-title">Search Locations</div>
        <input
          className="search"
          type="text"
          placeholder="Search city or location…"
          value={filters.search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {active && status && (
        <div className="sb-selected show">
          <div className="sb-sel-label">📍 Selected Location</div>
          <div className="sb-sel-name">{active.n}</div>
          <div style={{ marginBottom: 4 }}>
            <span className="sb-sel-auth-label">Primary Authority</span>
            <div className="sb-sel-auth">
              <span style={{ color: 'var(--navy)' }}>{primary ? primary.n.split('(')[0].trim() : '—'}</span>
            </div>
          </div>
          <div>
            <span className="sb-sel-auth-label">Status</span>
            <span
              className="sb-sel-status"
              style={{ background: status.bg, color: status.c, border: `1px solid ${status.c}30` }}
            >
              {status.i} {status.l}
            </span>
          </div>
          <span className="sb-sel-clear" onClick={() => setActiveId(null)}>
            Clear selection ×
          </span>
        </div>
      )}

      <div className="sb-filters">
        <div className="sb-section">
          <div className="f-label">Responsible Authority</div>
          <span
            className={`chip${filters.auth === 'all' ? ' on' : ''}`}
            onClick={() => setFilter('auth', 'all')}
          >
            All <span className="chip-count">{LOCATIONS.length}</span>
          </span>
          {AUTH_CATS.map((c) => {
            const cnt = LOCATIONS.filter((l) => l.auth === c.k).length;
            return (
              <span
                key={c.k}
                className={`chip${filters.auth === c.k ? ' on' : ''}`}
                title={c.d}
                onClick={() => setFilter('auth', c.k)}
              >
                {c.l} <span className="chip-count">{cnt}</span>
              </span>
            );
          })}
        </div>
        <div className="sb-section">
          <div className="f-label">Status</div>
          {STATUS_CHIPS.map((c) => (
            <span
              key={c.v}
              className={`chip${filters.status === c.v ? ' on' : ''}`}
              onClick={() => setFilter('status', c.v)}
            >
              {c.label}
            </span>
          ))}
        </div>
        <div className="sb-section states-section">
          <div className="f-label">State</div>
          <div className="state-chips-wrap">
            <span
              className={`chip${filters.state === 'all' ? ' on' : ''}`}
              onClick={() => setFilter('state', 'all')}
            >
              All
            </span>
            {states.map((s) => (
              <span
                key={s}
                className={`chip${filters.state === s ? ' on' : ''}`}
                onClick={() => setFilter('state', s)}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="loc-scroll">
        {visible.length === 0 ? (
          <div className="empty-sb">No locations match your filters</div>
        ) : (
          visible.map((loc) => (
            <div
              key={loc.id}
              className={`loc-row${activeId === loc.id ? ' active' : ''}`}
              onClick={() => setActiveId(loc.id)}
            >
              <span className="loc-dot" style={{ background: RISK_COLORS[loc.risk] }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="loc-name">{loc.n}</div>
                <div className="loc-city">{loc.ci}</div>
              </div>
              <span
                className="loc-spill"
                style={{ background: STATUS[loc.status].c }}
                title={STATUS[loc.status].l}
              />
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
