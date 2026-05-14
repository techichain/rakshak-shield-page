
-- Enums
CREATE TYPE public.app_role AS ENUM ('observer', 'admin');
CREATE TYPE public.observation_status AS ENUM ('draft', 'submitted', 'flagged', 'reviewed');
CREATE TYPE public.hotspot_city AS ENUM ('Delhi', 'Gurgaon');
CREATE TYPE public.road_env_type AS ENUM ('intersection_signal','mid_road_no_signal','commercial_market','residential_lane','highway_arterial','other');
CREATE TYPE public.vehicle_type AS ENUM ('petrol_ice','ev_low_speed','ev_high_speed_green_plate','cng','not_visible');
CREATE TYPE public.consent_answer AS ENUM ('yes','no','unclear');
CREATE TYPE public.rushed_answer AS ENUM ('yes','no','somewhat');
CREATE TYPE public.led_answer AS ENUM ('yes','no','unsure');
CREATE TYPE public.surveyor_rating AS ENUM ('satisfactory','needs_improvement','unacceptable');
CREATE TYPE public.helmet_status AS ENUM ('wearing_full_face','wearing_half_open_face','wearing_no_visor','carrying','not_wearing_not_carrying','cannot_observe');
CREATE TYPE public.rider_engagement AS ENUM ('actively_engaged','adequately_engaged','rushing_for_incentive','zoned_out_distracted','uncomfortable_resistant','going_through_motions');

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  username text UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  -- default role observer
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'observer')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER tg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- profiles policies
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = id);

-- user_roles policies
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- hotspots
CREATE TABLE public.hotspots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city public.hotspot_city NOT NULL,
  name text NOT NULL,
  sublabel text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hotspots ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_hotspots_updated BEFORE UPDATE ON public.hotspots
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "hotspots_read_authenticated" ON public.hotspots FOR SELECT TO authenticated USING (true);
CREATE POLICY "hotspots_admin_all" ON public.hotspots FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- surveyors
CREATE TABLE public.surveyors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.surveyors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_surveyors_updated BEFORE UPDATE ON public.surveyors
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "surveyors_read_authenticated" ON public.surveyors FOR SELECT TO authenticated USING (true);
CREATE POLICY "surveyors_admin_all" ON public.surveyors FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- observations
CREATE TABLE public.observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surveyor_id uuid REFERENCES public.surveyors(id),
  hotspot_id uuid REFERENCES public.hotspots(id),
  gig_worker_id text,

  status public.observation_status NOT NULL DEFAULT 'draft',
  flagged boolean NOT NULL DEFAULT false,
  flag_reason text,

  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Section 1: GPS
  gps_lat numeric(10,7),
  gps_lng numeric(10,7),
  gps_accuracy_meters double precision,
  gps_captured_at timestamptz,

  -- Section 2: Road env
  road_env_type public.road_env_type,
  road_env_type_other text,
  road_hazards text[] NOT NULL DEFAULT '{}',

  -- Section 3: Vehicle
  vehicle_observed boolean NOT NULL DEFAULT false,
  vehicle_type public.vehicle_type,
  vehicle_brand_model text,

  -- Section 4: Surveyor conduct
  consent_interview public.consent_answer,
  consent_screenshot public.consent_answer,
  consent_optional_items text[] NOT NULL DEFAULT '{}',
  surveyor_rushed public.rushed_answer,
  surveyor_rushed_notes text,
  surveyor_led public.led_answer,
  surveyor_led_notes text,
  surveyor_rating public.surveyor_rating,

  -- Section 5: Rider
  platform_gear text[] NOT NULL DEFAULT '{}',
  platform_gear_other text,
  helmet_status public.helmet_status,
  rider_engagement public.rider_engagement,

  -- Section 6: Closing
  additional_notes text
);
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_observations_updated BEFORE UPDATE ON public.observations
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_observations_observer ON public.observations(observer_id);
CREATE INDEX idx_observations_status ON public.observations(status);
CREATE INDEX idx_observations_hotspot ON public.observations(hotspot_id);
CREATE INDEX idx_observations_submitted_at ON public.observations(submitted_at DESC);

CREATE POLICY "obs_observer_select_own" ON public.observations FOR SELECT TO authenticated
USING (observer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "obs_observer_insert_own" ON public.observations FOR INSERT TO authenticated
WITH CHECK (observer_id = auth.uid());
CREATE POLICY "obs_observer_update_own" ON public.observations FOR UPDATE TO authenticated
USING (observer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (observer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "obs_observer_delete_own_draft" ON public.observations FOR DELETE TO authenticated
USING ((observer_id = auth.uid() AND status = 'draft') OR public.has_role(auth.uid(), 'admin'));

-- observation_photos
CREATE TABLE public.observation_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES public.observations(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL DEFAULT 0,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.observation_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_select" ON public.observation_photos FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.observations o WHERE o.id = observation_id AND (o.observer_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "photos_insert" ON public.observation_photos FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.observations o WHERE o.id = observation_id AND o.observer_id = auth.uid())
);
CREATE POLICY "photos_delete" ON public.observation_photos FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.observations o WHERE o.id = observation_id AND (o.observer_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);

-- audit_log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_select" ON public.audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "audit_admin_insert" ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('observation-photos', 'observation-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path layout {observation_id}/{filename}
CREATE POLICY "obs_photos_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'observation-photos' AND (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.observations o
      WHERE o.id::text = (storage.foldername(name))[1] AND o.observer_id = auth.uid()
    )
  )
);
CREATE POLICY "obs_photos_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'observation-photos' AND
  EXISTS (
    SELECT 1 FROM public.observations o
    WHERE o.id::text = (storage.foldername(name))[1] AND o.observer_id = auth.uid()
  )
);
CREATE POLICY "obs_photos_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'observation-photos' AND (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.observations o
      WHERE o.id::text = (storage.foldername(name))[1] AND o.observer_id = auth.uid()
    )
  )
);
