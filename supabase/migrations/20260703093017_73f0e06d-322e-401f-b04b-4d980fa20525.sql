
-- ================= Threads =================
CREATE TABLE public.rp_mail_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  related_team_id uuid REFERENCES public.rp_teams(id) ON DELETE SET NULL,
  scope text NOT NULL DEFAULT 'direct',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rp_mail_threads_team ON public.rp_mail_threads(related_team_id);
CREATE INDEX idx_rp_mail_threads_last ON public.rp_mail_threads(last_message_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_mail_threads TO authenticated;
GRANT ALL ON public.rp_mail_threads TO service_role;

ALTER TABLE public.rp_mail_threads ENABLE ROW LEVEL SECURITY;

-- ================ Participants ================
CREATE TABLE public.rp_mail_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.rp_mail_threads(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_thread text NOT NULL DEFAULT 'member',
  last_read_at timestamptz,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, profile_id)
);
CREATE INDEX idx_rp_mail_participants_profile ON public.rp_mail_participants(profile_id);
CREATE INDEX idx_rp_mail_participants_thread ON public.rp_mail_participants(thread_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_mail_participants TO authenticated;
GRANT ALL ON public.rp_mail_participants TO service_role;

ALTER TABLE public.rp_mail_participants ENABLE ROW LEVEL SECURITY;

-- ================ Messages =================
CREATE TABLE public.rp_mail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.rp_mail_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rp_mail_messages_thread ON public.rp_mail_messages(thread_id, sent_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_mail_messages TO authenticated;
GRANT ALL ON public.rp_mail_messages TO service_role;

ALTER TABLE public.rp_mail_messages ENABLE ROW LEVEL SECURITY;

-- =============== Helper function ===============
CREATE OR REPLACE FUNCTION public.rp_is_mail_participant(_thread uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rp_mail_participants
    WHERE thread_id = _thread AND profile_id = _user
  )
$$;

-- =============== Policies: threads ===============
CREATE POLICY "mail_threads_select_participants_or_admin"
ON public.rp_mail_threads FOR SELECT TO authenticated
USING (
  public.rp_is_mail_participant(id, auth.uid())
  OR public.rp_is_admin(auth.uid())
);

CREATE POLICY "mail_threads_insert_self_creator"
ON public.rp_mail_threads FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "mail_threads_update_participants_or_admin"
ON public.rp_mail_threads FOR UPDATE TO authenticated
USING (
  public.rp_is_mail_participant(id, auth.uid())
  OR public.rp_is_admin(auth.uid())
)
WITH CHECK (
  public.rp_is_mail_participant(id, auth.uid())
  OR public.rp_is_admin(auth.uid())
);

-- =============== Policies: participants ===============
CREATE POLICY "mail_participants_select_self_or_admin"
ON public.rp_mail_participants FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR public.rp_is_mail_participant(thread_id, auth.uid())
  OR public.rp_is_admin(auth.uid())
);

CREATE POLICY "mail_participants_insert_thread_creator_or_participant"
ON public.rp_mail_participants FOR INSERT TO authenticated
WITH CHECK (
  public.rp_is_admin(auth.uid())
  OR profile_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.rp_mail_threads t
             WHERE t.id = thread_id AND t.created_by = auth.uid())
  OR public.rp_is_mail_participant(thread_id, auth.uid())
);

CREATE POLICY "mail_participants_update_self"
ON public.rp_mail_participants FOR UPDATE TO authenticated
USING (profile_id = auth.uid() OR public.rp_is_admin(auth.uid()))
WITH CHECK (profile_id = auth.uid() OR public.rp_is_admin(auth.uid()));

-- =============== Policies: messages ===============
CREATE POLICY "mail_messages_select_participants_or_admin"
ON public.rp_mail_messages FOR SELECT TO authenticated
USING (
  public.rp_is_mail_participant(thread_id, auth.uid())
  OR public.rp_is_admin(auth.uid())
);

CREATE POLICY "mail_messages_insert_participants_or_admin"
ON public.rp_mail_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.rp_is_mail_participant(thread_id, auth.uid())
    OR public.rp_is_admin(auth.uid())
  )
);

CREATE POLICY "mail_messages_update_own"
ON public.rp_mail_messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "mail_messages_delete_own_or_admin"
ON public.rp_mail_messages FOR DELETE TO authenticated
USING (sender_id = auth.uid() OR public.rp_is_admin(auth.uid()));

-- =============== updated_at triggers ===============
CREATE TRIGGER tg_rp_mail_threads_updated_at
BEFORE UPDATE ON public.rp_mail_threads
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER tg_rp_mail_messages_updated_at
BEFORE UPDATE ON public.rp_mail_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =============== Auto-update thread on new message ===============
CREATE OR REPLACE FUNCTION public.rp_tg_mail_message_touch_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rp_mail_threads
  SET last_message_at = NEW.sent_at,
      last_message_preview = left(NEW.body, 160),
      updated_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_rp_mail_touch_thread
AFTER INSERT ON public.rp_mail_messages
FOR EACH ROW EXECUTE FUNCTION public.rp_tg_mail_message_touch_thread();
