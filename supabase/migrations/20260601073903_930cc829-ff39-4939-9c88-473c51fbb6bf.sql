ALTER TABLE public.observation_photos
ADD COLUMN IF NOT EXISTS photo_context text NOT NULL DEFAULT 'road_environment';

ALTER TABLE public.observation_photos
DROP CONSTRAINT IF EXISTS observation_photos_photo_context_check;

ALTER TABLE public.observation_photos
ADD CONSTRAINT observation_photos_photo_context_check
CHECK (photo_context IN ('road_environment', 'notes'));

CREATE INDEX IF NOT EXISTS idx_observation_photos_observation_context
ON public.observation_photos (observation_id, photo_context);