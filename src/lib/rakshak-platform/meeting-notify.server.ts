import { supabaseAdmin } from '@/integrations/supabase/client.server'

const SITE_NAME = 'rakshak-crashfreeindia'
const SENDER_DOMAIN = 'notify.rakshak.crashfreeindia.org'
const FROM_DOMAIN = 'rakshak.crashfreeindia.org'
const PORTAL_BASE = 'https://rakshak.crashfreeindia.org'

/**
 * Send "meeting scheduled" confirmation emails to every attendee of the given
 * meeting. Reuses the existing email_send_log + enqueue_email pipeline.
 * Failures are logged but never thrown — email is best-effort.
 */
export async function sendMeetingScheduledEmails(meetingId: string) {
  try {
    const { data: meeting, error: mErr } = await supabaseAdmin
      .from('rp_meetings')
      .select(
        'id, title, agenda, scheduled_start, scheduled_end, meeting_link, location, created_by',
      )
      .eq('id', meetingId)
      .maybeSingle()
    if (mErr || !meeting) {
      console.error('[meeting-notify] meeting lookup failed', mErr)
      return
    }

    const { data: attRows } = await supabaseAdmin
      .from('rp_meeting_attendees')
      .select('profile_id')
      .eq('meeting_id', meetingId)
    const attendeeIds = Array.from(
      new Set([
        meeting.created_by,
        ...((attRows ?? []).map((r: any) => r.profile_id) as string[]),
      ].filter(Boolean) as string[]),
    )
    if (attendeeIds.length === 0) return

    const { data: profiles } = await supabaseAdmin
      .from('rp_profiles')
      .select('id, full_name, email')
      .in('id', attendeeIds)
    const people = (profiles ?? []).filter((p: any) => !!p.email)
    if (people.length === 0) return

    const organizer =
      people.find((p: any) => p.id === meeting.created_by)?.full_name ?? null

    const React = await import('react')
    const { render } = await import('@react-email/components')
    const { TEMPLATES } = await import('@/lib/email-templates/registry')
    const tpl = TEMPLATES['rp-meeting-scheduled']
    if (!tpl) {
      console.error('[meeting-notify] template missing')
      return
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const startStr = new Date(meeting.scheduled_start as string).toLocaleString()
    const endStr = new Date(meeting.scheduled_end as string).toLocaleString()
    const portalUrl = `${PORTAL_BASE}/rakshak-platform/meetings`

    for (const p of people as any[]) {
      try {
        const element = React.createElement(tpl.component, {
          recipient_name: p.full_name ?? (p.email as string).split('@')[0],
          title: meeting.title,
          agenda: meeting.agenda ?? undefined,
          scheduled_start: startStr,
          scheduled_end: endStr,
          timezone: tz,
          meeting_link: meeting.meeting_link ?? undefined,
          location: meeting.location ?? undefined,
          organizer_name: organizer ?? undefined,
          portal_url: portalUrl,
        })
        const html = await render(element)
        const plainText = await render(element, { plainText: true })
        const subject =
          typeof tpl.subject === 'function'
            ? tpl.subject({ title: meeting.title })
            : tpl.subject
        const messageId = crypto.randomUUID()

        await supabaseAdmin.from('email_send_log').insert({
          message_id: messageId,
          template_name: 'rp-meeting-scheduled',
          recipient_email: p.email,
          status: 'pending',
          metadata: { meeting_id: meetingId, recipient_profile_id: p.id },
        })

        const { error: enqErr } = await supabaseAdmin.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: p.email,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text: plainText,
            purpose: 'transactional',
            label: 'rp-meeting-scheduled',
            idempotency_key: messageId,
            queued_at: new Date().toISOString(),
          },
        })
        if (enqErr) {
          await supabaseAdmin
            .from('email_send_log')
            .update({ status: 'failed', error_message: enqErr.message })
            .eq('message_id', messageId)
        }
      } catch (err) {
        console.error('[meeting-notify] enqueue failed for', p.email, err)
      }
    }
  } catch (err) {
    console.error('[meeting-notify] failed', err)
  }
}
