/**
 * Sends a meeting invite email with a text/calendar attachment via Resend.
 * The .ics attachment with METHOD:REQUEST causes Gmail to show native
 * Accept / Tentative / Decline RSVP buttons and adds the event to the
 * recipient's Google Calendar automatically on accept.
 *
 * This bypasses the Lovable email queue because sendLovableEmail does not
 * support MIME attachments — it only sends flat { html, text } payloads.
 */

import { Resend } from 'resend'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

const FROM_DOMAIN = 'rakshak.crashfreeindia.org'
const SENDER_DOMAIN = 'notify.rakshak.crashfreeindia.org'
const PORTAL_BASE = 'https://rakshak.crashfreeindia.org'

function fmtICS(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function buildICS(opts: {
  meetingId: string
  title: string
  agenda: string
  scheduledStart: string
  scheduledEnd: string
  meetingLink?: string
  location?: string
  organizerEmail: string
  organizerName: string
  attendeeEmail: string
  attendeeName: string
  sequence?: number
}): string {
  const uid = `rp-${opts.meetingId}@rakshak.crashfreeindia.org`
  const now = fmtICS(new Date().toISOString())
  const description = [
    opts.agenda,
    opts.meetingLink ? `Join: ${opts.meetingLink}` : '',
  ]
    .filter(Boolean)
    .join('\\n\\n')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Crashfree India//Rakshak Platform//EN',
    'METHOD:REQUEST',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${fmtICS(opts.scheduledStart)}`,
    `DTEND:${fmtICS(opts.scheduledEnd)}`,
    `SUMMARY:${opts.title.replace(/\n/g, ' ')}`,
    description ? `DESCRIPTION:${description}` : '',
    opts.location
      ? `LOCATION:${opts.location}`
      : opts.meetingLink
        ? `LOCATION:${opts.meetingLink}`
        : '',
    opts.meetingLink ? `URL:${opts.meetingLink}` : '',
    `ORGANIZER;CN="${opts.organizerName}":mailto:${opts.organizerEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="${opts.attendeeName}":mailto:${opts.attendeeEmail}`,
    `STATUS:CONFIRMED`,
    `SEQUENCE:${opts.sequence ?? 0}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Meeting reminder',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Meeting reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

function buildEmailHTML(opts: {
  recipientName: string
  title: string
  agenda?: string
  startStr: string
  endStr: string
  meetingLink?: string
  location?: string
  organizerName?: string
  portalUrl: string
  gcalLink: string
  icsUrl: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td>
        <h1 style="font-size:22px;font-weight:700;color:#0F172A;margin:0 0 8px;">Meeting scheduled — ${opts.title}</h1>
        <p style="font-size:15px;color:#1F2937;margin:0 0 14px;">Hi ${opts.recipientName},</p>
        <p style="font-size:15px;color:#1F2937;margin:0 0 20px;">
          A meeting has been scheduled on the Rakshak Platform${opts.organizerName ? ` by <strong>${opts.organizerName}</strong>` : ''}.
        </p>
        <table width="100%" cellpadding="16" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;margin:0 0 20px;">
          <tr><td>
            <p style="font-size:14px;color:#1F2937;margin:0 0 8px;"><strong>When:</strong> ${opts.startStr} → ${opts.endStr}</p>
            ${opts.meetingLink ? `<p style="font-size:14px;color:#1F2937;margin:0 0 8px;"><strong>Join:</strong> <a href="${opts.meetingLink}" style="color:#4A35FF;">${opts.meetingLink}</a></p>` : ''}
            ${opts.location ? `<p style="font-size:14px;color:#1F2937;margin:0 0 8px;"><strong>Location:</strong> ${opts.location}</p>` : ''}
            ${opts.agenda ? `<p style="font-size:14px;color:#1F2937;margin:0;"><strong>Agenda:</strong><br>${opts.agenda}</p>` : ''}
          </td></tr>
        </table>
        <p style="font-size:13px;color:#64748B;margin:0 0 4px;text-align:center;">
          <strong>To RSVP and add to your calendar, open the .ics attachment above</strong><br>
          or use the buttons below:
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;text-align:center;">
          <tr>
            <td style="padding:0 4px;">
              <a href="${opts.gcalLink}" target="_blank" style="background:#059669;color:#fff;border-radius:8px;padding:11px 22px;font-size:13px;font-weight:600;text-decoration:none;display:inline-block;">&#x1F4C5; Add to Google Calendar</a>
            </td>
            <td style="padding:0 4px;">
              <a href="${opts.icsUrl}" target="_blank" style="background:#0284C7;color:#fff;border-radius:8px;padding:11px 22px;font-size:13px;font-weight:600;text-decoration:none;display:inline-block;">&#x1F4E5; Download .ics</a>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;text-align:center;">
          <tr><td>
            <a href="${opts.portalUrl}" target="_blank" style="background:#4A35FF;color:#fff;border-radius:8px;padding:12px 28px;font-size:15px;font-weight:600;text-decoration:none;display:inline-block;">Open meeting in portal</a>
          </td></tr>
        </table>
        <p style="font-size:12px;color:#94A3B8;margin:24px 0 0;text-align:center;">
          Crashfree India · Project Rakshak · <a href="https://rakshak.crashfreeindia.org" style="color:#94A3B8;">rakshak.crashfreeindia.org</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

export async function sendMeetingInviteViaResend(opts: {
  meetingId: string
  recipientEmail: string
  recipientName: string
  organizerEmail: string
  organizerName: string
  recipientTimezone?: string
}): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.error('[meeting-invite] RESEND_API_KEY not set — falling back to queue')
    return
  }

  const { data: meeting } = await supabaseAdmin
    .from('rp_meetings')
    .select('id, title, agenda, scheduled_start, scheduled_end, meeting_link, location')
    .eq('id', opts.meetingId)
    .maybeSingle()

  if (!meeting) {
    console.error('[meeting-invite] meeting not found', opts.meetingId)
    return
  }

  const tz = opts.recipientTimezone || 'Asia/Kolkata'
  const startStr = new Date(meeting.scheduled_start as string).toLocaleString('en-IN', {
    timeZone: tz,
    dateStyle: 'full',
    timeStyle: 'short',
  }) + ` (${tz})`
  const endStr = new Date(meeting.scheduled_end as string).toLocaleString('en-IN', {
    timeZone: tz,
    timeStyle: 'short',
  })


  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const details = [
    meeting.agenda ?? '',
    meeting.meeting_link ? `Join: ${meeting.meeting_link}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  const gcalParams = new URLSearchParams()
  gcalParams.set('action', 'TEMPLATE')
  gcalParams.set('text', meeting.title)
  gcalParams.set(
    'dates',
    `${fmt(meeting.scheduled_start as string)}/${fmt(meeting.scheduled_end as string)}`,
  )
  if (details) gcalParams.set('details', details)
  if (meeting.location || meeting.meeting_link)
    gcalParams.set('location', meeting.location ?? meeting.meeting_link ?? '')
  const gcalLink = `https://calendar.google.com/calendar/render?${gcalParams.toString()}`
  const icsUrl = `${PORTAL_BASE}/api/meeting-ics/${meeting.id}`

  const icsContent = buildICS({
    meetingId: meeting.id,
    title: meeting.title,
    agenda: meeting.agenda ?? '',
    scheduledStart: meeting.scheduled_start as string,
    scheduledEnd: meeting.scheduled_end as string,
    meetingLink: meeting.meeting_link ?? undefined,
    location: meeting.location ?? undefined,
    organizerEmail: opts.organizerEmail,
    organizerName: opts.organizerName,
    attendeeEmail: opts.recipientEmail,
    attendeeName: opts.recipientName,
  })

  const html = buildEmailHTML({
    recipientName: opts.recipientName,
    title: meeting.title,
    agenda: meeting.agenda ?? undefined,
    startStr,
    endStr,
    meetingLink: meeting.meeting_link ?? undefined,
    location: meeting.location ?? undefined,
    organizerName: opts.organizerName,
    portalUrl: `${PORTAL_BASE}/rakshak-platform/meetings`,
    gcalLink,
    icsUrl,
  })

  const resend = new Resend(resendKey)

  try {
    const { error } = await resend.emails.send({
      from: `${opts.organizerName || 'Crashfree India'} <noreply@${SENDER_DOMAIN}>`,
      to: opts.recipientEmail,
      subject: `Meeting invite: ${meeting.title}`,
      html,
      attachments: [
        {
          filename: `${meeting.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`,
          content: Buffer.from(icsContent).toString('base64'),
        },
      ],
    })

    if (error) {
      console.error('[meeting-invite] Resend error', error)
      return
    }

    const messageId = crypto.randomUUID()
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'rp-meeting-scheduled',
      recipient_email: opts.recipientEmail,
      status: 'sent',
      metadata: { meeting_id: opts.meetingId, via: 'resend_ics' },
    })

    console.log('[meeting-invite] sent via Resend to', opts.recipientEmail)
  } catch (err) {
    console.error('[meeting-invite] Resend threw', err)
  }
}
