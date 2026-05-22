import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/gigrider-checklist/admin")({
  component: () => <Outlet />,
});
