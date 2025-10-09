-- 004_assignments_practice.sql
-- Assignment management and practice telemetry.

begin;

create type assignment_status as enum (
  'draft',
  'scheduled',
  'published',
  'archived'
);

create type practice_event_type as enum (
  'lesson_view',
  'question_attempt',
  'hint_request',
  'system_feedback',
  'note'
);

create table public.assignments (
  id bigserial primary key,
  title text not null,
  description text,
  subject_id bigint references public.subjects (id) on delete set null,
  creator_id uuid not null references public.parent_profiles (id) on delete cascade,
  status assignment_status not null default 'draft',
  release_at timestamptz,
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assignments_creator_idx on public.assignments (creator_id);
create index assignments_subject_idx on public.assignments (subject_id);
create index assignments_status_idx on public.assignments (status);

alter table public.assignments enable row level security;

create policy "assignments_creator_rw"
on public.assignments
for all
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

create policy "assignments_service_write"
on public.assignments
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create trigger assignments_set_updated_at
before update on public.assignments
for each row
execute procedure public.set_updated_at();

create table public.assignment_lessons (
  assignment_id bigint not null references public.assignments (id) on delete cascade,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  primary key (assignment_id, lesson_id)
);

create index assignment_lessons_lesson_idx on public.assignment_lessons (lesson_id);

alter table public.assignment_lessons enable row level security;

create policy "assignment_lessons_creator_rw"
on public.assignment_lessons
for all
using (
  exists (
    select 1
    from public.assignments a
    where a.id = assignment_lessons.assignment_id
      and a.creator_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assignments a
    where a.id = assignment_lessons.assignment_id
      and a.creator_id = auth.uid()
  )
);

create table public.student_assignments (
  id bigserial primary key,
  assignment_id bigint not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  status progress_status not null default 'not_started',
  due_at timestamptz,
  completed_at timestamptz,
  score numeric(5, 2),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index student_assignments_student_idx on public.student_assignments (student_id);
create index student_assignments_assignment_idx on public.student_assignments (assignment_id);
create index student_assignments_status_idx on public.student_assignments (status);

alter table public.student_assignments enable row level security;

create policy "student_assignments_student_read"
on public.student_assignments
for select
using (student_id = auth.uid());

create policy "student_assignments_student_update"
on public.student_assignments
for update
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "student_assignments_parent_read"
on public.student_assignments
for select
using (
  student_id in (
    select sp.id
    from public.student_profiles sp
    where sp.parent_id = auth.uid()
  )
);

create policy "student_assignments_creator_write"
on public.student_assignments
for all
using (
  exists (
    select 1
    from public.assignments a
    where a.id = student_assignments.assignment_id
      and a.creator_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assignments a
    where a.id = student_assignments.assignment_id
      and a.creator_id = auth.uid()
  )
);

create policy "student_assignments_service_write"
on public.student_assignments
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "assignments_student_parent_read"
on public.assignments
for select
using (
  creator_id = auth.uid()
  or auth.role() = 'service_role'
  or exists (
    select 1
    from public.student_assignments sa
    join public.student_profiles sp on sp.id = sa.student_id
    where sa.assignment_id = assignments.id
      and (sa.student_id = auth.uid() or sp.parent_id = auth.uid())
  )
);

create policy "assignment_lessons_read"
on public.assignment_lessons
for select
using (
  exists (
    select 1
    from public.assignments a
    where a.id = assignment_lessons.assignment_id
      and (
        a.creator_id = auth.uid()
        or auth.role() = 'service_role'
        or exists (
          select 1
          from public.student_assignments sa
          join public.student_profiles sp on sp.id = sa.student_id
          where sa.assignment_id = assignment_lessons.assignment_id
            and (sa.student_id = auth.uid() or sp.parent_id = auth.uid())
        )
      )
  )
);

create table public.practice_sessions (
  id bigserial primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  subject_id bigint references public.subjects (id) on delete set null,
  topic_id bigint references public.topics (id) on delete set null,
  lesson_id bigint references public.lessons (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int,
  total_questions int,
  metadata jsonb not null default '{}'::jsonb
);

create index practice_sessions_student_idx on public.practice_sessions (student_id);
create index practice_sessions_subject_idx on public.practice_sessions (subject_id);

alter table public.practice_sessions enable row level security;

create policy "practice_sessions_student_rw"
on public.practice_sessions
for all
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "practice_sessions_parent_read"
on public.practice_sessions
for select
using (
  student_id in (
    select sp.id
    from public.student_profiles sp
    where sp.parent_id = auth.uid()
  )
);

create policy "practice_sessions_service_write"
on public.practice_sessions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.practice_events (
  id bigserial primary key,
  session_id bigint not null references public.practice_sessions (id) on delete cascade,
  event_order int not null,
  event_type practice_event_type not null,
  subject_id bigint references public.subjects (id) on delete set null,
  topic_id bigint references public.topics (id) on delete set null,
  lesson_id bigint references public.lessons (id) on delete set null,
  question_id bigint references public.question_bank (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, event_order)
);

create index practice_events_session_idx on public.practice_events (session_id);
create index practice_events_type_idx on public.practice_events (event_type);

alter table public.practice_events enable row level security;

create policy "practice_events_student_read"
on public.practice_events
for select
using (
  session_id in (
    select id
    from public.practice_sessions
    where student_id = auth.uid()
  )
);

create policy "practice_events_student_write"
on public.practice_events
for insert
with check (
  session_id in (
    select id
    from public.practice_sessions
    where student_id = auth.uid()
  )
);

create policy "practice_events_student_update"
on public.practice_events
for update
using (
  session_id in (
    select id
    from public.practice_sessions
    where student_id = auth.uid()
  )
)
with check (
  session_id in (
    select id
    from public.practice_sessions
    where student_id = auth.uid()
  )
);

create policy "practice_events_student_delete"
on public.practice_events
for delete
using (
  session_id in (
    select id
    from public.practice_sessions
    where student_id = auth.uid()
  )
);

create policy "practice_events_parent_read"
on public.practice_events
for select
using (
  session_id in (
    select ps.id
    from public.practice_sessions ps
    join public.student_profiles sp on sp.id = ps.student_id
    where sp.parent_id = auth.uid()
  )
);

create policy "practice_events_service_write"
on public.practice_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
