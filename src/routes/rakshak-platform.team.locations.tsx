import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/rakshak-platform/team/locations")({
  component: () => <Outlet />,
});
