-- 010_adaptive_rule_engine.sql
-- Adaptive rule configuration, mastery view, and next-lesson suggestion function.

begin;

create table if not exists public.adaptive_rules (
  id bigserial primary key,
  name text not null unique,
  params jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.adaptive_rules enable row level security;

create policy "adaptive_rules_authenticated_read"
on public.adaptive_rules
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "adaptive_rules_service_write"
on public.adaptive_rules
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Ensure student_progress defaults are present (no-op if already configured).
alter table public.student_progress
  alter column attempts set default 0,
  alter column last_activity_at set default now();

create index if not exists student_progress_student_idx
  on public.student_progress (student_id);

create index if not exists student_progress_lesson_idx
  on public.student_progress (lesson_id);

create index if not exists student_progress_status_idx
  on public.student_progress (status);

create or replace view public.v_student_topic_mastery as
with progress as (
  select
    sp.student_id,
    l.topic_id,
    sp.mastery_pct,
    sp.last_activity_at
  from public.student_progress sp
  join public.lessons l on l.id = sp.lesson_id
)
select
  p.student_id,
  p.topic_id,
  coalesce(avg(p.mastery_pct) filter (where p.mastery_pct is not null), 0)::numeric(5, 2) as topic_mastery_pct,
  max(p.last_activity_at) as last_activity_at
from progress p
group by p.student_id, p.topic_id;

create or replace function public.suggest_next_lessons(
  p_student_id uuid,
  limit_count int default 3
)
returns table (
  lesson_id bigint,
  topic_id bigint,
  reason text,
  confidence numeric(4, 3)
)
language plpgsql
as $$
declare
  active_params jsonb;
  min_mastery numeric := 85;
  review_threshold numeric := 70;
  max_attempts int := 2;
  current_topic_id bigint;
  current_topic_mastery numeric(5, 2) := 0;
  current_attempts int := 0;
  effective_limit int := greatest(coalesce(limit_count, 3), 1);
begin
  select params
  into active_params
  from public.adaptive_rules
  where is_active = true
  order by created_at desc
  limit 1;

  if active_params is not null then
    min_mastery := coalesce((active_params->>'min_mastery_to_advance')::numeric, min_mastery);
    review_threshold := coalesce((active_params->>'review_threshold')::numeric, review_threshold);
    max_attempts := coalesce((active_params->>'max_attempts_for_fast_track')::int, max_attempts);
  end if;

  select v.topic_id,
         coalesce(v.topic_mastery_pct, 0),
         coalesce(latest_attempts.attempts, 0)
  into current_topic_id, current_topic_mastery, current_attempts
  from public.v_student_topic_mastery v
  left join lateral (
    select sp.attempts
    from public.student_progress sp
    join public.lessons l on l.id = sp.lesson_id
    where sp.student_id = p_student_id
      and l.topic_id = v.topic_id
    order by sp.last_activity_at desc
    limit 1
  ) as latest_attempts(attempts) on true
  where v.student_id = p_student_id
  order by v.last_activity_at desc nulls last
  limit 1;

  if current_topic_id is null then
    select t.id
    into current_topic_id
    from public.topics t
    join public.lessons l on l.topic_id = t.id and l.is_published = true
    order by t.id
    limit 1;
    current_topic_mastery := 0;
    current_attempts := 0;
  end if;

  if current_topic_id is null then
    return;
  end if;

  if current_topic_mastery < review_threshold then
    return query
    select
      l.id as lesson_id,
      l.topic_id,
      'reinforcement'::text as reason,
      0.650::numeric(4, 3) as confidence
    from public.lessons l
    left join public.student_progress sp
      on sp.lesson_id = l.id and sp.student_id = p_student_id
    where l.topic_id = current_topic_id
      and l.is_published = true
      and (sp.id is null or coalesce(sp.mastery_pct, 0) < review_threshold)
      and (sp.mastery_pct is null or sp.mastery_pct < min_mastery)
    order by coalesce(sp.mastery_pct, 0), coalesce(sp.last_activity_at, to_timestamp(0)) asc
    limit least(effective_limit, 2);
    return;
  elsif current_topic_mastery >= min_mastery and current_attempts <= max_attempts then
    return query
    select
      l.id as lesson_id,
      l.topic_id,
      'advance_next_topic'::text as reason,
      0.800::numeric(4, 3) as confidence
    from public.topics next_topic
    join public.lessons l on l.topic_id = next_topic.id
    left join public.student_progress sp
      on sp.lesson_id = l.id and sp.student_id = p_student_id
    where l.is_published = true
      and (sp.mastery_pct is null or sp.mastery_pct < min_mastery)
      and next_topic.id <> current_topic_id
      and (
        exists (
          select 1
          from public.topic_prerequisites tp
          where tp.topic_id = next_topic.id
            and tp.prerequisite_id = current_topic_id
        )
        or not exists (
          select 1
          from public.topic_prerequisites tp
          where tp.topic_id = next_topic.id
        )
      )
      and not exists (
        select 1
        from public.topic_prerequisites tp
        left join public.v_student_topic_mastery vm
          on vm.topic_id = tp.prerequisite_id
         and vm.student_id = p_student_id
        where tp.topic_id = next_topic.id
          and coalesce(vm.topic_mastery_pct, 0) < min_mastery
      )
    order by next_topic.id, coalesce(sp.last_activity_at, to_timestamp(0)) desc, coalesce(l.estimated_duration_minutes, 9999)
    limit effective_limit;
    return;
  else
    return query
    select
      l.id as lesson_id,
      l.topic_id,
      'complete_topic'::text as reason,
      0.700::numeric(4, 3) as confidence
    from public.lessons l
    left join public.student_progress sp
      on sp.lesson_id = l.id and sp.student_id = p_student_id
    where l.topic_id = current_topic_id
      and l.is_published = true
      and (sp.id is null or coalesce(sp.mastery_pct, 0) < min_mastery)
    order by coalesce(sp.last_activity_at, to_timestamp(0)) asc, coalesce(l.estimated_duration_minutes, 0), l.id
    limit effective_limit;
    return;
  end if;
end;
$$;

comment on function public.suggest_next_lessons(uuid, int)
is 'Returns suggested next lessons for a student. Call via supabase.rpc("suggest_next_lessons", { student_id, limit_count }).';

grant select on public.v_student_topic_mastery to authenticated, service_role;
grant execute on function public.suggest_next_lessons(uuid, int) to authenticated, service_role;

commit;
