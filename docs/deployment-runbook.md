## ElevatED Production Runbook

### 1. Pre-flight Checklist
- Confirm Supabase credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are valid for the production project.
- Configure Sentry environment variables (frontend `VITE_SENTRY_*`, backend `SENTRY_*`) in the deployment target.
- Ensure the latest content source files under `data/` and `mappings/` are present and reviewed.
- Verify Supabase log drain or webhook endpoint is reachable (see section 5).
- Confirm at least two admin profiles are present via `/admin/import` (Admin Roster) to avoid lockout; promote/demote as needed.

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
- `npm test -- --run` (Vitest) — validates importer regression coverage.
- `npm run lint` — confirm lint passes.
- `npm run audit:completeness` — no modules should appear in the "missing" lists.
- `npm run audit:licenses` — CSV output should report zero rows; investigate any lesson/asset issues.
- Spot-check Supabase tables for expected row counts (modules, lessons, assessments, standards, assets).

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

### 6. Final Go-Live Verification
- Ensure `npm run build` (frontend) and `npm run api:dev` (API smoke test) complete without errors using production env vars.
- Verify Sentry dashboards receive events after smoke tests.
- Capture audit and test outputs in release notes.
- Flip production traffic once monitoring confirms healthy signals for 15 minutes.
