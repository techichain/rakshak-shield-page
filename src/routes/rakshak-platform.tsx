import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/rakshak-platform")({
  ssr: false,
  component: () => <Outlet />,
});
