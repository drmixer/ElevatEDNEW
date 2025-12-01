-- 024_safety_and_concern_reports.sql
-- Trust & privacy intake for family-facing “Report a concern” workflow.

begin;

create type concern_category as enum ('safety', 'content', 'data', 'account', 'billing', 'other');
create type concern_status as enum ('open', 'in_review', 'resolved', 'closed');

create table public.concern_reports (
  id bigserial primary key,
  case_id text not null unique default upper(substring(gen_random_uuid()::text, 1, 8)),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid references public.student_profiles (id) on delete set null,
  category concern_category not null default 'other',
  status concern_status not null default 'open',
  description text not null,
  contact_email text,
  screenshot_url text,
  route text generated always as (
    case
      when category in ('safety', 'content') then 'trust'
      when category = 'data' then 'privacy'
      else 'support'
    end
  ) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index concern_reports_requester_idx on public.concern_reports (requester_id);
create index concern_reports_student_idx on public.concern_reports (student_id);
create index concern_reports_status_idx on public.concern_reports (status);
create index concern_reports_category_idx on public.concern_reports (category);
create unique index concern_reports_case_idx on public.concern_reports (case_id);

alter table public.concern_reports enable row level security;

create or replace function public.touch_concern_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_concern_reports_updated_at on public.concern_reports;
create trigger trg_concern_reports_updated_at
before update on public.concern_reports
for each row
execute function public.touch_concern_reports_updated_at();

create policy "concern_reports_parent_submit"
on public.concern_reports
for insert
with check (requester_id = auth.uid() and (student_id is null or public.is_guardian(student_id)));

create policy "concern_reports_parent_read"
on public.concern_reports
for select
using (requester_id = auth.uid() and (student_id is null or public.is_guardian(student_id)));

create policy "concern_reports_admin_manage"
on public.concern_reports
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "concern_reports_service_manage"
on public.concern_reports
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
