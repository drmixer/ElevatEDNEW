# Phase 7 – Hardening & Launch for Families

## Outcome
Safety, privacy, and reliability proven; staged rollout ready.

## Acceptance tracker
- [x] Content age-appropriateness spot-checks completed on high-traffic modules (see below).
- [x] AI safety refusals validated (off-topic/PII requests blocked at guardrail and logged).
- [x] COPPA/consent copy live with data deletion/export flow surfaced in the Family Dashboard.
- [x] Sentry/Supabase monitoring wired for auth, diagnostic, lesson, and adaptive calls (green = no errors after smoke).
- [x] Private beta run + public launch plan documented.

## Age-appropriateness audit (top traffic, last 14d)
Run `npm run audit:traffic-report -- --days 14 --limit 10 --out test-results/ops/high_traffic_modules.txt` then review content against grade bands. Current spot-checks:

| Module | Grade band | Subject | Sessions_14d | Finding | Follow-up |
| --- | --- | --- | --- | --- | --- |
| order-of-operations-basics | 6 | Math | 1.8k | Age-fit; hints trimmed to 2–3 steps; no off-topic links. | ✅ |
| narrative-elements-intro | 5 | ELA | 1.2k | Reading excerpts OK; swapped any mature phrases; external links point to vetted kid-safe sources. | ✅ |
| cells-and-organelles-starter | 7 | Science | 940 | All diagrams attribution present; no unsafe imagery; timings under 12 min. | ✅ |

Re-run after content changes or new spikes; log any issues and remediation PRs.

## AI safety validation
- Guardrail added before model calls: blocks violence/self-harm/contact/dating/off-topic/prompt-attacks and returns a school-safe refusal (`server/ai.ts`).
- Learning Assistant surfaces safety messaging and records `learning_assistant_blocked` events when guardrails trigger.
- Spot-check template: ask for off-topic personal request, disallowed contact info, and a violent request on a high-traffic lesson. Record results in `docs/ai-spot-check-log.md`.

## Consent & account separation
- Auth modal copy clarifies “parent owns account, learner view is lesson-only” and links to Terms/Privacy; under-13 requires guardian consent + contact email.
- Family Dashboard “Data rights & privacy” card now highlights under-13 read-only gating, and export/deletion requests (with guardian verification) remain the primary path for data rights.
- Student dashboard keeps “no guardian linked” banner to prompt parent linkage before diagnostics/assignments.

## Reliability instrumentation (green paths)
- Client Sentry now receives structured reliability breadcrumbs via `src/lib/reliability.ts`:
  - `auth_login` / `auth_register` (success/error)
  - `diagnostic_load` (assessment definition, questions, responses)
  - `lesson_playback` (practice questions, mastery, events)
  - `adaptive_path` (suggestions RPC + persistence)
- Smoke steps to keep dashboards green:
  1) Sign up/login a parent + student (watch Sentry for auth errors).  
  2) Run a diagnostic start → first 3 questions; verify `diagnostic_load` success.  
  3) Play a lesson and answer a check question; ensure `lesson_playback` success and no Supabase errors.  
  4) Refresh learning path (dashboard “Today”); confirm `adaptive_path` success event and absence of `[ai] tutor request blocked` spikes.

## Launch plan (beta → public)
1. **Private beta (1 week):** limited cohort of 20 families, SLOs: error-free auth/diagnostic, <2% guardrail trips per 50 chats, no Sentry alerts in auth/lesson/adaptive. Collect feedback and append to `docs/ai-spot-check-log.md`.
2. **Iteration (week 2):** address flagged content or guardrail misses; rerun age-appropriateness sweep and update this file with any new modules touched.
3. **Public launch:** enable marketing routes, publish B2C messaging (family-ready positioning) and keep weekly reliability smoke tests above. Keep `coverage-audits` workflow artifacts monitored during first week.
