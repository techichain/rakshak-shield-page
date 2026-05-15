
ALTER TYPE rider_engagement ADD VALUE IF NOT EXISTS 'genuinely_engaged';
ALTER TYPE rider_engagement ADD VALUE IF NOT EXISTS 'cooperative';
ALTER TYPE rider_engagement ADD VALUE IF NOT EXISTS 'passive';
ALTER TYPE rider_engagement ADD VALUE IF NOT EXISTS 'visibly_rushed';
ALTER TYPE rider_engagement ADD VALUE IF NOT EXISTS 'uncomfortable_guarded';
ALTER TYPE rider_engagement ADD VALUE IF NOT EXISTS 'resistant';

ALTER TABLE public.observations
  ADD COLUMN IF NOT EXISTS consent_interview_notes text,
  ADD COLUMN IF NOT EXISTS consent_screenshot_notes text,
  ADD COLUMN IF NOT EXISTS response_consistency text,
  ADD COLUMN IF NOT EXISTS response_consistency_notes text;
