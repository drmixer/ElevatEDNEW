-- 035_account_deletion_requests.sql
-- Capture parent/self account deletion requests with optional linked students.

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_deletion_scope') then
    create type account_deletion_scope as enum ('parent_only', 'parent_and_students', 'students_only');
  end if;
  if not exists (select 1 from pg_type where typname = 'account_deletion_status') then
    create type account_deletion_status as enum ('pending', 'completed', 'canceled');
  end if;
end $$;

create table if not exists public.account_deletion_requests (
  id bigserial primary key,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  scope account_deletion_scope not null,
  include_student_ids uuid[] not null default '{}'::uuid[],
  reason text,
  contact_email text,
  status account_deletion_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists account_deletion_requests_requester_idx on public.account_deletion_requests (requester_id);
create index if not exists account_deletion_requests_status_idx on public.account_deletion_requests (status);

alter table public.account_deletion_requests enable row level security;

create or replace function public.touch_account_deletion_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_account_deletion_requests_updated_at on public.account_deletion_requests;
create trigger trg_account_deletion_requests_updated_at
before update on public.account_deletion_requests
for each row
execute function public.touch_account_deletion_requests_updated_at();

drop policy if exists "account_deletion_requests_parent_submit" on public.account_deletion_requests;
create policy "account_deletion_requests_parent_submit"
on public.account_deletion_requests
for insert
with check (requester_id = auth.uid());

drop policy if exists "account_deletion_requests_parent_read" on public.account_deletion_requests;
create policy "account_deletion_requests_parent_read"
on public.account_deletion_requests
for select
using (requester_id = auth.uid());

drop policy if exists "account_deletion_requests_admin_manage" on public.account_deletion_requests;
create policy "account_deletion_requests_admin_manage"
on public.account_deletion_requests
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "account_deletion_requests_service_manage" on public.account_deletion_requests;
create policy "account_deletion_requests_service_manage"
on public.account_deletion_requests
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
