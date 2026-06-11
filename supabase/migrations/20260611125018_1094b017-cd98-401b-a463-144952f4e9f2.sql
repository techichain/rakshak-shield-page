
WITH targets AS (
  SELECT id FROM public.applications
  WHERE full_name ILIKE '%muskan%yadav%' OR full_name ILIKE '%akhtar%hussain%'
)
, d1 AS (DELETE FROM public.application_files WHERE application_id IN (SELECT id FROM targets) RETURNING 1)
, d2 AS (DELETE FROM public.application_file_requests WHERE application_id IN (SELECT id FROM targets) RETURNING 1)
, d3 AS (DELETE FROM public.application_reviews WHERE application_id IN (SELECT id FROM targets) RETURNING 1)
, d4 AS (DELETE FROM public.application_status_events WHERE application_id IN (SELECT id FROM targets) RETURNING 1)
DELETE FROM public.applications WHERE id IN (SELECT id FROM targets);
