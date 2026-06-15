import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminFAB } from "@/components/rakshak-platform/AdminFAB";

export const Route = createFileRoute("/rakshak-platform/admin")({
  component: () => (
    <>
      <Outlet />
      <AdminFAB />
    </>
  ),
});
