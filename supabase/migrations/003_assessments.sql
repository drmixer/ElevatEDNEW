-- 003_assessments.sql
-- Assessment framework, question bank, and attempt tracking.

begin;

create type question_type as enum (
  'multiple_choice',
  'true_false',
  'short_answer',
  'essay',
  'fill_blank'
);

create type assessment_attempt_status as enum (
  'in_progress',
  'completed',
  'abandoned'
);

create table public.question_bank (
  id bigserial primary key,
  subject_id bigint not null references public.subjects (id) on delete cascade,
  topic_id bigint references public.topics (id) on delete set null,
  question_type question_type not null,
  prompt text not null,
  rich_media jsonb not null default '{}'::jsonb,
  solution_explanation text,
  difficulty int check (difficulty between 1 and 5),
  tags text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index question_bank_subject_idx on public.question_bank (subject_id);
create index question_bank_topic_idx on public.question_bank (topic_id);
create index question_bank_type_idx on public.question_bank (question_type);

alter table public.question_bank enable row level security;

create policy "question_bank_all_read"
on public.question_bank
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "question_bank_service_write"
on public.question_bank
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.question_options (
  id bigserial primary key,
  question_id bigint not null references public.question_bank (id) on delete cascade,
  option_order int not null,
  content text not null,
  is_correct boolean not null default false,
  feedback text,
  unique (question_id, option_order)
);

create index question_options_question_idx on public.question_options (question_id);

alter table public.question_options enable row level security;

create policy "question_options_all_read"
on public.question_options
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "question_options_service_write"
on public.question_options
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.assessments (
  id bigserial primary key,
  title text not null,
  description text,
  subject_id bigint references public.subjects (id) on delete set null,
  is_adaptive boolean not null default false,
  estimated_duration_minutes int,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index assessments_subject_idx on public.assessments (subject_id);

alter table public.assessments enable row level security;

create policy "assessments_all_read"
on public.assessments
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "assessments_service_write"
on public.assessments
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.assessment_sections (
  id bigserial primary key,
  assessment_id bigint not null references public.assessments (id) on delete cascade,
  section_order int not null,
  title text not null,
  instructions text,
  topic_id bigint references public.topics (id) on delete set null,
  time_limit_minutes int,
  unique (assessment_id, section_order)
);

create index assessment_sections_assessment_idx on public.assessment_sections (assessment_id);

alter table public.assessment_sections enable row level security;

create policy "assessment_sections_all_read"
on public.assessment_sections
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "assessment_sections_service_write"
on public.assessment_sections
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.assessment_questions (
  id bigserial primary key,
  section_id bigint not null references public.assessment_sections (id) on delete cascade,
  question_id bigint not null references public.question_bank (id) on delete restrict,
  question_order int not null,
  weight numeric(5, 2) not null default 1.0,
  metadata jsonb not null default '{}'::jsonb,
  unique (section_id, question_order)
);

create index assessment_questions_section_idx on public.assessment_questions (section_id);
create index assessment_questions_question_idx on public.assessment_questions (question_id);

alter table public.assessment_questions enable row level security;

create policy "assessment_questions_all_read"
on public.assessment_questions
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "assessment_questions_service_write"
on public.assessment_questions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.student_assessment_attempts (
  id bigserial primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  assessment_id bigint not null references public.assessments (id) on delete cascade,
  attempt_number int not null default 1,
  status assessment_attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_score numeric(6, 2),
  mastery_pct numeric(5, 2),
  metadata jsonb not null default '{}'::jsonb,
  unique (student_id, assessment_id, attempt_number)
);

create index student_assessment_attempts_student_idx on public.student_assessment_attempts (student_id);
create index student_assessment_attempts_assessment_idx on public.student_assessment_attempts (assessment_id);
create index student_assessment_attempts_status_idx on public.student_assessment_attempts (status);

alter table public.student_assessment_attempts enable row level security;

create policy "attempts_student_read"
on public.student_assessment_attempts
for select
using (student_id = auth.uid());

create policy "attempts_student_write"
on public.student_assessment_attempts
for insert
with check (student_id = auth.uid());

create policy "attempts_student_update"
on public.student_assessment_attempts
for update
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "attempts_student_delete"
on public.student_assessment_attempts
for delete
using (student_id = auth.uid());

create policy "attempts_parent_read"
on public.student_assessment_attempts
for select
using (
  student_id in (
    select s.id
    from public.student_profiles s
    where s.parent_id = auth.uid()
  )
);

create policy "attempts_service_write"
on public.student_assessment_attempts
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.student_assessment_responses (
  id bigserial primary key,
  attempt_id bigint not null references public.student_assessment_attempts (id) on delete cascade,
  question_id bigint not null references public.question_bank (id) on delete cascade,
  selected_option_id bigint references public.question_options (id) on delete set null,
  response_content jsonb,
  is_correct boolean,
  score numeric(5, 2),
  time_spent_seconds int,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index assessment_responses_attempt_idx on public.student_assessment_responses (attempt_id);
create index assessment_responses_question_idx on public.student_assessment_responses (question_id);

alter table public.student_assessment_responses enable row level security;

create policy "responses_student_read"
on public.student_assessment_responses
for select
using (
  attempt_id in (
    select id
    from public.student_assessment_attempts
    where student_id = auth.uid()
  )
);

create policy "responses_student_write"
on public.student_assessment_responses
for insert
with check (
  attempt_id in (
    select id
    from public.student_assessment_attempts
    where student_id = auth.uid()
  )
);

create policy "responses_student_update"
on public.student_assessment_responses
for update
using (
  attempt_id in (
    select id
    from public.student_assessment_attempts
    where student_id = auth.uid()
  )
)
with check (
  attempt_id in (
    select id
    from public.student_assessment_attempts
    where student_id = auth.uid()
  )
);

create policy "responses_student_delete"
on public.student_assessment_responses
for delete
using (
  attempt_id in (
    select id
    from public.student_assessment_attempts
    where student_id = auth.uid()
  )
);

create policy "responses_parent_read"
on public.student_assessment_responses
for select
using (
  attempt_id in (
    select saa.id
    from public.student_assessment_attempts saa
    join public.student_profiles sp on sp.id = saa.student_id
    where sp.parent_id = auth.uid()
  )
);

create policy "responses_service_write"
on public.student_assessment_responses
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
