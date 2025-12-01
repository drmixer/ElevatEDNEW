-- 025_parent_onboarding_state.sql
-- Persist lightweight onboarding/tour state for parent profiles.

begin;

alter table public.parent_profiles
  add column if not exists onboarding_state jsonb not null default '{}'::jsonb;

commit;
