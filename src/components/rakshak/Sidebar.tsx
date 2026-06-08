import type { FiltersState, Location } from "./types";
import { LOC, AUTH_CATS, ST, RC } from "./data";

interface Props {
  filters: FiltersState;
  setFilters: (next: FiltersState) => void;
  visible: Location[];
  active: Location | null;
  onSelect: (id: number) => void;
  onClearSelection: () => void;
  onStateFilter: (state: string) => void;
}

export function Sidebar({
  filters,
  setFilters,
  visible,
  active,
  onSelect,
  onClearSelection,
  onStateFilter,
}: Props) {
  const states = Array.from(new Set(LOC.map((l) => l.st))).sort();

  function setF<K extends keyof FiltersState>(k: K, v: FiltersState[K]) {
    const next = { ...filters, [k]: v };
    setFilters(next);
    if (k === "state") onStateFilter(v as string);
  }

  const primary = active?.auths.find((a) => a.p);
  const status = active ? ST[active.status] : null;

  return (
    <aside className="sidebar">
      <div className="sb-head">
        <div className="sb-title">Search Locations</div>
        <input
          className="search"
          type="text"
          placeholder="Search city or location…"
          value={filters.search}
          onChange={(e) => setF("search", e.target.value)}
        />
      </div>

      <div className={"sb-selected" + (active ? " show" : "")}>
        <div className="sb-sel-label">Selected Location</div>
        <div className="sb-sel-name">{active?.n ?? "—"}</div>
        <div style={{ marginBottom: 4 }}>
          <span className="sb-sel-auth-label">Primary Authority</span>
          <div className="sb-sel-auth">
            {status && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={status.c} strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            )}
            <span style={{ color: "var(--navy)" }}>
              {primary ? primary.n.split("(")[0].trim() : "—"}
            </span>
          </div>
        </div>
        <div>
          <span className="sb-sel-auth-label">Status</span>
          <span
            className="sb-sel-status"
            style={
              status
                ? { background: status.bg, color: status.c, border: `1px solid ${status.c}30` }
                : undefined
            }
          >
            {status ? `${status.i} ${status.l}` : "—"}
          </span>
        </div>
        <span className="sb-sel-clear" onClick={onClearSelection}>
          Clear selection ×
        </span>
      </div>

      <div className="sb-filters">
        <div className="sb-section">
          <div className="f-label">Responsible Authority</div>
          <span
            className={"chip" + (filters.auth === "all" ? " on" : "")}
            onClick={() => setF("auth", "all")}
          >
            All <span className="chip-count">{LOC.length}</span>
          </span>
          {AUTH_CATS.map((c) => {
            const cnt = LOC.filter((l) => l.auth === c.k).length;
            return (
              <span
                key={c.k}
                className={"chip" + (filters.auth === c.k ? " on" : "")}
                onClick={() => setF("auth", c.k)}
                title={c.d}
              >
                {c.l} <span className="chip-count">{cnt}</span>
              </span>
            );
          })}
        </div>

        <div className="sb-section">
          <div className="f-label">Status</div>
          {[
            { v: "all", l: "All" },
            { v: "implementation_ongoing", l: "In Progress" },
            { v: "in_principle_approval", l: "Approved" },
            { v: "submitted", l: "Submitted" },
            { v: "audit_complete", l: "Audited" },
            { v: "stalled", l: "Stalled" },
          ].map((s) => (
            <span
              key={s.v}
              className={"chip" + (filters.status === s.v ? " on" : "")}
              onClick={() => setF("status", s.v)}
            >
              {s.l}
            </span>
          ))}
        </div>

        <div className="sb-section states-section">
          <div className="f-label">State</div>
          <div className="state-chips-wrap">
            <span
              className={"chip" + (filters.state === "all" ? " on" : "")}
              onClick={() => setF("state", "all")}
            >
              All
            </span>
            {states.map((s) => (
              <span
                key={s}
                className={"chip" + (filters.state === s ? " on" : "")}
                onClick={() => setF("state", s)}
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
              className={"loc-row" + (active?.id === loc.id ? " active" : "")}
              onClick={() => onSelect(loc.id)}
            >
              <span className="loc-dot" style={{ background: RC[loc.risk] }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="loc-name">{loc.n}</div>
                <div className="loc-city">{loc.ci}</div>
              </div>
              <span
                className="loc-spill"
                style={{ background: ST[loc.status].c }}
                title={ST[loc.status].l}
              />
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
