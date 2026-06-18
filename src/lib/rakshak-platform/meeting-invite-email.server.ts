/**
 * Sends a meeting invite email via the Lovable transactional email queue.
 * Uses the rp-meeting-scheduled template and enqueue_email RPC, so no
 * external email provider (Resend) is required.
 */

import { supabaseAdmin } from '@/integrations/supabase/client.server'

const SITE_NAME = 'rakshak-crashfreeindia'
const SENDER_DOMAIN = 'notify.rakshak.crashfreeindia.org'
const FROM_DOMAIN = 'rakshak.crashfreeindia.org'
const PORTAL_BASE = 'https://rakshak.crashfreeindia.org'

/**
 * Build a Google Calendar deep-link for one-click add.
 */
function buildGCalLink(opts: {
  title: string
  agenda: string
  scheduledStart: string
  scheduledEnd: string
  meetingLink?: string
  location?: string
}): string {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const details = [opts.agenda, opts.meetingLink ? `Join: ${opts.meetingLink}` : '']
    .filter(Boolean)
    .join('\n\n')
  const p = new URLSearchParams()
  p.set('action', 'TEMPLATE')
  p.set('text', opts.title)
  p.set('dates', `${fmt(opts.scheduledStart)}/${fmt(opts.scheduledEnd)}`)
  if (details) p.set('details', details)
  if (opts.location || opts.meetingLink) p.set('location', opts.location ?? opts.meetingLink ?? '')
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

/**
 * Returns an unsubscribe token for the given email (creates one if needed).
 */
async function getOrCreateUnsubscribeToken(email: string): Promise<string> {
  const normalized = email.toLowerCase()
  const { data: existing } = await supabaseAdmin
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalized)
    .maybeSingle()

  if (existing && !existing.used_at) {
    return existing.token as string
  }

  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  await supabaseAdmin
    .from('email_unsubscribe_tokens')
    .upsert({ token, email: normalized }, { onConflict: 'email', ignoreDuplicates: true })

  const { data: stored } = await supabaseAdmin
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', normalized)
    .maybeSingle()

  return (stored?.token as string) || token
}

export async function sendMeetingInviteViaResend(opts: {
  meetingId: string
  recipientEmail: string
  recipientName: string
  organizerEmail: string
  organizerName: string
  recipientTimezone?: string
}): Promise<void> {
  const { data: meeting } = await supabaseAdmin
    .from('rp_meetings')
    .select('id, title, agenda, scheduled_start, scheduled_end, meeting_link, location, created_by')
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

  const gcalLink = buildGCalLink({
    title: meeting.title,
    agenda: meeting.agenda ?? '',
    scheduledStart: meeting.scheduled_start as string,
    scheduledEnd: meeting.scheduled_end as string,
    meetingLink: meeting.meeting_link ?? undefined,
    location: meeting.location ?? undefined,
  })
  const icsUrl = `${PORTAL_BASE}/api/meeting-ics/${meeting.id}`
  const portalUrl = `${PORTAL_BASE}/rakshak-platform/meetings`

  // Render email using the rp-meeting-scheduled template
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
  const plainText = await render(element, { plainText: true })
  const subject =
    typeof tpl.subject === 'function'
      ? tpl.subject({ title: meeting.title })
      : tpl.subject

  const messageId = crypto.randomUUID()
  const unsubscribeToken = await getOrCreateUnsubscribeToken(opts.recipientEmail)

  await supabaseAdmin.from('email_send_log').insert({
    message_id: messageId,
    template_name: 'rp-meeting-scheduled',
    recipient_email: opts.recipientEmail,
    status: 'pending',
    metadata: { meeting_id: opts.meetingId, via: 'enqueue_email' },
  })

  const { error: enqErr } = await supabaseAdmin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: opts.recipientEmail,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: 'rp-meeting-scheduled',
      unsubscribe_token: unsubscribeToken,
      idempotency_key: messageId,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqErr) {
    await supabaseAdmin
      .from('email_send_log')
      .update({ status: 'failed', error_message: enqErr.message })
      .eq('message_id', messageId)
    console.error('[meeting-invite] enqueue failed:', enqErr.message)
    return
  }

  console.log('[meeting-invite] enqueued via Lovable email to', opts.recipientEmail)
}
