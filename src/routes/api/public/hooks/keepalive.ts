import { createFileRoute } from "@tanstack/react-router";

// Keep-alive / health-check endpoint. Pinged hourly by pg_cron to keep the
// Worker warm and the database connection from idling. Trivial work only:
// one cheap round-trip. Logs to rp_cron_runs only on error to avoid bloat.

export const Route = createFileRoute("/api/public/hooks/keepalive")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const expected = process.env.ADMIN_DIGEST_WEBHOOK_SECRET;
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!expected || provided.length !== expected.length || provided !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const startedAt = new Date();
  const t0 = Date.now();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Cheap round-trip: HEAD-style count on a tiny table.
    const { error } = await supabaseAdmin
      .from("rp_cron_runs")
      .select("id", { count: "exact", head: true });
    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, ts: new Date().toISOString() }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    const errorMessage = String(e?.message ?? e);
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("rp_cron_runs").insert({
        hook_name: "keepalive",
        status: "error",
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - t0,
        http_status: 500,
        notes: {},
        error_message: errorMessage,
      });
    } catch (logErr) {
      console.error("[keepalive] log insert failed", logErr);
    }
    return new Response(JSON.stringify({ ok: false, error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
