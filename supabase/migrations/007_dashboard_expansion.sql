-- 007_dashboard_expansion.sql
-- Dashboard enablement, admin role support, and analytics scaffolding.

begin;

alter type user_role add value if not exists 'admin';

create table if not exists public.admin_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  title text,
  permissions text[] not null default '{}'::text[],
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_profiles enable row level security;

drop policy if exists "admin_self_select" on public.admin_profiles;
create policy "admin_self_select"
on public.admin_profiles
for select
using (id = auth.uid());

drop policy if exists "admin_self_update" on public.admin_profiles;
create policy "admin_self_update"
on public.admin_profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "admin_service_write" on public.admin_profiles;
create policy "admin_service_write"
on public.admin_profiles
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create or replace function public.is_platform_admin(target uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    where ap.id = coalesce(target, auth.uid())
  );
$$;

create table if not exists public.student_daily_activity (
  id bigserial primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  activity_date date not null,
  lessons_completed integer not null default 0,
  practice_minutes integer not null default 0,
  ai_sessions integer not null default 0,
  xp_earned integer not null default 0,
  streak_preserved boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (student_id, activity_date)
);

create index if not exists student_daily_activity_student_idx on public.student_daily_activity (student_id);
create index if not exists student_daily_activity_date_idx on public.student_daily_activity (activity_date);

alter table public.student_daily_activity enable row level security;

drop policy if exists "student_daily_self_read" on public.student_daily_activity;
create policy "student_daily_self_read"
on public.student_daily_activity
for select
using (student_id = auth.uid());

drop policy if exists "student_daily_guardian_read" on public.student_daily_activity;
create policy "student_daily_guardian_read"
on public.student_daily_activity
for select
using (public.is_guardian(student_id));

drop policy if exists "student_daily_service_write" on public.student_daily_activity;
create policy "student_daily_service_write"
on public.student_daily_activity
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "student_daily_admin_read" on public.student_daily_activity;
create policy "student_daily_admin_read"
on public.student_daily_activity
for select
using (public.is_platform_admin());

create table if not exists public.parent_weekly_reports (
  id bigserial primary key,
  parent_id uuid not null references public.parent_profiles (id) on delete cascade,
  week_start date not null,
  summary text,
  highlights jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  ai_generated boolean not null default true,
  created_at timestamptz not null default now(),
  unique (parent_id, week_start)
);

create index if not exists parent_weekly_reports_parent_idx on public.parent_weekly_reports (parent_id);
create index if not exists parent_weekly_reports_week_idx on public.parent_weekly_reports (week_start);

alter table public.parent_weekly_reports enable row level security;

drop policy if exists "parent_weekly_self_read" on public.parent_weekly_reports;
create policy "parent_weekly_self_read"
on public.parent_weekly_reports
for select
using (parent_id = auth.uid());

drop policy if exists "parent_weekly_admin_read" on public.parent_weekly_reports;
create policy "parent_weekly_admin_read"
on public.parent_weekly_reports
for select
using (public.is_platform_admin());

drop policy if exists "parent_weekly_service_write" on public.parent_weekly_reports;
create policy "parent_weekly_service_write"
on public.parent_weekly_reports
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

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
  elsif meta_role = 'admin' then
    resolved_role := 'admin';
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
  elsif resolved_role = 'admin' then
    insert into public.admin_profiles (id, title, permissions)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'title', 'Platform Admin'),
      coalesce(string_to_array(new.raw_user_meta_data->>'permissions', ','), '{}'::text[])
    )
    on conflict (id) do update
      set title = excluded.title,
          permissions = excluded.permissions;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

create or replace view public.admin_dashboard_metrics as
select
  (select count(*) from public.student_profiles) as total_students,
  (select count(*) from public.parent_profiles) as total_parents,
  (select count(*) from public.admin_profiles) as total_admins,
  (select coalesce(sum(ps.practice_minutes), 0) from public.student_daily_activity ps where ps.activity_date >= (current_date - interval '7 days')) as practice_minutes_7d,
  (select coalesce(count(distinct student_id), 0) from public.practice_sessions where started_at >= (now() - interval '7 days')) as active_students_7d,
  (select coalesce(avg(xp), 0) from public.student_profiles) as average_student_xp,
  (select coalesce(count(*), 0) from public.student_assessment_attempts where started_at >= (now() - interval '30 days')) as assessments_last_30d,
  (select coalesce(sum(xp_earned), 0) from public.student_daily_activity where activity_date >= (current_date - interval '30 days')) as xp_earned_30d,
  (select coalesce(count(*), 0) from public.subscriptions where status in ('trialing', 'active', 'past_due')) as active_subscriptions
;

create or replace view public.parent_dashboard_children as
select
  sp.parent_id,
  sp.id as student_id,
  sp.first_name,
  sp.last_name,
  sp.grade,
  sp.level,
  sp.xp,
  sp.streak_days,
  sp.strengths,
  sp.weaknesses,
  coalesce(sd.lessons_completed, 0) as lessons_completed_week,
  coalesce(sd.practice_minutes, 0) as practice_minutes_week,
  coalesce(sd.xp_earned, 0) as xp_earned_week
from public.student_profiles sp
left join lateral (
  select
    sum(sda.lessons_completed) as lessons_completed,
    sum(sda.practice_minutes) as practice_minutes,
    sum(sda.xp_earned) as xp_earned
  from public.student_daily_activity sda
  where sda.student_id = sp.id
    and sda.activity_date >= current_date - interval '7 days'
) sd on true;

-- Admin read policies for key tables

drop policy if exists "profiles_admin_read" on public.profiles;
create policy "profiles_admin_read"
on public.profiles
for select
using (public.is_platform_admin());

drop policy if exists "parent_profiles_admin_read" on public.parent_profiles;
create policy "parent_profiles_admin_read"
on public.parent_profiles
for select
using (public.is_platform_admin());

drop policy if exists "student_profiles_admin_read" on public.student_profiles;
create policy "student_profiles_admin_read"
on public.student_profiles
for select
using (public.is_platform_admin());

drop policy if exists "student_progress_admin_read" on public.student_progress;
create policy "student_progress_admin_read"
on public.student_progress
for select
using (public.is_platform_admin());

drop policy if exists "student_mastery_admin_read" on public.student_mastery;
create policy "student_mastery_admin_read"
on public.student_mastery
for select
using (public.is_platform_admin());

drop policy if exists "student_mastery_events_admin_read" on public.student_mastery_events;
create policy "student_mastery_events_admin_read"
on public.student_mastery_events
for select
using (public.is_platform_admin());

drop policy if exists "xp_events_admin_read" on public.xp_events;
create policy "xp_events_admin_read"
on public.xp_events
for select
using (public.is_platform_admin());

drop policy if exists "practice_sessions_admin_read" on public.practice_sessions;
create policy "practice_sessions_admin_read"
on public.practice_sessions
for select
using (public.is_platform_admin());

drop policy if exists "practice_events_admin_read" on public.practice_events;
create policy "practice_events_admin_read"
on public.practice_events
for select
using (public.is_platform_admin());

drop policy if exists "student_assessment_attempts_admin_read" on public.student_assessment_attempts;
create policy "student_assessment_attempts_admin_read"
on public.student_assessment_attempts
for select
using (public.is_platform_admin());

drop policy if exists "student_assessment_responses_admin_read" on public.student_assessment_responses;
create policy "student_assessment_responses_admin_read"
on public.student_assessment_responses
for select
using (public.is_platform_admin());

drop policy if exists "student_assignments_admin_read" on public.student_assignments;
create policy "student_assignments_admin_read"
on public.student_assignments
for select
using (public.is_platform_admin());

drop policy if exists "assignments_admin_read" on public.assignments;
create policy "assignments_admin_read"
on public.assignments
for select
using (public.is_platform_admin());

drop policy if exists "subscriptions_admin_read" on public.subscriptions;
create policy "subscriptions_admin_read"
on public.subscriptions
for select
using (public.is_platform_admin());

commit;
