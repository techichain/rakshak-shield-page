import React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipient_name?: string
  sender_name?: string
  subject?: string
  body_preview?: string
  cta_url?: string
}

const Email = ({
  recipient_name = 'there',
  sender_name = 'A Rakshak user',
  subject = 'New message',
  body_preview = '',
  cta_url = 'https://rakshak.crashfreeindia.org/rakshak-platform/mails',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New message from {sender_name}: {subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New message on Rakshak</Heading>
        <Text style={text}>Hi {recipient_name},</Text>
        <Text style={text}>
          <strong>{sender_name}</strong> sent you a message on the Rakshak platform:
        </Text>
        <Section style={quoteBox}>
          <Text style={subjectLine}>{subject}</Text>
          <Text style={quoteText}>{body_preview}</Text>
        </Section>
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={cta_url} style={button}>Open conversation</Button>
        </Section>
        <Text style={small}>
          Or open: <Link href={cta_url} style={link}>{cta_url}</Link>
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          You received this because you're a participant on this thread. Reply from the Rakshak platform to keep the conversation in one place.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `[Rakshak] ${d?.sender_name ?? 'New message'}: ${d?.subject ?? 'message'}`,
  displayName: 'Mail: new message notification',
  previewData: {
    recipient_name: 'Aarav',
    sender_name: 'Test Mentor',
    subject: 'Phase 2 audit — quick question',
    body_preview: 'Hi team, can you confirm the survey dates for the second blackspot? I want to align mentor review before the deadline.',
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
const quoteBox: React.CSSProperties = { borderLeft: '3px solid #4A35FF', backgroundColor: '#F8FAFC', padding: '14px 16px', borderRadius: 6, margin: '16px 0' }
const subjectLine: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#0F172A', margin: '0 0 8px' }
const quoteText: React.CSSProperties = { fontSize: 14, lineHeight: 1.55, color: '#334155', whiteSpace: 'pre-wrap', margin: 0 }
