// WhatsApp notification scaffolding.
//
// This is inert until real WhatsApp Business API credentials are set as
// environment variables. Without them, sends are logged and skipped so callers
// never break. Supported providers (selected via WHATSAPP_PROVIDER):
//   - "meta"    → Meta Cloud API (implemented)
//   - "twilio"  → Twilio WhatsApp (scaffold — not implemented yet)
//   - "gupshup" → Gupshup (scaffold — not implemented yet)

type SendResult = { sent: boolean; reason?: string; id?: string };

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  // Strip everything but digits and leading +
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (cleaned.length < 6) return null;
  return cleaned;
}

export async function sendWhatsAppMessage(params: {
  to: string;
  body: string;
}): Promise<SendResult> {
  const to = normalizePhone(params.to);
  if (!to) {
    return { sent: false, reason: "invalid_phone" };
  }

  const provider = (process.env.WHATSAPP_PROVIDER ?? "").toLowerCase();

  try {
    if (provider === "meta") {
      const token = process.env.WHATSAPP_API_TOKEN;
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!token || !phoneId) {
        console.warn("[whatsapp] not configured, skipping send to", to);
        return { sent: false, reason: "not_configured" };
      }
      const metaTo = to.replace(/^\+/, "");
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneId)}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: metaTo,
            type: "text",
            text: { body: params.body },
          }),
        },
      );
      const text = await res.text();
      if (!res.ok) {
        console.error("[whatsapp] meta send failed", res.status, text);
        return { sent: false, reason: `meta_${res.status}` };
      }
      let id: string | undefined;
      try {
        const parsed = JSON.parse(text);
        id = parsed?.messages?.[0]?.id;
      } catch {
        // non-JSON body; ignore
      }
      return { sent: true, id };
    }

    if (provider === "twilio") {
      const sid = process.env.WHATSAPP_ACCOUNT_SID;
      const authToken = process.env.WHATSAPP_AUTH_TOKEN;
      const from = process.env.WHATSAPP_FROM;
      if (!sid || !authToken || !from) {
        console.warn("[whatsapp] not configured, skipping send to", to);
        return { sent: false, reason: "not_configured" };
      }
      // Scaffold only — real Twilio call not implemented yet.
      console.warn("[whatsapp] twilio provider not implemented, skipping send to", to);
      return { sent: false, reason: "provider_not_implemented" };
    }

    if (provider === "gupshup") {
      const token = process.env.WHATSAPP_API_TOKEN;
      if (!token) {
        console.warn("[whatsapp] not configured, skipping send to", to);
        return { sent: false, reason: "not_configured" };
      }
      console.warn("[whatsapp] gupshup provider not implemented, skipping send to", to);
      return { sent: false, reason: "provider_not_implemented" };
    }

    console.warn("[whatsapp] not configured, skipping send to", to);
    return { sent: false, reason: "not_configured" };
  } catch (e: any) {
    console.error("[whatsapp] send error", e);
    return { sent: false, reason: String(e?.message ?? e) };
  }
}

export async function notifyTeamWhatsApp(params: {
  team_id: string;
  body: string;
}): Promise<{ attempted: number; sent: number; results: SendResult[] }> {
  const results: SendResult[] = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: team } = await supabaseAdmin
      .from("rp_teams")
      .select("team_leader_id")
      .eq("id", params.team_id)
      .maybeSingle();

    const phones = new Set<string>();

    if (team?.team_leader_id) {
      const { data: leader } = await supabaseAdmin
        .from("rp_profiles")
        .select("phone")
        .eq("id", team.team_leader_id)
        .maybeSingle();
      const p = normalizePhone((leader as any)?.phone);
      if (p) phones.add(p);
    }

    const { data: members } = await supabaseAdmin
      .from("rp_team_members")
      .select("phone, profile_id")
      .eq("team_id", params.team_id);
    for (const m of members ?? []) {
      const p = normalizePhone((m as any).phone);
      if (p) phones.add(p);
    }

    // Also pull phone from linked profiles for members without a phone on their row
    const profileIds = (members ?? [])
      .map((m: any) => m.profile_id)
      .filter((x: any): x is string => Boolean(x));
    if (profileIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("rp_profiles")
        .select("phone")
        .in("id", profileIds);
      for (const p of profs ?? []) {
        const n = normalizePhone((p as any).phone);
        if (n) phones.add(n);
      }
    }

    for (const to of phones) {
      const r = await sendWhatsAppMessage({ to, body: params.body });
      results.push(r);
    }
  } catch (e) {
    console.error("[whatsapp] notifyTeamWhatsApp error", e);
  }
  const sent = results.filter((r) => r.sent).length;
  return { attempted: results.length, sent, results };
}
