-- 008_dashboard_automation.sql
-- Aggregation routines, admin access controls, and logging.

begin;

create extension if not exists pgcrypto;

create table public.admin_invites (
  id bigserial primary key,
  email text not null,
  token text not null unique,
  invited_by uuid references public.admin_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  redeemed_at timestamptz,
  redeemed_by uuid references public.profiles (id) on delete set null
);

alter table public.admin_invites
  add constraint admin_invites_email_unique unique (email);

alter table public.admin_invites enable row level security;

drop policy if exists "admin_invites_admin_read" on public.admin_invites;
create policy "admin_invites_admin_read"
on public.admin_invites
for select
using (public.is_platform_admin());

drop policy if exists "admin_invites_admin_manage" on public.admin_invites;
create policy "admin_invites_admin_manage"
on public.admin_invites
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

create table public.admin_audit_logs (
  id bigserial primary key,
  admin_id uuid not null references public.admin_profiles (id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "admin_audit_logs_admin_read" on public.admin_audit_logs;
create policy "admin_audit_logs_admin_read"
on public.admin_audit_logs
for select
using (public.is_platform_admin());

drop policy if exists "admin_audit_logs_admin_insert" on public.admin_audit_logs;
create policy "admin_audit_logs_admin_insert"
on public.admin_audit_logs
for insert
with check (public.is_platform_admin());

drop policy if exists "admin_audit_logs_service" on public.admin_audit_logs;
create policy "admin_audit_logs_service"
on public.admin_audit_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create or replace function public.generate_admin_invite(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_token text := encode(gen_random_bytes(24), 'hex');
  v_invited_by uuid := auth.uid();
begin
  if not public.is_platform_admin(v_invited_by) then
    raise exception 'Only platform admins can generate invites';
  end if;

  insert into public.admin_invites (email, token, invited_by)
  values (p_email, v_invite_token, v_invited_by)
  on conflict (email)
  do update set token = excluded.token, created_at = now(), expires_at = now() + interval '7 days', invited_by = excluded.invited_by;

  return v_invite_token;
end;
$$;

grant execute on function public.generate_admin_invite(text) to authenticated;

create or replace function public.promote_user_to_admin(p_user uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
begin
  select *
  into v_invite
  from public.admin_invites
  where token = p_token
    and expires_at > now()
    and redeemed_at is null
  limit 1;

  if v_invite is null then
    raise exception 'Invite token is invalid or expired';
  end if;

  update public.profiles
  set role = 'admin'
  where id = p_user;

  insert into public.admin_profiles (id, title, permissions)
  values (p_user, 'Platform Admin', array['dashboard:view','users:manage'])
  on conflict (id) do update
    set title = excluded.title,
        permissions = excluded.permissions;

  update public.admin_invites
  set redeemed_at = now(), redeemed_by = p_user
  where id = v_invite.id;
end;
$$;

grant execute on function public.promote_user_to_admin(uuid, text) to authenticated;

create or replace function public.log_admin_event(p_event_type text, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  if not public.is_platform_admin(v_admin_id) then
    raise exception 'Only admins can log admin events';
  end if;

  insert into public.admin_audit_logs (admin_id, event_type, metadata)
  values (v_admin_id, p_event_type, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

grant execute on function public.log_admin_event(text, jsonb) to authenticated;

create or replace function public.refresh_student_daily_activity(
  p_start date default (current_date - interval '14 days'),
  p_end date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := coalesce(p_start, current_date - 14);
  v_end date := coalesce(p_end, current_date);
begin
  delete from public.student_daily_activity
  where activity_date between v_start and v_end;

  with date_span as (
    select generate_series(v_start, v_end, interval '1 day')::date as activity_date
  ),
  student_span as (
    select sp.id as student_id, ds.activity_date
    from public.student_profiles sp
    cross join date_span ds
  ),
  session_stats as (
    select
      ps.student_id,
      ps.started_at::date as activity_date,
      count(distinct ps.lesson_id) filter (where ps.lesson_id is not null) as lessons_completed,
      coalesce(sum(extract(epoch from coalesce(ps.ended_at, now()) - ps.started_at)) / 60.0, 0) as practice_minutes
    from public.practice_sessions ps
    where ps.started_at::date between v_start and v_end
    group by ps.student_id, ps.started_at::date
  ),
  ai_stats as (
    select
      ps.student_id,
      pe.created_at::date as activity_date,
      count(*) filter (where pe.event_type in ('hint_request','system_feedback')) as ai_sessions
    from public.practice_events pe
    join public.practice_sessions ps on ps.id = pe.session_id
    where pe.created_at::date between v_start and v_end
    group by ps.student_id, pe.created_at::date
  ),
  xp_stats as (
    select
      xe.student_id,
      xe.created_at::date as activity_date,
      sum(xe.xp_change) as xp_earned
    from public.xp_events xe
    where xe.created_at::date between v_start and v_end
    group by xe.student_id, xe.created_at::date
  ),
  streak_stats as (
    select
      sl.student_id,
      sl.activity_date,
      bool_or(sl.activity_count > 0) as streak_preserved
    from public.streak_logs sl
    where sl.activity_date between v_start and v_end
    group by sl.student_id, sl.activity_date
  )
  insert into public.student_daily_activity (
    student_id,
    activity_date,
    lessons_completed,
    practice_minutes,
    ai_sessions,
    xp_earned,
    streak_preserved
  )
  select
    ss.student_id,
    ss.activity_date,
    coalesce(sess.lessons_completed, 0),
    coalesce(round(sess.practice_minutes)::int, 0),
    coalesce(ai.ai_sessions, 0),
    coalesce(xp.xp_earned, 0),
    coalesce(streak.streak_preserved, false)
  from student_span ss
  left join session_stats sess
    on sess.student_id = ss.student_id
   and sess.activity_date = ss.activity_date
  left join ai_stats ai
    on ai.student_id = ss.student_id
   and ai.activity_date = ss.activity_date
  left join xp_stats xp
    on xp.student_id = ss.student_id
   and xp.activity_date = ss.activity_date
  left join streak_stats streak
    on streak.student_id = ss.student_id
   and streak.activity_date = ss.activity_date
  on conflict (student_id, activity_date) do update
    set lessons_completed = excluded.lessons_completed,
        practice_minutes = excluded.practice_minutes,
        ai_sessions = excluded.ai_sessions,
        xp_earned = excluded.xp_earned,
        streak_preserved = excluded.streak_preserved;
end;
$$;

grant execute on function public.refresh_student_daily_activity(date, date) to authenticated;

create or replace function public.refresh_parent_weekly_reports(p_week_start date default date_trunc('week', current_date)::date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date := date_trunc('week', coalesce(p_week_start, current_date))::date;
  v_week_end date := v_week_start + 6;
begin
  delete from public.parent_weekly_reports
  where week_start = v_week_start;

  with weekly_activity as (
    select
      sp.parent_id,
      sda.student_id,
      sum(sda.lessons_completed) as lessons_completed,
      sum(sda.practice_minutes) as practice_minutes,
      sum(sda.xp_earned) as xp_earned
    from public.student_daily_activity sda
    join public.student_profiles sp on sp.id = sda.student_id
    where sda.activity_date between v_week_start and v_week_end
    group by sp.parent_id, sda.student_id
  ),
  parent_totals as (
    select
      pp.id as parent_id,
      coalesce(sum(wa.lessons_completed), 0) as lessons_completed,
      coalesce(sum(wa.practice_minutes), 0) as practice_minutes,
      coalesce(sum(wa.xp_earned), 0) as xp_earned
    from public.parent_profiles pp
    left join weekly_activity wa on wa.parent_id = pp.id
    group by pp.id
  ),
  highlight_text as (
    select
      wa.parent_id,
      jsonb_agg(
        to_jsonb(
          format('%s logged %s XP with %s lessons completed',
            coalesce(sp.first_name || ' ' || sp.last_name, sp.id::text),
            coalesce(wa.xp_earned, 0),
            coalesce(wa.lessons_completed, 0)
          )
        )
        order by wa.xp_earned desc
      ) as highlights
    from weekly_activity wa
    join public.student_profiles sp on sp.id = wa.student_id
    group by wa.parent_id
  )
  insert into public.parent_weekly_reports (
    parent_id,
    week_start,
    summary,
    highlights,
    recommendations,
    ai_generated
  )
  select
    pt.parent_id,
    v_week_start,
    case
      when coalesce(pt.practice_minutes, 0) = 0 then 'No activity recorded last week. Encourage a quick study session to restart the streak.'
      else format('Your family completed %s lessons and %s minutes of learning for %s XP.', pt.lessons_completed, pt.practice_minutes, pt.xp_earned)
    end,
    coalesce(ht.highlights, '[]'::jsonb),
    jsonb_build_array(
      to_jsonb('Schedule a family reflection to celebrate wins and set next week''s goals.'),
      to_jsonb('Review AI recommendations inside the dashboard to reinforce focus areas.')
    ),
    true
  from parent_totals pt
  left join highlight_text ht on ht.parent_id = pt.parent_id
  on conflict (parent_id, week_start) do update
    set summary = excluded.summary,
        highlights = excluded.highlights,
        recommendations = excluded.recommendations,
        ai_generated = excluded.ai_generated,
        created_at = now();
end;
$$;

grant execute on function public.refresh_parent_weekly_reports(date) to authenticated;

create or replace function public.refresh_dashboard_rollups()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_student_daily_activity();
  perform public.refresh_parent_weekly_reports();
end;
$$;

grant execute on function public.refresh_dashboard_rollups() to authenticated;

create or replace view public.parent_dashboard_children as
with mastery_rollup as (
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
        'goal', 80
      )
      order by mr.subject_name
    ) as breakdown
  from mastery_rollup mr
  group by mr.student_id
)
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
  coalesce(sd.xp_earned, 0) as xp_earned_week,
  coalesce(mb.breakdown, '[]'::jsonb) as mastery_breakdown
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
left join mastery_breakdown mb on mb.student_id = sp.id;


grant select on public.parent_dashboard_children to authenticated;

commit;
