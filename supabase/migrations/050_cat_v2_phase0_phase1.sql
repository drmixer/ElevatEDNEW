-- Phase 0 / Phase 1 groundwork for Find My Level CAT v2.
-- Adds versioning/config scaffolding and extends subject state / response storage.

begin;

insert into public.platform_config (key, value)
values
  ('placement.engine_active', '"legacy_v1"'::jsonb),
  ('placement.cat_v2_new_students_enabled', 'false'::jsonb),
  ('placement.cat_v2_restart_enabled', 'false'::jsonb)
on conflict (key) do nothing;

alter table public.student_subject_state
  add column if not exists diagnostic_version text,
  add column if not exists prior_level_hint numeric(4, 2),
  add column if not exists confidence_low numeric(4, 2),
  add column if not exists confidence_high numeric(4, 2),
  add column if not exists prerequisite_gaps jsonb not null default '[]'::jsonb,
  add column if not exists calibration_state jsonb not null default '{}'::jsonb,
  add column if not exists last_recalibrated_at timestamptz,
  add column if not exists last_diagnostic_type text not null default 'legacy_v1';

update public.student_subject_state
set
  diagnostic_version = coalesce(diagnostic_version, 'legacy_v1'),
  prior_level_hint = coalesce(prior_level_hint, expected_level),
  prerequisite_gaps = coalesce(prerequisite_gaps, '[]'::jsonb),
  calibration_state = coalesce(calibration_state, '{}'::jsonb),
  last_diagnostic_type = coalesce(last_diagnostic_type, 'legacy_placement')
where diagnostic_version is null
   or prior_level_hint is null
   or prerequisite_gaps is null
   or calibration_state is null
   or last_diagnostic_type is null;

alter table public.student_assessment_responses
  add column if not exists metadata jsonb not null default '{}'::jsonb;

commit;
