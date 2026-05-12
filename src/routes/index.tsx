import { createFileRoute } from "@tanstack/react-router";
import { RakshakApp } from "@/components/rakshak/RakshakApp";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Project Rakshak — Crashfree India Road Safety Audit Platform" },
      {
        name: "description",
        content:
          "Documenting risks, demanding accountability, saving lives — a youth-led road safety audit platform across India.",
      },
      { property: "og:title", content: "Project Rakshak — Crashfree India" },
      {
        property: "og:description",
        content:
          "Interactive map of crash-prone locations across India, audit findings, and petition tools.",
      },
    ],
  }),
});

function Index() {
  return <RakshakApp />;
}
