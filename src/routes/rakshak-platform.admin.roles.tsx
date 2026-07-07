import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rakshak-platform/admin/roles")({
  beforeLoad: () => {
    throw redirect({ to: "/rakshak-platform/admin/access-requests", search: { tab: "roles" } as any });
  },
});
