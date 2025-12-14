-- 043_tutor_personas.sql
-- Add columns for tutor personalization and distinct student avatar choices.

begin;

alter table public.student_profiles
  add column if not exists tutor_name text,
  add column if not exists tutor_avatar_id text,
  add column if not exists student_avatar_id text default 'avatar-starter';

commit;
