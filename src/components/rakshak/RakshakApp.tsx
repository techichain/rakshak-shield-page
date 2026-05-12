import { useCallback, useMemo, useRef, useState } from "react";
import { Nav } from "./Nav";
import { StatsBar } from "./StatsBar";
import { Sidebar } from "./Sidebar";
import { MapView } from "./MapView";
import { DetailPanel } from "./DetailPanel";
import { Footer } from "./Footer";
import { PetitionModal } from "./PetitionModal";
import { ReportModal } from "./ReportModal";
import { LOC } from "./data";
import type { FiltersState } from "./types";

export function RakshakApp() {
  const [filters, setFilters] = useState<FiltersState>({
    auth: "all",
    status: "all",
    state: "all",
    search: "",
  });
  const [activeId, setActiveId] = useState<number | null>(null);
  const [petitionId, setPetitionId] = useState<number | null>(null);
  const [reportId, setReportId] = useState<number | null>(null);

  const mapApi = useRef<{ zoomToState: (s: string) => void; resetIndia: () => void } | null>(null);
  const registerApi = useCallback((api: typeof mapApi.current) => {
    mapApi.current = api;
  }, []);

  const visible = useMemo(() => {
    const q = filters.search.toLowerCase();
    return LOC.filter((loc) => {
      if (filters.auth !== "all" && loc.auth !== filters.auth) return false;
      if (filters.status !== "all" && loc.status !== filters.status) return false;
      if (filters.state !== "all" && loc.st !== filters.state) return false;
      if (q && !`${loc.n} ${loc.ci} ${loc.st}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filters]);

  const visibleIds = useMemo(() => new Set(visible.map((l) => l.id)), [visible]);
  const active = activeId == null ? null : LOC.find((l) => l.id === activeId) ?? null;

  function selectLoc(id: number) {
    setActiveId(id);
  }
  function closeDetail() {
    setActiveId(null);
  }
  function openPetition(id: number) {
    setPetitionId(id);
  }
  function openReport(id: number) {
    setReportId(id);
  }
  function openPetitionGlobal() {
    const id = activeId ?? 1;
    if (activeId == null) setActiveId(1);
    setTimeout(() => setPetitionId(id), activeId == null ? 250 : 0);
  }
  function openReportGlobal() {
    const id = activeId ?? 1;
    if (activeId == null) setActiveId(1);
    setTimeout(() => setReportId(id), activeId == null ? 250 : 0);
  }

  const petitionLoc = petitionId == null ? null : LOC.find((l) => l.id === petitionId) ?? null;
  const reportLoc = reportId == null ? null : LOC.find((l) => l.id === reportId) ?? null;

  return (
    <div className="rk-app">
      <Nav onReport={openReportGlobal} onPetition={openPetitionGlobal} />
      <StatsBar active={active} onClose={closeDetail} />
      <div className="main">
        <Sidebar
          filters={filters}
          setFilters={setFilters}
          visible={visible}
          active={active}
          onSelect={selectLoc}
          onClearSelection={closeDetail}
          onStateFilter={(s) => mapApi.current?.zoomToState(s)}
        />
        <MapView visibleIds={visibleIds} onSelect={selectLoc} registerApi={registerApi} />
        <DetailPanel
          loc={active}
          onClose={closeDetail}
          onPetition={openPetition}
          onReport={openReport}
        />
      </div>
      <Footer />

      {petitionLoc && <PetitionModal loc={petitionLoc} onClose={() => setPetitionId(null)} />}
      {reportLoc && <ReportModal loc={reportLoc} onClose={() => setReportId(null)} />}
    </div>
  );
}
