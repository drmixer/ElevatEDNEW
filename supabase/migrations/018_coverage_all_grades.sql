-- 018_coverage_all_grades.sql
-- Expand coverage dashboard views to all subjects and grade bands (K-12 and beyond).

begin;

create or replace view public.coverage_dashboard_cells as
with base_modules as (
  select
    m.id,
    m.slug,
    m.title,
    m.subject,
    m.grade_band,
    m.strand,
    m.topic,
    m.subtopic,
    m.updated_at
  from public.modules m
),
lesson_counts as (
  select
    module_id,
    count(*) as lesson_count,
    count(*) filter (where visibility = 'public') as public_lesson_count,
    max(updated_at) as last_lesson_at
  from public.lessons
  where module_id is not null
  group by module_id
),
asset_counts as (
  select
    coalesce(a.module_id, l.module_id) as module_id,
    count(distinct a.id) as asset_count,
    count(distinct a.id) filter (
      where coalesce((a.metadata->>'storage_mode')::text, 'stored') in ('link', 'embed')
    ) as external_resource_count,
    max(a.updated_at) as last_asset_at
  from public.assets a
  left join public.lessons l on l.id = a.lesson_id
  where coalesce(a.module_id, l.module_id) is not null
  group by coalesce(a.module_id, l.module_id)
),
module_with_standards as (
  select
    bm.*,
    st.framework as standard_framework,
    st.code as standard_code
  from base_modules bm
  left join public.module_standards ms on ms.module_id = bm.id
  left join public.standards st on st.id = ms.standard_id
),
module_summary as (
  select
    mws.*,
    coalesce(lc.lesson_count, 0) as lesson_count,
    coalesce(lc.public_lesson_count, 0) as public_lesson_count,
    coalesce(ac.asset_count, 0) as asset_count,
    coalesce(ac.external_resource_count, 0) as external_resource_count,
    coalesce(lc.last_lesson_at, ac.last_asset_at, mws.updated_at) as content_last_updated_at
  from module_with_standards mws
  left join lesson_counts lc on lc.module_id = mws.id
  left join asset_counts ac on ac.module_id = mws.id
)
select
  ms.grade_band,
  ms.subject,
  ms.id as module_id,
  ms.slug as module_slug,
  ms.title as module_title,
  ms.strand,
  ms.topic,
  ms.subtopic,
  ms.standard_framework,
  ms.standard_code,
  ms.lesson_count,
  ms.public_lesson_count,
  coalesce(pc.total_practice_count, 0) as practice_items_total,
  case
    when ms.standard_code is not null then coalesce(pc.standard_practice_count, 0)
    else coalesce(pc.module_practice_count, 0)
  end as practice_items_aligned,
  coalesce(asmt.assessment_count, 0) as assessment_count,
  coalesce(asmt.unit_assessment_count, 0) > 0 as has_assessment,
  ms.asset_count,
  ms.external_resource_count,
  20 as practice_target,
  ms.public_lesson_count > 0 as meets_explanation_baseline,
  case
    when ms.standard_code is not null then coalesce(pc.standard_practice_count, 0) >= 20
    else coalesce(pc.module_practice_count, 0) >= 20
  end as meets_practice_baseline,
  coalesce(asmt.unit_assessment_count, 0) > 0 as meets_assessment_baseline,
  coalesce(ms.external_resource_count, 0) > 0 as meets_external_baseline,
  greatest(
    coalesce(ms.content_last_updated_at, ms.updated_at),
    coalesce(pc.last_question_at, ms.updated_at),
    coalesce(asmt.last_assessment_at, ms.updated_at)
  ) as last_touched_at
from module_summary ms
left join lateral (
  select
    count(distinct qb.id) as total_practice_count,
    count(distinct qb.id) filter (
      where (qb.metadata->>'module_slug') = ms.slug
        or (qb.metadata->>'module_id')::bigint = ms.id
    ) as module_practice_count,
    count(distinct qb.id) filter (
      where ms.standard_code is not null and (
        (qb.metadata->'standards' @> jsonb_build_array(ms.standard_code))
        or exists (
          select 1
          from public.question_skills qs
          join public.skills sk on sk.id = qs.skill_id
          where qs.question_id = qb.id
            and sk.standard_code = ms.standard_code
        )
      )
    ) as standard_practice_count,
    max(qb.created_at) as last_question_at
  from public.question_bank qb
  left join public.subjects subj on subj.id = qb.subject_id
  where coalesce(subj.name, ms.subject) = ms.subject
    and (
      (qb.metadata->>'module_slug') = ms.slug
      or (qb.metadata->>'module_id')::bigint = ms.id
      or (ms.standard_code is not null and (
        (qb.metadata->'standards' @> jsonb_build_array(ms.standard_code))
        or exists (
          select 1
          from public.question_skills qs
          join public.skills sk on sk.id = qs.skill_id
          where qs.question_id = qb.id
            and sk.standard_code = ms.standard_code
        )
      ))
    )
) pc on true
left join lateral (
  select
    count(*) as assessment_count,
    count(*) filter (
      where coalesce(a.metadata->>'assessment_type', a.metadata->>'purpose', '') in ('unit_assessment', 'unit', 'baseline', 'summative')
        or a.is_adaptive = true
    ) as unit_assessment_count,
    max(a.created_at) as last_assessment_at
  from public.assessments a
  where a.module_id = ms.id
    or (a.metadata->>'module_slug') = ms.slug
) asmt on true;

create or replace view public.coverage_dashboard_rollup as
with module_cells as (
  select
    module_id,
    grade_band,
    subject,
    module_slug,
    module_title,
    bool_and(meets_explanation_baseline) as meets_explanation_baseline,
    bool_and(meets_practice_baseline) as meets_practice_baseline,
    bool_and(meets_assessment_baseline) as meets_assessment_baseline,
    bool_and(meets_external_baseline) as meets_external_baseline
  from public.coverage_dashboard_cells
  group by module_id, grade_band, subject, module_slug, module_title
)
select
  grade_band,
  subject,
  count(*) as modules,
  count(*) filter (where meets_explanation_baseline) as modules_with_explanations,
  count(*) filter (where meets_practice_baseline) as modules_meeting_practice_baseline,
  count(*) filter (where meets_assessment_baseline) as modules_with_assessments,
  count(*) filter (where meets_external_baseline) as modules_with_external_resources,
  count(*) filter (
    where not (
      meets_explanation_baseline
      and meets_practice_baseline
      and meets_assessment_baseline
      and meets_external_baseline
    )
  ) as modules_needing_attention,
  count(*) filter (where not meets_explanation_baseline) as modules_missing_explanations,
  count(*) filter (where not meets_practice_baseline) as modules_missing_practice,
  count(*) filter (where not meets_assessment_baseline) as modules_missing_assessments,
  count(*) filter (where not meets_external_baseline) as modules_missing_external_resources
from module_cells
group by grade_band, subject
order by grade_band, subject;

grant select on public.coverage_dashboard_cells to authenticated, service_role;
grant select on public.coverage_dashboard_rollup to authenticated, service_role;

commit;
