-- 017_student_parent_goals.sql
-- Expose parent-set weekly goals to students via a security definer helper.

begin;

create or replace function public.get_student_parent_goals()
returns table (
  weekly_lessons_target integer,
  practice_minutes_target integer,
  mastery_targets jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid := auth.uid();
begin
  if v_student is null then
    raise exception 'auth required';
  end if;

  return query
  select
    pcg.weekly_lessons_target,
    pcg.practice_minutes_target,
    coalesce(pcg.mastery_targets, '{}'::jsonb)
  from public.parent_child_goals pcg
  where pcg.student_id = v_student
  order by pcg.updated_at desc
  limit 1;
end;
$$;

grant execute on function public.get_student_parent_goals() to authenticated;

commit;
