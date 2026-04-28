-- 048_subject_path_foundation.sql
-- Phase 1 adaptive foundation: age capture, per-subject placement state, and subject-aware paths.

begin;

alter table public.student_profiles
  add column if not exists age_years smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_profiles_age_years_check'
  ) then
    alter table public.student_profiles
      add constraint student_profiles_age_years_check
      check (age_years is null or age_years between 3 and 20);
  end if;
end$$;

alter table public.student_paths
  add column if not exists subject text;

update public.student_paths
set subject = lower(coalesce(metadata->>'subject', metadata->>'goal_focus'))
where subject is null
  and nullif(coalesce(metadata->>'subject', metadata->>'goal_focus'), '') is not null;

create index if not exists student_paths_student_subject_status_idx
  on public.student_paths (student_id, subject, status);

create unique index if not exists student_paths_one_active_subject_idx
  on public.student_paths (student_id, subject)
  where status = 'active' and subject is not null;

create table if not exists public.student_subject_state (
  id bigserial primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  subject text not null,
  expected_level int not null,
  working_level int,
  level_confidence numeric(4, 3) not null default 0,
  placement_status text not null default 'not_started',
  diagnostic_assessment_id bigint references public.assessments (id) on delete set null,
  diagnostic_attempt_id bigint references public.student_assessment_attempts (id) on delete set null,
  diagnostic_completed_at timestamptz,
  strand_scores jsonb not null default '{}'::jsonb,
  weak_standard_codes text[] not null default '{}'::text[],
  recommended_module_slugs text[] not null default '{}'::text[],
  last_path_id bigint references public.student_paths (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_subject_state_unique_student_subject unique (student_id, subject)
);

create index if not exists student_subject_state_student_subject_idx
  on public.student_subject_state (student_id, subject);

create index if not exists student_subject_state_status_idx
  on public.student_subject_state (placement_status, diagnostic_completed_at desc);

drop trigger if exists student_subject_state_set_updated_at on public.student_subject_state;
create trigger student_subject_state_set_updated_at
before update on public.student_subject_state
for each row
execute procedure public.set_updated_at();

alter table public.student_subject_state enable row level security;

drop policy if exists "student_subject_state_student_read" on public.student_subject_state;
create policy "student_subject_state_student_read"
on public.student_subject_state
for select
using (student_id = auth.uid());

drop policy if exists "student_subject_state_guardian_read" on public.student_subject_state;
create policy "student_subject_state_guardian_read"
on public.student_subject_state
for select
using (public.is_guardian(student_id));

drop policy if exists "student_subject_state_student_write" on public.student_subject_state;
create policy "student_subject_state_student_write"
on public.student_subject_state
for insert
with check (student_id = auth.uid());

drop policy if exists "student_subject_state_student_update" on public.student_subject_state;
create policy "student_subject_state_student_update"
on public.student_subject_state
for update
using (student_id = auth.uid())
with check (student_id = auth.uid());

drop policy if exists "student_subject_state_service_write" on public.student_subject_state;
create policy "student_subject_state_service_write"
on public.student_subject_state
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
