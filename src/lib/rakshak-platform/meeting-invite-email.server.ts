/**
 * Sends a meeting invite email via the Resend connector gateway with an
 * ICS attachment (so recipients see Accept/Decline buttons in Gmail/Outlook).
 *
 * Uses the same connector-gateway pattern as meeting-reminders.ts — the
 * direct Resend SDK path has auth-format issues in this runtime; the
 * gateway normalises that.
 */

import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { buildICSInvite } from './google-calendar.server'

const FROM_DOMAIN = 'rakshak.crashfreeindia.org'
const PORTAL_BASE = 'https://rakshak.crashfreeindia.org'

export async function sendMeetingInviteViaResend(opts: {
  meetingId: string
  recipientEmail: string
  recipientName: string
  organizerEmail: string
  organizerName: string
  recipientTimezone?: string
}): Promise<void> {
  const RESEND = process.env.RESEND_API_KEY
  const LOVABLE = process.env.LOVABLE_API_KEY
  if (!RESEND || !LOVABLE) {
    console.error(
      '[meeting-invite] RESEND_API_KEY or LOVABLE_API_KEY not set. Meeting invite NOT sent to',
      opts.recipientEmail,
    )
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
  })
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
  const portalUrl = `${PORTAL_BASE}/rakshak-platform/meetings`

  // Render the HTML via the existing react-email template
  const React = await import('react')
  const { render } = await import('@react-email/components')
  const { TEMPLATES } = await import('@/lib/email-templates/registry')
  const tpl = TEMPLATES['rp-meeting-scheduled']
  if (!tpl) {
    console.error('[meeting-invite] template missing')
    return
  }
  const element = React.createElement(tpl.component, {
    recipient_name: opts.recipientName,
    title: meeting.title,
    agenda: meeting.agenda ?? undefined,
    scheduled_start: startStr,
    scheduled_end: endStr,
    timezone: tz,
    meeting_link: meeting.meeting_link ?? undefined,
    location: meeting.location ?? undefined,
    organizer_name: opts.organizerName,
    portal_url: portalUrl,
    gcal_link: gcalLink,
    ics_url: icsUrl,
  })
  const html = await render(element)
  const subject =
    typeof tpl.subject === 'function'
      ? tpl.subject({ title: meeting.title })
      : tpl.subject

  const icsContent = buildICSInvite({
    meetingId: meeting.id,
    title: meeting.title,
    agenda: meeting.agenda ?? '',
    scheduledStart: meeting.scheduled_start as string,
    scheduledEnd: meeting.scheduled_end as string,
    meetingLink: meeting.meeting_link ?? undefined,
    location: meeting.location ?? undefined,
    organizerEmail: opts.organizerEmail,
    organizerName: opts.organizerName,
    attendeeEmails: [opts.recipientEmail],
  })

  const messageId = crypto.randomUUID()
  const safeTitle = meeting.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()

  try {
    const res = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOVABLE}`,
        'X-Connection-Api-Key': RESEND,
      },
      body: JSON.stringify({
        from: `Rakshak Platform <noreply@${FROM_DOMAIN}>`,
        reply_to: opts.organizerEmail,
        to: [opts.recipientEmail],
        subject,
        html,
        attachments: [
          {
            filename: `${safeTitle}.ics`,
            content: btoa(unescape(encodeURIComponent(icsContent))),
            content_type: 'text/calendar; charset=utf-8; method=REQUEST',
          },
        ],
      }),
    })

    const resBody = (await res.json()) as any

    if (!res.ok) {
      console.error(
        '[meeting-invite] connector-gateway failed:',
        res.status,
        JSON.stringify(resBody),
      )
      await supabaseAdmin.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'rp-meeting-scheduled',
        recipient_email: opts.recipientEmail,
        status: 'failed',
        error_message: JSON.stringify(resBody),
        metadata: { meeting_id: opts.meetingId, via: 'resend_ics' },
      })
      return
    }

    const resendMessageId = resBody?.id ?? null
    console.log(
      '[meeting-invite] sent via gateway to',
      opts.recipientEmail,
      '| resend_id:',
      resendMessageId,
    )

    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'rp-meeting-scheduled',
      recipient_email: opts.recipientEmail,
      status: 'sent',
      metadata: {
        meeting_id: opts.meetingId,
        via: 'resend_ics',
        resend_message_id: resendMessageId,
      },
    })
  } catch (err) {
    console.error('[meeting-invite] gateway threw', err)
    await supabaseAdmin
      .from('email_send_log')
      .insert({
        message_id: messageId,
        template_name: 'rp-meeting-scheduled',
        recipient_email: opts.recipientEmail,
        status: 'failed',
        error_message: String(err),
        metadata: { meeting_id: opts.meetingId, via: 'resend_ics' },
      })
      .then(() => {}, () => {})
  }
}
