import React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipient_name?: string
  pending_count?: number | string
  phase_number?: number | string
  deadline_date?: string
  custom_message?: string
  cta_url?: string
  sender_name?: string
}

const Email = ({
  recipient_name = 'there',
  pending_count,
  phase_number,
  deadline_date = 'the announced date',
  custom_message,
  cta_url = 'https://rakshak.crashfreeindia.org/rakshak-platform/evaluator',
  sender_name,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {phase_number ? `Phase ${phase_number} evaluation ` : 'Evaluation '}
      due {deadline_date}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Evaluation deadline reminder</Heading>
        <Text style={text}>Hi {recipient_name},</Text>
        <Text style={text}>
          {pending_count
            ? <>You have <strong>{pending_count}</strong> team{Number(pending_count) === 1 ? '' : 's'} awaiting your evaluation</>
            : <>You have team submissions awaiting evaluation</>}
          {phase_number ? <> for <strong>Phase {phase_number}</strong></> : null}.
          {' '}Please complete and submit your scores by{' '}
          <strong>{deadline_date}</strong>.
        </Text>
        {custom_message ? (
          <Text style={{ ...text, borderLeft: '3px solid #4A35FF', paddingLeft: 12, whiteSpace: 'pre-wrap' }}>
            {custom_message}
          </Text>
        ) : null}
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={cta_url} style={button}>Open evaluator portal</Button>
        </Section>
        <Text style={small}>
          Or open: <Link href={cta_url} style={link}>{cta_url}</Link>
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          {sender_name ? `Sent by ${sender_name} · ` : ''}Crashfree India · Rakshak Platform
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d?.phase_number
      ? `Evaluator reminder: Phase ${d.phase_number} due ${d?.deadline_date ?? 'soon'} — Rakshak Platform`
      : `Evaluator reminder — Rakshak Platform`,
  displayName: 'Evaluator: evaluation deadline',
  previewData: {
    recipient_name: 'Rohan',
    pending_count: 6,
    phase_number: 2,
    deadline_date: '18 July 2026',
    custom_message: 'Prioritise the three teams flagged in the tracker.',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '32px 24px' }
const h1: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: '#0F172A', margin: '0 0 16px' }
const text: React.CSSProperties = { fontSize: 15, lineHeight: 1.6, color: '#1F2937', margin: '0 0 14px' }
const small: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, color: '#64748B', margin: '12px 0' }
const button: React.CSSProperties = {
  backgroundColor: '#4A35FF', color: '#ffffff', borderRadius: 8,
  padding: '12px 28px', fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'inline-block',
}
const link: React.CSSProperties = { color: '#4A35FF', wordBreak: 'break-all' }
const hr: React.CSSProperties = { border: 'none', borderTop: '1px solid #E2E8F0', margin: '28px 0 16px' }
const footer: React.CSSProperties = { fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }
