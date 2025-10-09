-- 001_core_schema.sql
-- Core schema for profiles, learning content, and adaptive data.

begin;

create type user_role as enum ('parent', 'student');
create type progress_status as enum ('not_started', 'in_progress', 'completed');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
create type payment_status as enum ('succeeded', 'pending', 'failed', 'refunded');

create table public.plans (
  id bigserial primary key,
  slug text unique not null,
  name text not null,
  price_cents integer not null default 0,
  status subscription_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

create policy "plans_all_read"
on public.plans
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "plans_service_write"
on public.plans
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null,
  email text not null unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own_profile_select"
on public.profiles
for select
using (id = auth.uid());

create policy "own_profile_update"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create table public.parent_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  full_name text not null,
  phone text,
  address text,
  subscription_plan_id bigint references public.plans (id),
  subscription_status subscription_status not null default 'trialing',
  created_at timestamptz not null default now()
);

alter table public.parent_profiles enable row level security;

create policy "own_parent_select"
on public.parent_profiles
for select
using (id = auth.uid());

create policy "own_parent_update"
on public.parent_profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create table public.adaptive_levels (
  id smallserial primary key,
  name text unique not null,
  criteria_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.adaptive_levels enable row level security;

create policy "adaptive_levels_all_read"
on public.adaptive_levels
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "adaptive_levels_service_write"
on public.adaptive_levels
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.student_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  parent_id uuid not null references public.parent_profiles (id) on delete cascade,
  first_name text not null,
  last_name text,
  grade_level int check (grade_level between 1 and 12),
  grade int generated always as (grade_level) stored,
  birthdate date,
  learning_style jsonb not null default '{}'::jsonb,
  avatar_url text,
  xp integer not null default 0,
  level integer not null default 1,
  badges jsonb not null default '[]'::jsonb,
  streak_days integer not null default 0,
  strengths text[] not null default '{}'::text[],
  weaknesses text[] not null default '{}'::text[],
  learning_path jsonb not null default '[]'::jsonb,
  assessment_completed boolean not null default false,
  current_level_id smallint,
  created_at timestamptz not null default now()
);

alter table public.student_profiles
  add constraint student_profiles_current_level_fk
  foreign key (current_level_id) references public.adaptive_levels (id);

create index student_profiles_parent_idx on public.student_profiles (parent_id);
create index student_profiles_current_level_idx on public.student_profiles (current_level_id);

alter table public.student_profiles enable row level security;

create policy "student_self_select"
on public.student_profiles
for select
using (id = auth.uid());

create policy "student_self_update"
on public.student_profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "parent_reads_child"
on public.student_profiles
for select
using (parent_id = auth.uid());

create table public.subjects (
  id bigserial primary key,
  name text not null unique,
  description text
);

alter table public.subjects enable row level security;

create policy "subjects_all_read"
on public.subjects
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "subjects_service_write"
on public.subjects
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.topics (
  id bigserial primary key,
  subject_id bigint not null references public.subjects (id) on delete cascade,
  name text not null,
  description text,
  difficulty_level int check (difficulty_level between 1 and 5),
  unique (subject_id, name)
);

create index topics_subject_idx on public.topics (subject_id);

alter table public.topics enable row level security;

create policy "topics_all_read"
on public.topics
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "topics_service_write"
on public.topics
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.lessons (
  id bigserial primary key,
  topic_id bigint not null references public.topics (id) on delete cascade,
  title text not null,
  content text not null,
  media_url text,
  estimated_duration_minutes int,
  ai_hint_context jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lessons_topic_idx on public.lessons (topic_id);
create index lessons_published_idx on public.lessons (is_published);

alter table public.lessons enable row level security;

create policy "lessons_published_read"
on public.lessons
for select
using (is_published = true);

create policy "lessons_service_write"
on public.lessons
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.lesson_steps (
  id bigserial primary key,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  step_number int not null,
  prompt_text text,
  expected_answer jsonb,
  unique (lesson_id, step_number)
);

create index lesson_steps_lesson_idx on public.lesson_steps (lesson_id);

alter table public.lesson_steps enable row level security;

create policy "lesson_steps_read_published"
on public.lesson_steps
for select
using (
  exists (
    select 1
    from public.lessons l
    where l.id = lesson_steps.lesson_id
      and l.is_published = true
  )
);

create policy "lesson_steps_service_write"
on public.lesson_steps
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.student_progress (
  id bigserial primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  status progress_status not null default 'not_started',
  score numeric(5, 2),
  mastery_pct numeric(5, 2),
  attempts int not null default 0,
  last_activity_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

create index student_progress_student_idx on public.student_progress (student_id);
create index student_progress_lesson_idx on public.student_progress (lesson_id);
create index student_progress_status_idx on public.student_progress (status);

alter table public.student_progress enable row level security;

create policy "student_progress_read"
on public.student_progress
for select
using (student_id = auth.uid());

create policy "student_progress_write"
on public.student_progress
for insert
with check (student_id = auth.uid());

create policy "student_progress_update"
on public.student_progress
for update
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "student_progress_delete"
on public.student_progress
for delete
using (student_id = auth.uid());

create policy "parent_progress_read"
on public.student_progress
for select
using (
  student_id in (
    select s.id
    from public.student_profiles s
    where s.parent_id = auth.uid()
  )
);

create policy "student_progress_service_write"
on public.student_progress
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger lessons_set_updated_at
before update on public.lessons
for each row
execute procedure public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
as $$
declare
  meta_role text;
  resolved_role user_role;
  resolved_name text;
begin
  meta_role := coalesce(new.raw_user_meta_data->>'role', 'student');
  if meta_role = 'parent' then
    resolved_role := 'parent';
  else
    resolved_role := 'student';
  end if;

  resolved_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  insert into public.profiles (id, role, email, full_name, avatar_url)
  values (new.id, resolved_role, new.email, resolved_name, new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do update
    set role = excluded.role,
        email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url;

  if resolved_role = 'parent' then
    insert into public.parent_profiles (id, full_name)
    values (new.id, resolved_name)
    on conflict (id) do update
      set full_name = excluded.full_name;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

commit;
