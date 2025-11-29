# Performance & Query Hardening (Phase 10)

Use these notes when tuning Supabase and API hotspots before launch.

## High-traffic endpoints
- **Dashboard rollups** (`student_progress`, `student_assignments`, `practice_events`): add/verify indexes  
  - `student_progress (student_id, lesson_id)`  
  - `student_progress (student_id, last_activity_at desc)`  
  - `student_assignments (student_id, status, due_at)`  
  - `practice_events (session_id, event_order)`  
- **Catalog/module pages**  
  - `modules (visibility, subject, grade_band)`  
  - `module_standards (module_id, standard_id)` with supporting index on `standards(code)`  
  - `assets (module_id, lesson_id)` for fast joins on module detail.
- **Billing/subscriptions**  
  - `subscriptions (parent_id)` and `subscriptions (metadata->>stripe_subscription_id)` for webhook lookups.

## Pagination and payload limits
- API now caps module lessons/assets per detail response via `MODULE_LESSON_LIMIT` and `MODULE_ASSET_LIMIT` (env overrides). If a module hits the limit a warning is sent to monitoring. Increase limits only after validating page performance.
- Prefer `range()` pagination on Supabase selects; keep `pageSize` <= 50 on catalog queries.
- For parent dashboards, fetch children and assignments in paged batches when adding more than ~50 learners per family to avoid UI thrash.

## Monitoring hooks
- Slow API calls are sampled and emitted as `api_timing` with route/status/duration; set `API_SLOW_THRESHOLD_MS` if needed.
- Truncation warnings (`[modules] lesson list truncated`, `[modules] module assets truncated`) indicate content heavy pages; consider lazy-loading assets.
- Error spikes and billing webhook failures emit `alert:*` messages; tie these to Sentry/Slack rules for visibility.

## Staging validation checklist
- Seed realistic volumes (100+ lessons, 1K+ assets) then load: `/catalog`, `/module/:id`, `/lesson/:id`, `/parent` dashboards. Confirm sub-400ms median responses and no Sentry truncation warnings.
- Run Playwright smoke (`RUN_E2E=true npm run test:e2e`) for fixtures and live flows (`RUN_E2E_LIVE=true` with test accounts) to catch regressions.
- Watch Supabase query plans for `module_standards`, `student_progress`, and `practice_events` to confirm index usage; adjust as needed before prod cutover.
