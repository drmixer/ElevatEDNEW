-- 036_parent_subscription_tier.sql
-- Add subscription_tier to parent_profiles for profile fetches.

begin;

alter table public.parent_profiles
  add column if not exists subscription_tier text;

commit;
