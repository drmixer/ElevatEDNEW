-- 019_learning_sequences.sql
-- Canonical learning path storage and adaptive function updates.

begin;

create table if not exists public.learning_sequences (
  id bigserial primary key,
  grade_band text not null,
  subject text not null,
  position int not null,
  module_slug text not null,
  module_title text not null,
  strand text,
  standard_codes text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  module_id bigint references public.modules (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint learning_sequences_unique_order unique (grade_band, subject, position)
);

create index if not exists learning_sequences_subject_idx
  on public.learning_sequences (grade_band, subject);

create index if not exists learning_sequences_module_slug_idx
  on public.learning_sequences (module_slug);

alter table public.learning_sequences enable row level security;

drop policy if exists "learning_sequences_read" on public.learning_sequences;
drop policy if exists "learning_sequences_service_write" on public.learning_sequences;

create policy "learning_sequences_read"
on public.learning_sequences
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "learning_sequences_service_write"
on public.learning_sequences
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Respect canonical sequences when available; fallback to legacy adaptive logic otherwise.
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
  target_grade text := '6';
  target_subject text := 'Mathematics';
  profile_path jsonb := '[]'::jsonb;
begin
  select condition_json
  into active_params
  from public.adaptive_rules
  where active = true
  order by created_at desc
  limit 1;

  if active_params is not null then
    min_mastery := coalesce((active_params->>'min_mastery_to_advance')::numeric, min_mastery);
    review_threshold := coalesce((active_params->>'review_threshold')::numeric, review_threshold);
    max_attempts := coalesce((active_params->>'max_attempts_for_fast_track')::int, max_attempts);
  end if;

  select grade::text, coalesce(learning_path, '[]'::jsonb)
  into target_grade, profile_path
  from public.student_profiles
  where id = p_student_id;

  target_grade := coalesce(nullif(target_grade, ''), '6');

  -- Choose subject from active learning_path first, then recent progress, else default to Math.
  select case lower(entry->>'subject')
           when 'math' then 'Mathematics'
           when 'english' then 'English Language Arts'
           when 'ela' then 'English Language Arts'
           else null
         end
  into target_subject
  from jsonb_array_elements(profile_path) entry
  where coalesce(entry->>'status', '') <> 'completed'
  limit 1;

  if target_subject is null then
    select coalesce(m.subject, target_subject)
    into target_subject
    from public.student_progress sp
    join public.lessons l on l.id = sp.lesson_id
    left join public.modules m on m.id = l.module_id
    where sp.student_id = p_student_id
    order by sp.last_activity_at desc nulls last
    limit 1;
  end if;

  target_subject := coalesce(nullif(target_subject, ''), 'Mathematics');

  return query
  with sequence as (
    select
      ls.position,
      ls.module_slug,
      ls.module_title,
      ls.standard_codes,
      ls.metadata,
      coalesce(ls.module_id, m.id) as module_id,
      coalesce(avg(sp.mastery_pct), 0)::numeric(5, 2) as module_mastery,
      max(sp.last_activity_at) as last_activity
    from public.learning_sequences ls
    left join public.modules m on m.slug = ls.module_slug
    left join public.lessons l on l.module_id = coalesce(ls.module_id, m.id)
    left join public.student_progress sp
      on sp.lesson_id = l.id
     and sp.student_id = p_student_id
    where ls.grade_band = target_grade
      and lower(ls.subject) = lower(target_subject)
    group by ls.position, ls.module_slug, ls.module_title, ls.standard_codes, ls.metadata, ls.module_id, m.id
  ),
  active_module as (
    select *
    from sequence
    where module_id is not null
      and (module_mastery < min_mastery or module_mastery is null)
    order by position
    limit 1
  ),
  target_module as (
    select * from active_module
    union all
    select * from sequence order by position desc limit 1
  )
  select
    l.id as lesson_id,
    l.topic_id,
    case
      when tm.module_mastery < review_threshold then 'reinforcement'
      when tm.module_mastery >= min_mastery then 'advance_canonical_module'
      else 'complete_topic'
    end as reason,
    0.820::numeric(4, 3) as confidence
  from target_module tm
  join public.lessons l on l.module_id = tm.module_id
  left join public.student_progress sp
    on sp.lesson_id = l.id
   and sp.student_id = p_student_id
  where l.is_published = true
    and (sp.mastery_pct is null or sp.mastery_pct < min_mastery)
  order by coalesce(sp.mastery_pct, 0), coalesce(sp.last_activity_at, to_timestamp(0)) asc, coalesce(l.estimated_duration_minutes, 9999)
  limit effective_limit;

  if found then
    return;
  end if;

  -- Fallback: legacy topic-first logic.
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
is 'Returns suggested next lessons for a student using canonical sequences first. Call via supabase.rpc("suggest_next_lessons", { p_student_id, limit_count }).';

grant select on public.learning_sequences to authenticated, service_role;
grant execute on function public.suggest_next_lessons(uuid, int) to authenticated, service_role;

commit;
