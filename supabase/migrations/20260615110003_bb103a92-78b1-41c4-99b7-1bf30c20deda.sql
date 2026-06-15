create table if not exists public.rp_google_calendar_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text,
  access_token text not null,
  refresh_token text not null,
  scope text,
  token_type text,
  expiry_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, delete on public.rp_google_calendar_tokens to authenticated;
grant all on public.rp_google_calendar_tokens to service_role;

alter table public.rp_google_calendar_tokens enable row level security;

drop policy if exists "user reads own google calendar token" on public.rp_google_calendar_tokens;
create policy "user reads own google calendar token"
  on public.rp_google_calendar_tokens
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user deletes own google calendar token" on public.rp_google_calendar_tokens;
create policy "user deletes own google calendar token"
  on public.rp_google_calendar_tokens
  for delete to authenticated
  using (auth.uid() = user_id);