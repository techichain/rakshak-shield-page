import type { FiltersState, Location } from "./types";
import { LOC, AUTH_CATS, ST, RC } from "./data";
import { MonitorCheck, X } from "lucide-react";
import { StatusLegend, STATUS_DESCRIPTIONS } from "./StatusLegend";

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
              <MonitorCheck size={12} strokeWidth={2} color={status.c} style={{ flexShrink: 0 }} aria-hidden />
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
            title={status ? STATUS_DESCRIPTIONS[active!.status] : undefined}
            aria-label={status ? `Status: ${status.l}. ${STATUS_DESCRIPTIONS[active!.status]}` : undefined}
            style={
              status
                ? { background: status.bg, color: status.c, border: `1px solid ${status.c}30` }
                : undefined
            }
          >
            {status ? status.l : "—"}
          </span>
        </div>
        <button
          type="button"
          className="sb-sel-clear"
          onClick={onClearSelection}
          aria-label="Clear selected location"
        >
          Clear selection <X size={11} strokeWidth={2.25} style={{ verticalAlign: -1 }} />
        </button>
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
            { v: "all", l: "All", d: "Show every status" },
            { v: "implementation_ongoing", l: "In Progress", d: STATUS_DESCRIPTIONS.implementation_ongoing },
            { v: "in_principle_approval", l: "Approved", d: STATUS_DESCRIPTIONS.in_principle_approval },
            { v: "submitted", l: "Submitted", d: STATUS_DESCRIPTIONS.submitted },
            { v: "audit_complete", l: "Audited", d: STATUS_DESCRIPTIONS.audit_complete },
            { v: "stalled", l: "Stalled", d: STATUS_DESCRIPTIONS.stalled },
          ].map((s) => (
            <button
              type="button"
              key={s.v}
              className={"chip" + (filters.status === s.v ? " on" : "")}
              onClick={() => setF("status", s.v)}
              title={s.d}
              aria-label={`Filter by status: ${s.l}`}
              aria-pressed={filters.status === s.v}
            >
              {s.l}
            </button>
          ))}
          <div className="mt-3"><StatusLegend compact /></div>
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
                title={`${ST[loc.status].l} — ${STATUS_DESCRIPTIONS[loc.status]}`}
                aria-label={`Status: ${ST[loc.status].l}`}
                role="img"
              />
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
