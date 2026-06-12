import { createFileRoute, Outlet } from "@tanstack/react-router";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";

export const Route = createFileRoute("/rakshak-platform/team/locations")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["team_leader", "team_member"]);
  },
  component: () => <Outlet />,
});
