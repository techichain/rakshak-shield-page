import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/rakshak-mentor")({
  component: () => <Outlet />,
});
