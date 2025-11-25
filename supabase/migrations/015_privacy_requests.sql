-- 015_privacy_requests.sql
-- Minimal data rights workflow for guardians and admins.

begin;

create type privacy_request_type as enum ('export', 'erasure');
create type privacy_request_status as enum ('pending', 'in_review', 'fulfilled', 'rejected');

create table public.privacy_requests (
  id bigserial primary key,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  request_type privacy_request_type not null,
  status privacy_request_status not null default 'pending',
  contact_email text,
  reason text,
  admin_notes text,
  handled_by uuid references public.admin_profiles (id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index privacy_requests_requester_idx on public.privacy_requests (requester_id);
create index privacy_requests_student_idx on public.privacy_requests (student_id);
create index privacy_requests_status_idx on public.privacy_requests (status);

alter table public.privacy_requests enable row level security;

create or replace function public.touch_privacy_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_privacy_requests_updated_at on public.privacy_requests;
create trigger trg_privacy_requests_updated_at
before update on public.privacy_requests
for each row
execute function public.touch_privacy_requests_updated_at();

create policy "privacy_requests_parent_submit"
on public.privacy_requests
for insert
with check (requester_id = auth.uid() and public.is_guardian(student_id));

create policy "privacy_requests_parent_read"
on public.privacy_requests
for select
using (requester_id = auth.uid() and public.is_guardian(student_id));

create policy "privacy_requests_admin_manage"
on public.privacy_requests
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "privacy_requests_service_manage"
on public.privacy_requests
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
