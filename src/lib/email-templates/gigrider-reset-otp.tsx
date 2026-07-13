import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  code?: string;
  expiresInMinutes?: number;
}

const GigriderResetOtpEmail = ({
  code = "000000",
  expiresInMinutes = 10,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Gig Rider admin password reset code is {code}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Reset your admin password</Heading>
        <Text style={text}>
          A password reset was requested for the <strong>Gig Rider Safety
          Checklist</strong> admin account. Use the 6-digit code below to set a
          new password.
        </Text>
        <Section style={codeBox}>
          <Text style={codeStyle}>{code}</Text>
        </Section>
        <Text style={text}>
          This code expires in {expiresInMinutes} minutes. If you didn't
          request this reset, you can safely ignore this email — the password
          will not be changed.
        </Text>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  padding: "24px 0",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e6ebf1",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "480px",
  padding: "32px",
};

const h1 = {
  color: "#0f172a",
  fontSize: "20px",
  fontWeight: 700,
  margin: "0 0 16px",
};

const text = {
  color: "#334155",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 16px",
};

const codeBox = {
  backgroundColor: "#f1f5f9",
  borderRadius: "8px",
  padding: "16px",
  textAlign: "center" as const,
  margin: "0 0 16px",
};

const codeStyle = {
  color: "#0f172a",
  fontSize: "28px",
  fontWeight: 700,
  letterSpacing: "8px",
  margin: 0,
};

export const template: TemplateEntry = {
  component: GigriderResetOtpEmail,
  subject: (data: Record<string, unknown>) =>
    `Gig Rider admin reset code: ${data.code ?? ""}`,
  displayName: "Gig Rider admin password reset OTP",
  previewData: { code: "123456", expiresInMinutes: 10 },
};

export default GigriderResetOtpEmail;
