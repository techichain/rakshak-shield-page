import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/gigrider-checklist")({
  component: () => <Outlet />,
  head: () => ({
    meta: [
      { title: "Gig Rider Safety — Observer Checklist" },
      {
        name: "description",
        content:
          "Field observation checklist for gig worker road safety surveys across Delhi NCR.",
      },
    ],
  }),
});
