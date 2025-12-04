-- 037_parent_notifications_column.sql
-- Add notifications column to parent_profiles for app settings.

begin;

alter table public.parent_profiles
  add column if not exists notifications jsonb;

commit;
