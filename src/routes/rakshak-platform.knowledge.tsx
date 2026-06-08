import { createFileRoute, Outlet } from "@tanstack/react-router";
export const Route = createFileRoute("/rakshak-platform/knowledge")({
  component: () => <Outlet />,
});
