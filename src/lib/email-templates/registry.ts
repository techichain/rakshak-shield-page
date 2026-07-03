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
import { template as adminDeadlineTeamTemplate } from './admin-deadline-team'
import { template as adminDeadlineMentorTemplate } from './admin-deadline-mentor'
import { template as adminDeadlineEvaluatorTemplate } from './admin-deadline-evaluator'
import { template as rpMailNotificationTemplate } from './rp-mail-notification'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'registration-otp': registrationOtpTemplate,
  'mentor-file-request': mentorFileRequestTemplate,
  'gigrider-reset-otp': gigriderResetOtpTemplate,
  'rp-admin-role-request': rpAdminRoleRequestTemplate,
  'rp-role-decision': rpRoleDecisionTemplate,
  'rp-meeting-scheduled': rpMeetingScheduledTemplate,
  'admin-deadline-team': adminDeadlineTeamTemplate,
  'admin-deadline-mentor': adminDeadlineMentorTemplate,
  'admin-deadline-evaluator': adminDeadlineEvaluatorTemplate,
  'rp-mail-notification': rpMailNotificationTemplate,
}

