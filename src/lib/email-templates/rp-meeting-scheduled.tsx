import React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipient_name?: string
  title?: string
  agenda?: string
  scheduled_start?: string
  scheduled_end?: string
  timezone?: string
  meeting_link?: string
  location?: string
  organizer_name?: string
  portal_url?: string
  gcal_link?: string
  ics_url?: string
}

const Email = ({
  recipient_name = 'there',
  title = 'Rakshak meeting',
  agenda,
  scheduled_start,
  scheduled_end,
  timezone,
  meeting_link,
  location,
  organizer_name,
  portal_url = 'https://rakshak.crashfreeindia.org/rakshak-platform/meetings',
  gcal_link,
  ics_url,
}: Props) => {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Meeting scheduled: {title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Meeting scheduled — {title}</Heading>
          <Text style={text}>Hi {recipient_name},</Text>
          <Text style={text}>
            A meeting has been scheduled on the Rakshak Platform
            {organizer_name ? ` by ${organizer_name}` : ''}.
          </Text>
          <Section style={card}>
            <Text style={cardRow}><strong>When:</strong> {scheduled_start}{scheduled_end ? ` → ${scheduled_end}` : ''}{timezone ? ` (${timezone})` : ''}</Text>
            {meeting_link ? (
              <Text style={cardRow}><strong>Join:</strong> <Link href={meeting_link} style={link}>{meeting_link}</Link></Text>
            ) : null}
            {location ? <Text style={cardRow}><strong>Location:</strong> {location}</Text> : null}
            {agenda ? <Text style={cardRow}><strong>Agenda:</strong><br />{agenda}</Text> : null}
          </Section>
          {(gcal_link || ics_url) ? (
            <Section style={{ textAlign: 'center', margin: '16px 0' }}>
              <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' }}>
                <tr>
                  {gcal_link ? (
                    <td style={{ textAlign: 'center', paddingRight: ics_url ? 6 : 0 }}>
                      <Button href={gcal_link} style={{ ...button, backgroundColor: '#059669', padding: '10px 20px', fontSize: 13 }}>
                        📅 Google Calendar
                      </Button>
                    </td>
                  ) : null}
                  {ics_url ? (
                    <td style={{ textAlign: 'center', paddingLeft: gcal_link ? 6 : 0 }}>
                      <Button href={ics_url} style={{ ...button, backgroundColor: '#0284C7', padding: '10px 20px', fontSize: 13 }}>
                        📥 Download .ics
                      </Button>
                    </td>
                  ) : null}
                </tr>
              </table>
            </Section>
          ) : null}
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={portal_url} style={button}>Open meeting</Button>
          </Section>
          <Text style={small}>
            Reminders will be sent 24h, 1h and 30m before the meeting. You can
            RSVP, reschedule, or add the meeting to your calendar from the portal.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Crashfree India · Rakshak Platform</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Meeting scheduled — ${data?.title ?? 'Rakshak Platform'}`,
  displayName: 'Meeting: scheduled',
  previewData: {
    recipient_name: 'Asha Verma',
    title: 'Phase 2 review with mentor',
    agenda: 'Walk through the field data captured last week.',
    scheduled_start: new Date(Date.now() + 86400000).toLocaleString(),
    scheduled_end: new Date(Date.now() + 86400000 + 3600000).toLocaleString(),
    timezone: 'Asia/Kolkata',
    meeting_link: 'https://meet.jit.si/rakshak-demo',
    organizer_name: 'Muskan',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '32px 24px' }
const h1: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: '#0F172A', margin: '0 0 16px' }
const text: React.CSSProperties = { fontSize: 15, lineHeight: 1.6, color: '#1F2937', margin: '0 0 14px' }
const small: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, color: '#64748B', margin: '12px 0' }
const card: React.CSSProperties = { backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, margin: '16px 0' }
const cardRow: React.CSSProperties = { fontSize: 14, lineHeight: 1.6, color: '#1F2937', margin: '0 0 8px' }
const button: React.CSSProperties = {
  backgroundColor: '#4A35FF', color: '#ffffff', borderRadius: 8,
  padding: '12px 28px', fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'inline-block',
}
const link: React.CSSProperties = { color: '#4A35FF', wordBreak: 'break-all' }
const hr: React.CSSProperties = { border: 'none', borderTop: '1px solid #E2E8F0', margin: '28px 0 16px' }
const footer: React.CSSProperties = { fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }
