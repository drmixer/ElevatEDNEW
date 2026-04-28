-- 051_student_work_samples.sql
-- Durable parent-reviewable student work samples, starting with ELA homeschool blocks.

begin;

create table if not exists public.student_work_samples (
  id bigserial primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  subject text not null,
  module_slug text not null,
  module_title text,
  strand text,
  work_kind text,
  block_id text,
  block_kind text,
  score_pct numeric(5, 2),
  outcome text,
  reason_code text,
  next_module_slug text,
  next_module_title text,
  parent_summary text,
  prompt_id text,
  prompt_text text,
  prompt_checklist jsonb not null default '[]'::jsonb,
  content_id text,
  content_title text,
  content_kind text,
  content_source_type text,
  content_focus text,
  content_source text,
  content_text text,
  content_excerpt text,
  response_kind text,
  response_text text,
  response_excerpt text,
  response_word_count int,
  rubric_checks jsonb not null default '{}'::jsonb,
  estimated_minutes int,
  source_event_type text,
  source_event_created_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_work_samples_student_subject_completed_idx
  on public.student_work_samples (student_id, subject, completed_at desc);

create index if not exists student_work_samples_module_idx
  on public.student_work_samples (module_slug);

drop trigger if exists student_work_samples_set_updated_at on public.student_work_samples;
create trigger student_work_samples_set_updated_at
before update on public.student_work_samples
for each row
execute procedure public.set_updated_at();

alter table public.student_work_samples enable row level security;

drop policy if exists "student_work_samples_student_read" on public.student_work_samples;
create policy "student_work_samples_student_read"
on public.student_work_samples
for select
using (student_id = auth.uid());

drop policy if exists "student_work_samples_guardian_read" on public.student_work_samples;
create policy "student_work_samples_guardian_read"
on public.student_work_samples
for select
using (public.is_guardian(student_id));

drop policy if exists "student_work_samples_student_write" on public.student_work_samples;
create policy "student_work_samples_student_write"
on public.student_work_samples
for insert
with check (student_id = auth.uid());

drop policy if exists "student_work_samples_service_write" on public.student_work_samples;
create policy "student_work_samples_service_write"
on public.student_work_samples
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
