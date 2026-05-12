import { createFileRoute } from "@tanstack/react-router";
import { TopNav } from "@/components/rakshak/TopNav";
import { StatsBar } from "@/components/rakshak/StatsBar";
import { Sidebar } from "@/components/rakshak/Sidebar";
import { MapView } from "@/components/rakshak/MapView";
import { DetailPanel } from "@/components/rakshak/DetailPanel";
import { PetitionModal } from "@/components/rakshak/PetitionModal";
import { ReportModal } from "@/components/rakshak/ReportModal";
import { Footer } from "@/components/rakshak/Footer";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Project Rakshak — Crashfree India Road Safety Audit" },
      {
        name: "description",
        content:
          "Citizen-led road safety audit dashboard tracking dangerous locations across India.",
      },
    ],
  }),
});

function Index() {
  return (
    <div className="rakshak-app">
      <TopNav />
      <StatsBar />
      <main className="rakshak-main">
        <Sidebar />
        <MapView />
        <DetailPanel />
      </main>
      <Footer />
      <PetitionModal />
      <ReportModal />
    </div>
  );
}
