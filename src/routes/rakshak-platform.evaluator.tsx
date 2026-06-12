import { createFileRoute, Outlet } from "@tanstack/react-router";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";

export const Route = createFileRoute("/rakshak-platform/evaluator")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["evaluator"]);
  },
  component: () => <Outlet />,
});
