CREATE TABLE public.rp_bulk_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('teams','mentors','evaluators')),
  uploaded_by uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('validating','ready','processing','done','failed')),
  rows_total int,
  rows_created int NOT NULL DEFAULT 0,
  rows_skipped int NOT NULL DEFAULT 0,
  rows_failed int NOT NULL DEFAULT 0,
  errors_json jsonb,
  results_summary_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_bulk_imports TO authenticated;
GRANT ALL ON public.rp_bulk_imports TO service_role;

ALTER TABLE public.rp_bulk_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bulk imports"
ON public.rp_bulk_imports
FOR ALL
TO authenticated
USING (public.rp_is_admin(auth.uid()))
WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE INDEX rp_bulk_imports_created_at_idx ON public.rp_bulk_imports (created_at DESC);