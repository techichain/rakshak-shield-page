import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/rakshak-platform/evaluator")({
  component: () => <Outlet />,
});
