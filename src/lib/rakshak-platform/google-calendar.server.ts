import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

export function calendarRedirectUri(origin: string) {
  return `${origin.replace(/\/+$/, "")}/rakshak-platform/auth/calendar-callback`;
}

export function buildGoogleAuthUrl(opts: { origin: string; state: string }) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: calendarRedirectUri(opts.origin),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: opts.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeAndStoreCode(opts: {
  code: string;
  origin: string;
  userId: string;
}) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth secrets missing");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: opts.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: calendarRedirectUri(opts.origin),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${tokenRes.status} ${text}`);
  }
  const tok = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
  };

  let email: string | null = null;
  try {
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (infoRes.ok) {
      const info = (await infoRes.json()) as { email?: string };
      email = info.email ?? null;
    }
  } catch {
    // best-effort
  }

  // Preserve existing refresh_token if Google omitted it on re-consent.
  let refreshToken = tok.refresh_token ?? null;
  if (!refreshToken) {
    const { data: existing } = await supabaseAdmin
      .from("rp_google_calendar_tokens")
      .select("refresh_token")
      .eq("user_id", opts.userId)
      .maybeSingle();
    refreshToken = (existing?.refresh_token as string | undefined) ?? null;
  }
  if (!refreshToken) {
    throw new Error(
      "Google did not return a refresh token. Remove app access at https://myaccount.google.com/permissions and try again.",
    );
  }

  const expiryAt = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from("rp_google_calendar_tokens")
    .upsert(
      {
        user_id: opts.userId,
        google_email: email,
        access_token: tok.access_token,
        refresh_token: refreshToken,
        scope: tok.scope ?? null,
        token_type: tok.token_type ?? null,
        expiry_at: expiryAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
  return { email };
}

async function getValidAccessToken(userId: string): Promise<{ token: string; email: string | null } | null> {
  const { data: row } = await supabaseAdmin
    .from("rp_google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return null;

  if (new Date(row.expiry_at as string).getTime() > Date.now() + 30_000) {
    return { token: row.access_token as string, email: (row.google_email as string | null) ?? null };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token as string,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("[google-calendar] refresh failed", res.status, await res.text());
    return null;
  }
  const tok = (await res.json()) as { access_token: string; expires_in: number };
  const expiryAt = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString();
  await supabaseAdmin
    .from("rp_google_calendar_tokens")
    .update({ access_token: tok.access_token, expiry_at: expiryAt, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return { token: tok.access_token, email: (row.google_email as string | null) ?? null };
}

/**
 * Best-effort: insert the meeting into the Google Calendar of every attendee
 * who has connected their calendar. Failures are logged, never thrown.
 */
export async function pushMeetingToAttendeeCalendars(meetingId: string) {
  try {
    const { data: meeting } = await supabaseAdmin
      .from("rp_meetings")
      .select("id, title, agenda, scheduled_start, scheduled_end, meeting_link, location")
      .eq("id", meetingId)
      .maybeSingle();
    if (!meeting) return;

    const { data: attRows } = await supabaseAdmin
      .from("rp_meeting_attendees")
      .select("profile_id")
      .eq("meeting_id", meetingId);
    const attendeeIds = Array.from(new Set((attRows ?? []).map((r: any) => r.profile_id as string)));
    if (!attendeeIds.length) return;

    const { data: tokenRows } = await supabaseAdmin
      .from("rp_google_calendar_tokens")
      .select("user_id, google_email")
      .in("user_id", attendeeIds);
    const connected = tokenRows ?? [];

    const attendeeEmails = connected
      .map((r: any) => r.google_email)
      .filter((e: string | null): e is string => !!e)
      .map((email: string) => ({ email }));

    for (const row of connected) {
      const userId = row.user_id as string;
      const cred = await getValidAccessToken(userId);
      if (!cred) continue;

      const description = [
        meeting.agenda ?? "",
        meeting.meeting_link ? `\n\nJoin: ${meeting.meeting_link}` : "",
      ].join("");

      const event = {
        summary: meeting.title,
        description,
        location: meeting.location ?? meeting.meeting_link ?? undefined,
        start: { dateTime: new Date(meeting.scheduled_start as string).toISOString() },
        end: { dateTime: new Date(meeting.scheduled_end as string).toISOString() },
        attendees: attendeeEmails,
        source: meeting.meeting_link
          ? { title: "Join meeting", url: meeting.meeting_link }
          : undefined,
        reminders: { useDefault: true },
        extendedProperties: { private: { rp_meeting_id: meetingId } },
      };

      try {
        const res = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cred.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(event),
          },
        );
        if (!res.ok) {
          console.error("[google-calendar] insert failed", userId, res.status, await res.text());
        }
      } catch (err) {
        console.error("[google-calendar] insert error", userId, err);
      }
    }
  } catch (err) {
    console.error("[google-calendar] pushMeetingToAttendeeCalendars failed", err);
  }
}

/**
 * Generates a valid iCalendar (RFC 5545) string for a meeting invitation.
 * When attached to an email as text/calendar;method=REQUEST, Gmail and
 * other calendar clients show Accept / Maybe / Decline buttons automatically.
 */
export function buildICSInvite(opts: {
  meetingId: string;
  title: string;
  agenda: string;
  scheduledStart: string;
  scheduledEnd: string;
  meetingLink?: string;
  location?: string;
  organizerEmail: string;
  organizerName: string;
  attendeeEmails: string[];
}): string {
  // RFC 5545 UTC form: YYYYMMDDTHHMMSSZ (no dashes, no colons, no millis, single trailing Z).
  // Using UTC is timezone-safe — every calendar client converts to the viewer's local zone.
  function fmtDate(iso: string) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) throw new Error(`buildICSInvite: invalid date ${iso}`);
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }
  const uid = `rp-${opts.meetingId}@rakshak.crashfreeindia.org`;
  const now = fmtDate(new Date().toISOString());
  const description = [
    opts.agenda,
    opts.meetingLink ? `Join: ${opts.meetingLink}` : "",
  ].filter(Boolean).join("\\n\\n");

  const attendeeLines = opts.attendeeEmails
    .map(email => `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${email}:mailto:${email}`)
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Crashfree India//Rakshak Platform//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${fmtDate(opts.scheduledStart)}`,
    `DTEND:${fmtDate(opts.scheduledEnd)}`,
    `SUMMARY:${opts.title.replace(/\n/g, " ")}`,
    `DESCRIPTION:${description}`,
    opts.location ? `LOCATION:${opts.location}` : "",
    opts.meetingLink ? `URL:${opts.meetingLink}` : "",
    `ORGANIZER;CN=${opts.organizerName}:mailto:${opts.organizerEmail}`,
    attendeeLines,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Meeting reminder",
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Meeting reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

/**
 * Builds a Google Calendar "Add to Calendar" deep link.
 * Works in any email client — no auth required, opens google.com/calendar in browser.
 */
export function buildGCalLink(opts: {
  title: string;
  agenda: string;
  scheduledStart: string;
  scheduledEnd: string;
  meetingLink?: string;
  location?: string;
}): string {
  // Google Calendar expects compact UTC: YYYYMMDDTHHmmSSZ
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const details = [
    opts.agenda,
    opts.meetingLink ? `Join: ${opts.meetingLink}` : '',
  ].filter(Boolean).join('\n\n');

  // Use the physical location if provided, otherwise fall back to the meet link
  const locationVal = opts.location || opts.meetingLink || '';

  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', opts.title);
  params.set('dates', `${fmt(opts.scheduledStart)}/${fmt(opts.scheduledEnd)}`);
  if (details) params.set('details', details);
  if (locationVal) params.set('location', locationVal);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * When a user RSVPs in the portal, update their Google Calendar event RSVP status too.
 */
export async function syncRsvpToGoogleCalendar(opts: {
  meetingId: string;
  userId: string;
  rsvp: 'going' | 'maybe' | 'not_going';
}) {
  const cred = await getValidAccessToken(opts.userId);
  if (!cred || !cred.email) return;

  const searchRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=rp_meeting_id%3D${opts.meetingId}&maxResults=1`,
    { headers: { Authorization: `Bearer ${cred.token}` } },
  );
  if (!searchRes.ok) return;
  const searchData = (await searchRes.json()) as { items?: { id: string }[] };
  const eventId = searchData.items?.[0]?.id;
  if (!eventId) return;

  const partstatMap = { going: 'accepted', maybe: 'tentative', not_going: 'declined' } as const;
  const responseStatus = partstatMap[opts.rsvp];

  const patchRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=none`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${cred.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        attendees: [{ email: cred.email, responseStatus }],
      }),
    },
  );
  if (!patchRes.ok) {
    console.error('[syncRsvpToGoogleCalendar] patch failed', patchRes.status, await patchRes.text());
  }
}
