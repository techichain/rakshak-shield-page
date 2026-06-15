import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as registrationOtpTemplate } from './registration-otp'
import { template as mentorFileRequestTemplate } from './mentor-file-request'
import { template as gigriderResetOtpTemplate } from './gigrider-reset-otp'
import { template as rpAdminRoleRequestTemplate } from './rp-admin-role-request'
import { template as rpRoleDecisionTemplate } from './rp-role-decision'
import { template as rpMeetingScheduledTemplate } from './rp-meeting-scheduled'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'registration-otp': registrationOtpTemplate,
  'mentor-file-request': mentorFileRequestTemplate,
  'gigrider-reset-otp': gigriderResetOtpTemplate,
  'rp-admin-role-request': rpAdminRoleRequestTemplate,
  'rp-role-decision': rpRoleDecisionTemplate,
  'rp-meeting-scheduled': rpMeetingScheduledTemplate,
}

