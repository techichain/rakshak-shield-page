
ALTER TABLE public.rp_evaluations
  ADD COLUMN IF NOT EXISTS edit_history jsonb NOT NULL DEFAULT '[]'::jsonb;
