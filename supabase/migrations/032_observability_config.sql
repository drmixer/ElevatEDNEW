-- Platform runtime configuration for adaptive, XP, and tutor knobs.
create table if not exists public.platform_config (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

comment on table public.platform_config is 'Runtime config toggles for adaptive targets, XP multipliers, tutor timeouts, etc.';

insert into public.platform_config (key, value)
values
  ('adaptive.target_accuracy_min', '0.65'),
  ('adaptive.target_accuracy_max', '0.8'),
  ('adaptive.max_remediation_pending', '2'),
  ('adaptive.max_practice_pending', '3'),
  ('adaptive.struggle_consecutive_misses', '3'),
  ('xp.multiplier', '1'),
  ('xp.difficulty_bonus_multiplier', '1'),
  ('xp.accuracy_bonus_multiplier', '1'),
  ('xp.streak_bonus_multiplier', '1'),
  ('tutor.timeout_ms', '12000')
on conflict (key) do nothing;
