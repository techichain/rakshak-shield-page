
-- Storage RLS for rp-mentor-resources
-- Path layout: {mentor_user_id}/{resource_id}/{filename}

CREATE POLICY "rp_mentor_resources_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rp-mentor-resources'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.rp_has_role(auth.uid(), 'mentor'::rp_app_role)
);

CREATE POLICY "rp_mentor_resources_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'rp-mentor-resources'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "rp_mentor_resources_delete_own_or_admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'rp-mentor-resources'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.rp_is_admin(auth.uid())
  )
);

-- Read: anyone with a matching rp_mentor_resources row they can view
CREATE POLICY "rp_mentor_resources_read_by_visibility"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rp-mentor-resources'
  AND EXISTS (
    SELECT 1 FROM public.rp_mentor_resources r
    WHERE r.storage_path = storage.objects.name
      AND public.rp_can_view_mentor_resource(r.mentor_id, r.team_id, auth.uid())
  )
);
