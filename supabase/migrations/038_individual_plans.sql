-- New B2C plan lineup: individual-free / individual-plus / individual-pro
-- Parents are the only payers; students stay on Free until linked.

insert into plans (slug, name, price_cents, status, metadata)
values
  (
    'individual-free',
    'Free',
    0,
    'active',
    jsonb_build_object(
      'tagline', 'Start your smarter learning journey.',
      'included_students', 1,
      'seat_cap', 1,
      'extra_student_discount_pct', 20,
      'extra_student_price_cents', 0,
      'lesson_limit', 10,
      'ai_tutor_daily_limit', 3,
      'ai_access', true,
      'advanced_analytics', false,
      'weekly_ai_summaries', false,
      'weekly_digest', true,
      'exports_enabled', false,
      'priority_support', false
    )
  ),
  (
    'individual-plus',
    'Plus',
    699,
    'active',
    jsonb_build_object(
      'tagline', 'Unlock deeper insights and personalized progress.',
      'included_students', 1,
      'seat_cap', 4,
      'extra_student_discount_pct', 20,
      'extra_student_price_cents', 559,
      'lesson_limit', 100,
      'ai_tutor_daily_limit', 30,
      'ai_access', true,
      'advanced_analytics', true,
      'weekly_ai_summaries', true,
      'weekly_digest', true,
      'exports_enabled', true,
      'priority_support', false
    )
  ),
  (
    'individual-pro',
    'Pro',
    999,
    'active',
    jsonb_build_object(
      'tagline', 'Full power for serious results.',
      'included_students', 1,
      'seat_cap', 6,
      'extra_student_discount_pct', 20,
      'extra_student_price_cents', 799,
      'lesson_limit', 'unlimited',
      'ai_tutor_daily_limit', 'unlimited',
      'ai_tutor_guardrail_per_day', 100,
      'ai_access', true,
      'advanced_analytics', true,
      'weekly_ai_summaries', true,
      'weekly_digest', true,
      'exports_enabled', true,
      'priority_support', true
    )
  )
on conflict (slug) do update
set
  name = excluded.name,
  price_cents = excluded.price_cents,
  status = excluded.status,
  metadata = excluded.metadata;

-- Mark legacy family plans as such (kept for existing subscribers)
update plans
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('legacy', true)
where slug in ('family-free', 'family-plus', 'family-premium');
