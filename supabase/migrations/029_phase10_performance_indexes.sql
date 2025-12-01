-- Performance Phase 10: fill in missing high-traffic indexes.

-- Dashboard rollups
create index if not exists student_progress_student_lesson_idx
  on public.student_progress (student_id, lesson_id);

create index if not exists student_progress_student_activity_idx
  on public.student_progress (student_id, last_activity_at desc);

create index if not exists student_assignments_student_status_due_idx
  on public.student_assignments (student_id, status, due_at);

create index if not exists practice_events_session_order_idx
  on public.practice_events (session_id, event_order);

-- Catalog/module pages
create index if not exists module_standards_module_standard_idx
  on public.module_standards (module_id, standard_id);

create index if not exists standards_code_idx
  on public.standards (code);

create index if not exists assets_module_lesson_idx
  on public.assets (module_id, lesson_id);

-- Billing/subscriptions
create index if not exists subscriptions_parent_idx
  on public.subscriptions (parent_id);

create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions ((metadata ->> 'stripe_subscription_id'))
  where metadata ? 'stripe_subscription_id';
