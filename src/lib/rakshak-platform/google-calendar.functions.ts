import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function resolveOrigin(provided?: string | null) {
  if (provided && /^https?:\/\//.test(provided)) return provided.replace(/\/+$/, "");
  // Production fallback — matches Google Console redirect URI.
  return "https://rakshak.crashfreeindia.org";
}

export const getCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("rp_google_calendar_tokens")
      .select("google_email, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      connected: !!data,
      email: (data?.google_email as string | null) ?? null,
      updated_at: (data?.updated_at as string | null) ?? null,
    };
  });

export const getCalendarAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ origin: z.string().url().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { buildGoogleAuthUrl } = await import("./google-calendar.server");
    const origin = resolveOrigin(data.origin);
    // state = userId; the callback verifies state === context.userId.
    const url = buildGoogleAuthUrl({ origin, state: context.userId });
    return { url };
  });

export const completeCalendarOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      code: z.string().min(1),
      state: z.string().min(1),
      origin: z.string().url().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.state !== context.userId) {
      throw new Error("Invalid OAuth state — please retry from your profile page.");
    }
    const { exchangeAndStoreCode } = await import("./google-calendar.server");
    const origin = resolveOrigin(data.origin);
    const result = await exchangeAndStoreCode({
      code: data.code,
      origin,
      userId: context.userId,
    });
    return { ok: true, email: result.email };
  });

export const disconnectCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Revoke refresh token best-effort.
    try {
      const { data } = await supabaseAdmin
        .from("rp_google_calendar_tokens")
        .select("refresh_token")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (data?.refresh_token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(data.refresh_token as string)}`, {
          method: "POST",
        });
      }
    } catch (err) {
      console.error("[disconnectCalendar] revoke failed", err);
    }
    const { error } = await supabaseAdmin
      .from("rp_google_calendar_tokens")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
