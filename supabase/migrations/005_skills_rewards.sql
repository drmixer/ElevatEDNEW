-- 005_skills_rewards.sql
-- Skill taxonomy, mastery tracking, and rewards system.

begin;

create type badge_rarity as enum ('common', 'rare', 'epic', 'legendary');

create table public.skills (
  id bigserial primary key,
  subject_id bigint references public.subjects (id) on delete set null,
  name text not null,
  standard_code text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (subject_id, name)
);

create index skills_subject_idx on public.skills (subject_id);

alter table public.skills enable row level security;

create policy "skills_all_read"
on public.skills
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "skills_service_write"
on public.skills
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.lesson_skills (
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  skill_id bigint not null references public.skills (id) on delete cascade,
  primary key (lesson_id, skill_id)
);

create index lesson_skills_skill_idx on public.lesson_skills (skill_id);

alter table public.lesson_skills enable row level security;

create policy "lesson_skills_all_read"
on public.lesson_skills
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "lesson_skills_service_write"
on public.lesson_skills
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.question_skills (
  question_id bigint not null references public.question_bank (id) on delete cascade,
  skill_id bigint not null references public.skills (id) on delete cascade,
  primary key (question_id, skill_id)
);

create index question_skills_skill_idx on public.question_skills (skill_id);

alter table public.question_skills enable row level security;

create policy "question_skills_all_read"
on public.question_skills
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "question_skills_service_write"
on public.question_skills
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.student_mastery (
  id bigserial primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  skill_id bigint not null references public.skills (id) on delete cascade,
  mastery_pct numeric(5, 2) not null default 0,
  mastery_band text,
  evidence jsonb not null default '{}'::jsonb,
  last_evidence_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (student_id, skill_id)
);

create index student_mastery_student_idx on public.student_mastery (student_id);
create index student_mastery_skill_idx on public.student_mastery (skill_id);

alter table public.student_mastery enable row level security;

create policy "student_mastery_student_read"
on public.student_mastery
for select
using (student_id = auth.uid());

create policy "student_mastery_student_update"
on public.student_mastery
for update
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "student_mastery_parent_read"
on public.student_mastery
for select
using (
  student_id in (
    select sp.id
    from public.student_profiles sp
    where sp.parent_id = auth.uid()
  )
);

create policy "student_mastery_service_write"
on public.student_mastery
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.student_mastery_events (
  id bigserial primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  skill_id bigint not null references public.skills (id) on delete cascade,
  assessment_attempt_id bigint references public.student_assessment_attempts (id) on delete set null,
  lesson_id bigint references public.lessons (id) on delete set null,
  source text not null,
  delta_pct numeric(5, 2),
  mastery_pct_after numeric(5, 2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index mastery_events_student_idx on public.student_mastery_events (student_id);
create index mastery_events_skill_idx on public.student_mastery_events (skill_id);

alter table public.student_mastery_events enable row level security;

create policy "mastery_events_student_read"
on public.student_mastery_events
for select
using (student_id = auth.uid());

create policy "mastery_events_parent_read"
on public.student_mastery_events
for select
using (
  student_id in (
    select sp.id
    from public.student_profiles sp
    where sp.parent_id = auth.uid()
  )
);

create policy "mastery_events_service_write"
on public.student_mastery_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.badge_definitions (
  id bigserial primary key,
  slug text not null unique,
  name text not null,
  description text,
  rarity badge_rarity not null default 'common',
  icon text,
  criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.badge_definitions enable row level security;

create policy "badge_definitions_all_read"
on public.badge_definitions
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "badge_definitions_service_write"
on public.badge_definitions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create trigger badge_definitions_set_updated_at
before update on public.badge_definitions
for each row
execute procedure public.set_updated_at();

create table public.student_badges (
  id bigserial primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  badge_id bigint not null references public.badge_definitions (id) on delete cascade,
  earned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (student_id, badge_id)
);

create index student_badges_student_idx on public.student_badges (student_id);
create index student_badges_badge_idx on public.student_badges (badge_id);

alter table public.student_badges enable row level security;

create policy "student_badges_student_read"
on public.student_badges
for select
using (student_id = auth.uid());

create policy "student_badges_parent_read"
on public.student_badges
for select
using (
  student_id in (
    select sp.id
    from public.student_profiles sp
    where sp.parent_id = auth.uid()
  )
);

create policy "student_badges_service_write"
on public.student_badges
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.xp_events (
  id bigserial primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  source text not null,
  xp_change integer not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index xp_events_student_idx on public.xp_events (student_id);

alter table public.xp_events enable row level security;

create policy "xp_events_student_read"
on public.xp_events
for select
using (student_id = auth.uid());

create policy "xp_events_parent_read"
on public.xp_events
for select
using (
  student_id in (
    select sp.id
    from public.student_profiles sp
    where sp.parent_id = auth.uid()
  )
);

create policy "xp_events_service_write"
on public.xp_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.streak_logs (
  id bigserial primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  activity_date date not null,
  activity_count int not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (student_id, activity_date)
);

create index streak_logs_student_idx on public.streak_logs (student_id);
create index streak_logs_date_idx on public.streak_logs (activity_date);

alter table public.streak_logs enable row level security;

create policy "streak_logs_student_read"
on public.streak_logs
for select
using (student_id = auth.uid());

create policy "streak_logs_parent_read"
on public.streak_logs
for select
using (
  student_id in (
    select sp.id
    from public.student_profiles sp
    where sp.parent_id = auth.uid()
  )
);

create policy "streak_logs_service_write"
on public.streak_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
