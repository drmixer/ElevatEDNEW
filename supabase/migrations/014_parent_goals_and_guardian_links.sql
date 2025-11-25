-- 014_parent_goals_and_guardian_links.sql
-- Parent goal tracking, guardian link UX helpers, and parent dashboard enrichment.

begin;

-- Store per-child, per-guardian goals for progress tracking.
create table if not exists public.parent_child_goals (
  id bigserial primary key,
  parent_id uuid not null references public.parent_profiles (id) on delete cascade,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  weekly_lessons_target integer,
  practice_minutes_target integer,
  mastery_targets jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

alter table public.parent_child_goals enable row level security;

drop policy if exists "parent_child_goals_parent_rw" on public.parent_child_goals;
create policy "parent_child_goals_parent_rw"
on public.parent_child_goals
for all
using (parent_id = auth.uid())
with check (parent_id = auth.uid());

drop policy if exists "parent_child_goals_service_rw" on public.parent_child_goals;
create policy "parent_child_goals_service_rw"
on public.parent_child_goals
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create or replace function public.touch_parent_child_goals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists parent_child_goals_set_updated_at on public.parent_child_goals;
create trigger parent_child_goals_set_updated_at
before update on public.parent_child_goals
for each row
execute procedure public.touch_parent_child_goals_updated_at();

-- Add a non-guessable code students can share with guardians to link accounts.
alter table public.student_profiles
add column if not exists family_link_code text
  not null default encode(gen_random_bytes(8), 'hex');

create unique index if not exists student_family_link_code_idx on public.student_profiles (family_link_code);

-- Allow parents to activate a guardian link via a family code without breaking RLS.
create or replace function public.link_guardian_with_code(link_code text, relationship text default null)
returns public.guardian_child_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_parent uuid := auth.uid();
  v_link guardian_child_links;
begin
  if v_parent is null then
    raise exception 'Auth required';
  end if;

  select id
  into v_student
  from public.student_profiles
  where family_link_code = link_code
  limit 1;

  if v_student is null then
    raise exception 'invalid_code';
  end if;

  insert into public.guardian_child_links (parent_id, student_id, relationship, status, invited_at, accepted_at, metadata)
  values (
    v_parent,
    v_student,
    coalesce(relationship, 'guardian'),
    'active',
    now(),
    now(),
    jsonb_build_object('linked_via', 'family_code')
  )
  on conflict (parent_id, student_id) do update
    set relationship = coalesce(excluded.relationship, guardian_child_links.relationship),
        status = 'active',
        accepted_at = coalesce(guardian_child_links.accepted_at, now()),
        invited_at = coalesce(guardian_child_links.invited_at, now()),
        metadata = guardian_child_links.metadata || jsonb_build_object('linked_via', 'family_code');

  select *
  into v_link
  from public.guardian_child_links
  where parent_id = v_parent
    and student_id = v_student;

  return v_link;
end;
$$;

grant execute on function public.link_guardian_with_code(text, text) to authenticated;

-- Expand the parent dashboard view to honor guardian links and surface goals.
create or replace view public.parent_dashboard_children as
with child_base as (
  select
    sp.id as student_id,
    sp.parent_id as canonical_parent_id,
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
  ) sd on true
),
linked_parents as (
  select
    cb.student_id,
    cb.canonical_parent_id as parent_id
  from child_base cb
  union
  select
    gcl.student_id,
    gcl.parent_id
  from public.guardian_child_links gcl
  where gcl.status = 'active'
),
mastery_rollup as (
  select
    sm.student_id,
    sk.subject_id,
    subj.name as subject_name,
    sp.grade,
    avg(sm.mastery_pct) as mastery_avg
  from public.student_mastery sm
  join public.student_profiles sp on sp.id = sm.student_id
  join public.skills sk on sk.id = sm.skill_id
  join public.subjects subj on subj.id = sk.subject_id
  group by sm.student_id, sk.subject_id, subj.name, sp.grade
),
mastery_breakdown as (
  select
    lp.parent_id,
    mr.student_id,
    jsonb_agg(
      jsonb_build_object(
        'subject', lower(replace(mr.subject_name, ' ', '_')),
        'mastery', round(mr.mastery_avg::numeric, 2),
        'cohortAverage', round((
          select avg(sm2.mastery_pct)
          from public.student_mastery sm2
          join public.student_profiles sp2 on sp2.id = sm2.student_id
          join public.skills sk2 on sk2.id = sm2.skill_id
          where sp2.grade = mr.grade
            and sk2.subject_id = mr.subject_id
        )::numeric, 2),
        'goal', coalesce(
          (pcg.mastery_targets ->> lower(replace(mr.subject_name, ' ', '_')))::numeric,
          80
        )
      )
      order by mr.subject_name
    ) as breakdown
  from mastery_rollup mr
  join linked_parents lp on lp.student_id = mr.student_id
  left join public.parent_child_goals pcg
    on pcg.parent_id = lp.parent_id
   and pcg.student_id = lp.student_id
  group by lp.parent_id, mr.student_id, pcg.mastery_targets
)
select
  lp.parent_id,
  cb.student_id,
  cb.first_name,
  cb.last_name,
  cb.grade,
  cb.level,
  cb.xp,
  cb.streak_days,
  cb.strengths,
  cb.weaknesses,
  cb.lessons_completed_week,
  cb.practice_minutes_week,
  cb.xp_earned_week,
  coalesce(mb.breakdown, '[]'::jsonb) as mastery_breakdown,
  pcg.weekly_lessons_target,
  pcg.practice_minutes_target,
  pcg.mastery_targets
from linked_parents lp
join child_base cb on cb.student_id = lp.student_id
left join public.parent_child_goals pcg
  on pcg.parent_id = lp.parent_id
 and pcg.student_id = lp.student_id
left join mastery_breakdown mb
  on mb.parent_id = lp.parent_id
 and mb.student_id = lp.student_id;

grant select on public.parent_dashboard_children to authenticated;

commit;
