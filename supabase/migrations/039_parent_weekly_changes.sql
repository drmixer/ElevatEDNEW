-- Add change summary to parent weekly reports for “What changed this week”

alter table if exists public.parent_weekly_reports
add column if not exists changes jsonb not null default jsonb_build_object(
  'improvements', '[]'::jsonb,
  'risks', '[]'::jsonb
);

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
    ai_generated,
    changes
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
    true,
    jsonb_build_object(
      'improvements', coalesce(ht.highlights, '[]'::jsonb),
      'risks', jsonb_build_array(
        to_jsonb('Review alerts and assign a module to the flagged area.'),
        to_jsonb('Schedule a diagnostic if pacing looks off.')
      )
    )
  from parent_totals pt
  left join highlight_text ht on ht.parent_id = pt.parent_id
  on conflict (parent_id, week_start) do update
    set summary = excluded.summary,
        highlights = excluded.highlights,
        recommendations = excluded.recommendations,
        ai_generated = excluded.ai_generated,
        changes = excluded.changes,
        created_at = now();
end;
$$;

grant execute on function public.refresh_parent_weekly_reports(date) to authenticated;
