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

export const TEMPLATES: Record<string, TemplateEntry> = {
  'registration-otp': registrationOtpTemplate,
  'mentor-file-request': mentorFileRequestTemplate,
}
