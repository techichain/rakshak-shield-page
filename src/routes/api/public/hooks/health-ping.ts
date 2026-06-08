import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/health-ping")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          JSON.stringify({ ok: true, ts: new Date().toISOString(), service: "rakshak-platform" }),
          { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
        ),
      POST: async () =>
        new Response(
          JSON.stringify({ ok: true, ts: new Date().toISOString(), service: "rakshak-platform" }),
          { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
        ),
    },
  },
});
