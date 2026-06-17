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
      new Set(
        ((attRows ?? []).map((r: any) => r.profile_id) as string[])
          .filter((id): id is string => Boolean(id) && id !== meeting.created_by)
      ),
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

    // Build the Google Calendar deep link + ics URL once for all attendees
    const { buildGCalLink } = await import('./google-calendar.server')
    const gcalLink = buildGCalLink({
      title: meeting.title,
      agenda: meeting.agenda ?? '',
      scheduledStart: meeting.scheduled_start as string,
      scheduledEnd: meeting.scheduled_end as string,
      meetingLink: meeting.meeting_link ?? undefined,
      location: meeting.location ?? undefined,
    })
    const icsUrl = `${PORTAL_BASE}/rakshak-platform/meetings/ics/${meeting.id}`

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

        // Transactional emails MUST carry an unsubscribe token, or the
        // Lovable email API rejects them with 400 missing_unsubscribe.
        const normalizedEmail = (p.email as string).toLowerCase()
        let unsubscribeToken: string | null = null
        {
          const { data: existing } = await supabaseAdmin
            .from('email_unsubscribe_tokens')
            .select('token, used_at')
            .eq('email', normalizedEmail)
            .maybeSingle()
          if (existing && !existing.used_at) {
            unsubscribeToken = existing.token as string
          } else {
            const bytes = new Uint8Array(32)
            crypto.getRandomValues(bytes)
            const token = Array.from(bytes)
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('')
            await supabaseAdmin
              .from('email_unsubscribe_tokens')
              .upsert(
                { token, email: normalizedEmail },
                { onConflict: 'email', ignoreDuplicates: true },
              )
            const { data: stored } = await supabaseAdmin
              .from('email_unsubscribe_tokens')
              .select('token')
              .eq('email', normalizedEmail)
              .maybeSingle()
            unsubscribeToken = (stored?.token as string) || token
          }
        }

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
        }
      } catch (err) {
        console.error('[meeting-notify] enqueue failed for', p.email, err)
      }
    }
  } catch (err) {
    console.error('[meeting-notify] failed', err)
  }

  // Best-effort: push event to attendees' Google Calendars (per-user OAuth).
  try {
    const { pushMeetingToAttendeeCalendars } = await import('./google-calendar.server')
    await pushMeetingToAttendeeCalendars(meetingId)
    console.log('[meeting-notify] gcal push attempted for', meetingId)
  } catch (err) {
    console.error('[meeting-notify] gcal push failed (non-fatal):', err)
  }
}

/**
 * Send the meeting-scheduled email directly to a list of raw email addresses
 * (people who don't necessarily have a profile). Best-effort; failures logged.
 */
export async function sendMeetingEmailToAddresses(
  meetingId: string,
  emails: string[],
) {
  try {
    const cleaned = Array.from(
      new Set(
        (emails ?? [])
          .map((e) => (e ?? '').trim().toLowerCase())
          .filter((e) => /.+@.+\..+/.test(e)),
      ),
    )
    if (cleaned.length === 0) return

    const { data: meeting, error: mErr } = await supabaseAdmin
      .from('rp_meetings')
      .select(
        'id, title, agenda, scheduled_start, scheduled_end, meeting_link, location, created_by',
      )
      .eq('id', meetingId)
      .maybeSingle()
    if (mErr || !meeting) {
      console.error('[meeting-notify:addresses] meeting lookup failed', mErr)
      return
    }

    const { data: organizerRow } = await supabaseAdmin
      .from('rp_profiles')
      .select('full_name')
      .eq('id', meeting.created_by)
      .maybeSingle()
    const organizer = organizerRow?.full_name ?? null

    const React = await import('react')
    const { render } = await import('@react-email/components')
    const { TEMPLATES } = await import('@/lib/email-templates/registry')
    const tpl = TEMPLATES['rp-meeting-scheduled']
    if (!tpl) {
      console.error('[meeting-notify:addresses] template missing')
      return
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const startStr = new Date(meeting.scheduled_start as string).toLocaleString()
    const endStr = new Date(meeting.scheduled_end as string).toLocaleString()
    const portalUrl = `${PORTAL_BASE}/rakshak-platform/meetings`

    const { buildICSInvite } = await import('./google-calendar.server')
    const { data: organizerRow2 } = await supabaseAdmin
      .from('rp_profiles')
      .select('full_name, email')
      .eq('id', meeting.created_by)
      .maybeSingle()
    const orgEmail = (organizerRow2 as any)?.email ?? `noreply@${FROM_DOMAIN}`
    const orgName = (organizerRow2 as any)?.full_name ?? 'Rakshak Platform'
    const icsContentExt = buildICSInvite({
      meetingId: meeting.id,
      title: meeting.title,
      agenda: meeting.agenda ?? '',
      scheduledStart: meeting.scheduled_start as string,
      scheduledEnd: meeting.scheduled_end as string,
      meetingLink: meeting.meeting_link ?? undefined,
      location: meeting.location ?? undefined,
      organizerEmail: orgEmail,
      organizerName: orgName,
      attendeeEmails: cleaned,
    })

    for (const email of cleaned) {
      try {
        const element = React.createElement(tpl.component, {
          recipient_name: email.split('@')[0],
          title: meeting.title,
          agenda: meeting.agenda ?? undefined,
          scheduled_start: startStr,
          scheduled_end: endStr,
          timezone: tz,
          meeting_link: meeting.meeting_link ?? undefined,
          location: meeting.location ?? undefined,
          organizer_name: organizer ?? undefined,
          portal_url: portalUrl,
          ical_content: icsContentExt,
        })
        const html = await render(element)
        const plainText = await render(element, { plainText: true })
        const subject =
          typeof tpl.subject === 'function'
            ? tpl.subject({ title: meeting.title })
            : tpl.subject
        const messageId = crypto.randomUUID()

        // Unsubscribe token (required by Lovable email API)
        let unsubscribeToken: string | null = null
        {
          const { data: existing } = await supabaseAdmin
            .from('email_unsubscribe_tokens')
            .select('token, used_at')
            .eq('email', email)
            .maybeSingle()
          if (existing && !existing.used_at) {
            unsubscribeToken = existing.token as string
          } else {
            const bytes = new Uint8Array(32)
            crypto.getRandomValues(bytes)
            const token = Array.from(bytes)
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('')
            await supabaseAdmin
              .from('email_unsubscribe_tokens')
              .upsert(
                { token, email },
                { onConflict: 'email', ignoreDuplicates: true },
              )
            const { data: stored } = await supabaseAdmin
              .from('email_unsubscribe_tokens')
              .select('token')
              .eq('email', email)
              .maybeSingle()
            unsubscribeToken = (stored?.token as string) || token
          }
        }

        await supabaseAdmin.from('email_send_log').insert({
          message_id: messageId,
          template_name: 'rp-meeting-scheduled',
          recipient_email: email,
          status: 'pending',
          metadata: { meeting_id: meetingId, external_invite: true },
        })

        const { error: enqErr } = await supabaseAdmin.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: email,
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
        }
      } catch (err) {
        console.error('[meeting-notify:addresses] enqueue failed for', email, err)
      }
    }
  } catch (err) {
    console.error('[meeting-notify:addresses] failed', err)
  }
}
