ALTER TABLE public.rp_submissions
  ADD COLUMN document_type text NOT NULL DEFAULT 'report'
    CHECK (document_type IN ('questionnaire','report','other')),
  ADD COLUMN is_final boolean NOT NULL DEFAULT false;