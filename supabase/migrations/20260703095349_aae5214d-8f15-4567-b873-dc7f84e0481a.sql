ALTER TABLE public.rp_meetings
  ADD COLUMN IF NOT EXISTS mentor_decision text
    NOT NULL DEFAULT 'not_required'
    CHECK (mentor_decision IN ('not_required','pending','approved','declined')),
  ADD COLUMN IF NOT EXISTS mentor_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS mentor_decision_reason text;

CREATE INDEX IF NOT EXISTS rp_meetings_mentor_pending_idx
  ON public.rp_meetings (team_id, mentor_decision)
  WHERE mentor_decision = 'pending';