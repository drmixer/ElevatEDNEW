## ElevatED Production Runbook

### 1. Pre-flight Checklist
- Open `docs/release-checklist.md` for this release and note where Coverage Audits artifacts and gate sign-offs will be attached.
- Confirm Supabase credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are valid for the production project.
- Configure Sentry environment variables (frontend `VITE_SENTRY_*`, backend `SENTRY_*`) in the deployment target.
- Ensure the latest content source files under `data/` and `mappings/` are present and reviewed.
- Verify Supabase log drain or webhook endpoint is reachable (see section 5).
- Confirm at least two admin profiles are present via `/admin/import` (Admin Roster) to avoid lockout; promote/demote as needed.
- Verify billing secrets exist (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price ids) and that bypass/sandbox flags are set intentionally (`BILLING_SANDBOX_MODE`, `BILLING_BYPASS_PARENTS`).

### 2. Database Migration Order
```bash
npm install
npm run db:migrate
```

### 3. Content Seed & Import Sequence
Run the scripts in order, monitoring console output for failures.
```bash
# Base modules and lookup data
npm run seed:skeleton
npm run import:standards

# Lesson content and assessments
npm run seed:lessons
npm run seed:module-assessments
npm run import:module-standards

# Supplemental assets
npm run import:openstax
npm run import:gutenberg
npm run import:federal
```

### 4. QA & Regression Gates
- Coverage audits (Phase 15): Trigger the "Coverage Audits" GitHub Actions workflow (runs Mon/Thu 09:30 UTC) or run `npm run audit:completeness`, `npm run audit:coverage-rollup`, `npm run audit:coverage-gaps`, and `npm run audit:practice` with production Supabase secrets. Download/upload the `coverage-reports` artifact so coverage trends stay visible across releases, and block on any red cells.
- Human + AI coverage QA (Phase 15): Sample at least one fully covered module per subject, one diagnostic per grade/subject with its generated learning paths, and one project unit per subject. Ask Max High to review diagnostics/quizzes (`Critique this diagnostic for bias/coverage/level.` and `Spot weak questions or misaligned rubrics in this quiz.`); keep final judgment human and record defects + fixes.
- `npm test -- --run` (Vitest) — validates importer regression coverage.
- `npm run lint` — confirm lint passes.
- `npm run audit:completeness` — no modules should appear in the "missing" lists.
- `npm run audit:licenses` — CSV output should report zero rows; investigate any lesson/asset issues.
- `RUN_E2E=true E2E_BASE_URL=http://localhost:5173 npm run test:e2e` — Playwright fixtures cover signup, diagnostic preview, lesson playback, and progress logging.
- Spot-check Supabase tables for expected row counts (modules, lessons, assessments, standards, assets) and confirm `module_standards`, `student_progress`, and `practice_events` indexes are present.
- Optional live smoke: set `RUN_E2E_LIVE=true` with test creds (`E2E_PARENT_EMAIL`, `E2E_PARENT_PASSWORD`, `E2E_STUDENT_EMAIL`, `E2E_STUDENT_PASSWORD`) to exercise parent billing/assignments and student AI tutor UI against staging.

### 5. Monitoring & Alerting
- **Sentry (UI/API)**  
  - Frontend: set `VITE_SENTRY_DSN` and optional sampling variables before building.  
  - Backend: set `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, optionally `SENTRY_TRACES_SAMPLE_RATE`.  
  - Validate by triggering a handled test error:
    ```bash
    SENTRY_DSN=... node -e "require('./dist/server/index.js'); throw new Error('Sentry smoke test');"
    ```
- **Supabase Log Alerts**  
  - Create a log drain to Slack/Sentry using the Supabase CLI:
    ```bash
    supabase logs webhook create \
      --project-ref <project-ref> \
      --url https://hooks.slack.com/services/... \
      --levels error warn
    ```
  - Confirm delivery by inducing a controlled warning (e.g., failed import) and verifying the notification arrives.
- **Alerts & health signals**
  - Error spikes trigger `alert:error_spike` messages in Sentry; configure a rule to page on repeated events (thresholds: 5 min window, >=12 errors).
  - Billing webhook failures emit `alert:billing_webhook_failed` events with Stripe `event_id`; set a Sentry or Slack alert to review and replay webhooks in the Stripe dashboard.
  - AI tutor rate-limit and plan blocks emit `[ai]` warnings; keep an eye on surges that might indicate abuse or incorrect entitlements.

### 6. Final Go-Live Verification
- Ensure `npm run build` (frontend) and `npm run api:dev` (API smoke test) complete without errors using production env vars.
- Verify Sentry dashboards receive events after smoke tests.
- Capture audit and test outputs in release notes.
- Flip production traffic once monitoring confirms healthy signals for 15 minutes.

### 7. Incident Handling (condensed)
- **Containment:** Flip `MAINTENANCE_MODE=true` in the edge worker (if available) for major auth/billing breaks; otherwise toggle feature flags or set `ENFORCE_PLAN_LIMITS=false` to unblock AI while debugging.
- **Triage:** Check recent `alert:*` events and import queue logs for failures. Inspect Supabase log drain for PostgREST or RLS errors. Validate Stripe webhook delivery history if billing is impacted.
- **Comms:** Post status in the #ops channel with impact, ETA, and mitigation. Notify affected schools/parents if data rights or billing events are involved.
- **Recovery:** Ship/rollback fixes, rerun the regression gates above, and replay failed webhooks/imports. Close the incident with a short blameless summary and link to any Supabase SQL or data patches applied.

### 8. Staging validation (Phase 10)
- Use synthetic seeds to hit 100+ lessons and 1K+ assets; verify `/catalog`, `/module/:id`, `/lesson/:id`, `/parent` load without slow warnings.
- Ensure monitoring emits no `[modules] ... truncated` warnings; if it does, raise `MODULE_ASSET_LIMIT`/`MODULE_LESSON_LIMIT` or paginate assets.
- Run both fixture and live Playwright suites (see step 4) and capture screenshots/logs for launch notes.
- Confirm alert routes are wired: Sentry rules for `alert:error_spike`, `alert:billing_webhook_failed`, `[ai] rate limit hit`, and Supabase log drains to Slack/Sentry.

### 9. Launch gates (Phase 15)
- Coverage quality: 80%+ of Grades 3–8 Math/ELA coverage_dashboard cells are fully covered (lessons, practice, assessments, and external resources). Confirm with `npm run audit:coverage-rollup` and record counts per grade/subject in release notes; block any launch below the threshold.
- Diagnostics present: every Grade 3–8 Math/ELA grade has a diagnostic assessment seeded (check Supabase `assessments` with metadata.purpose = diagnostic or `data/assessments/diagnostics_phase13.json`). Missing diagnostics are a release blocker.
- Priority explanations: no priority matrix or `coverage_anchor` cells ship without a public lesson. `npm run audit:coverage-gaps` must show zero rows with "no public lesson" for those cells; fill the lesson or stop the launch.
- Artifact retention: attach the latest `coverage-reports` artifact (from the Coverage Audits workflow) to the release ticket to keep a trend of coverage and gaps over time.
