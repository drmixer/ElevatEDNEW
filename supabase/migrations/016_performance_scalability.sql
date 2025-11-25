-- 016_performance_scalability.sql
-- Dashboard rollups, indexing, and safer import worker orchestration.

begin;

-- Pre-aggregate mastery by subject to avoid repeated joins in dashboards.
create or replace view public.student_mastery_by_subject as
select
  sm.student_id,
  lower(replace(subj.name, ' ', '_')) as subject,
  subj.name as subject_name,
  sp.grade as grade,
  round(avg(sm.mastery_pct)::numeric, 2) as mastery,
  round((
    select avg(sm2.mastery_pct)
    from public.student_mastery sm2
    join public.student_profiles sp2 on sp2.id = sm2.student_id
    join public.skills sk2 on sk2.id = sm2.skill_id
    where sp2.grade = sp.grade
      and sk2.subject_id = subj.id
  )::numeric, 2) as cohort_average
from public.student_mastery sm
join public.student_profiles sp on sp.id = sm.student_id
join public.skills sk on sk.id = sm.skill_id
join public.subjects subj on subj.id = sk.subject_id
group by sm.student_id, subj.id, subj.name, sp.grade;

grant select on public.student_mastery_by_subject to authenticated;

-- Aggregate progress status counts for dashboards.
create or replace view public.student_progress_status_counts as
select
  student_id,
  count(*) filter (where status = 'completed') as completed_count,
  count(*) filter (where status = 'in_progress') as in_progress_count,
  count(*) filter (where status = 'not_started') as not_started_count
from public.student_progress
group by student_id;

grant select on public.student_progress_status_counts to authenticated;

-- Weekly engagement rollup for admin dashboards.
create or replace view public.admin_activity_rollup as
select
  date_trunc('week', sda.activity_date)::date as week_start,
  count(distinct sda.student_id) filter (where coalesce(sda.lessons_completed, 0) > 0) as active_students,
  sum(coalesce(sda.lessons_completed, 0)) as lessons_completed,
  sum(coalesce(sda.xp_earned, 0)) as xp_earned
from public.student_daily_activity sda
where sda.activity_date >= current_date - interval '90 days'
group by date_trunc('week', sda.activity_date)::date;

grant select on public.admin_activity_rollup to authenticated;

-- Refresh the parent dashboard view to reuse mastery rollups and guardian links.
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
mastery_breakdown as (
  select
    lp.parent_id,
    sms.student_id,
    jsonb_agg(
      jsonb_build_object(
        'subject', sms.subject,
        'mastery', sms.mastery,
        'cohortAverage', sms.cohort_average,
        'goal', coalesce(
          (pcg.mastery_targets ->> sms.subject)::numeric,
          80
        )
      )
      order by sms.subject
    ) as breakdown
  from public.student_mastery_by_subject sms
  join linked_parents lp on lp.student_id = sms.student_id
  left join public.parent_child_goals pcg
    on pcg.parent_id = lp.parent_id
   and pcg.student_id = lp.student_id
  group by lp.parent_id, sms.student_id, pcg.mastery_targets
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

-- Concurrency-safe import claiming for dedicated workers.
create or replace function public.claim_pending_import_run()
returns public.import_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.import_runs;
begin
  select *
  into v_run
  from public.import_runs
  where status = 'pending'
  order by started_at
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.import_runs
  set status = 'running',
      started_at = now()
  where id = v_run.id
  returning * into v_run;

  return v_run;
end;
$$;

grant execute on function public.claim_pending_import_run() to service_role;

-- Indexes for frequent dashboard and module catalog filters.
create index if not exists modules_visibility_filter_idx
  on public.modules (visibility, subject, grade_band, open_track);

create index if not exists lessons_module_visibility_idx
  on public.lessons (module_id, visibility);

create index if not exists module_standards_standard_idx
  on public.module_standards (standard_id, module_id);

create index if not exists student_daily_activity_student_date_idx
  on public.student_daily_activity (student_id, activity_date desc);

create index if not exists xp_events_student_created_idx
  on public.xp_events (student_id, created_at desc);

create index if not exists student_mastery_student_skill_idx
  on public.student_mastery (student_id, skill_id);

create index if not exists student_progress_status_idx
  on public.student_progress (student_id, status, last_activity_at desc);

commit;
