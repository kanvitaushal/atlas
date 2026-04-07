-- Run this in Supabase → SQL Editor after creating a project.
-- Then: Authentication → Providers → Email → enable; optionally disable "Confirm email" for quick testing.

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists bug_reports_created_at_idx on public.bug_reports (created_at desc);
create index if not exists bug_reports_user_id_idx on public.bug_reports (user_id);

alter table public.bug_reports enable row level security;

-- Logged-in users may only insert rows for themselves
drop policy if exists "bug_reports_insert_own" on public.bug_reports;
create policy "bug_reports_insert_own"
  on public.bug_reports
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Optional: let users read only their own reports (dashboard still sees all in Table Editor as admin)
drop policy if exists "bug_reports_select_own" on public.bug_reports;
create policy "bug_reports_select_own"
  on public.bug_reports
  for select
  to authenticated
  using (auth.uid() = user_id);

-- To receive reports: Supabase Dashboard → Table Editor → bug_reports, or SQL:
-- select * from public.bug_reports order by created_at desc;
