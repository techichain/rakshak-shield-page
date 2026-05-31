insert into storage.buckets (id, name, public) values ('public-docs', 'public-docs', true) on conflict (id) do update set public = true;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Public read public-docs') then
    create policy "Public read public-docs" on storage.objects for select using (bucket_id = 'public-docs');
  end if;
end $$;