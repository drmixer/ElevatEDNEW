# Beta Steps – Student Pilot Readiness (ElevatED)

Goal: reach a “student beta” where real learners (with parents) can use ElevatED for a limited scope (grades/subjects) with safe, coherent experiences and enough content depth to be meaningful.

This is a pre-launch track: lighter than full launch gates in `docs/prelaunch-readiness-checklist.md`, but strong enough for real families.

---

## 0. Define the beta scope

Decide what’s in and out for this first student-facing beta.

Decisions

- [ ] Pick in-scope grades and subjects for beta  
      (default from `docs/family-ready.md`: Grades 3–8 Math and ELA, Grades 6–8 Science; you can narrow if needed).
- [ ] Decide whether Social Studies is in or out for this beta  
      (default: out, per `docs/content-plan-phase1.md`).
- [ ] Confirm that “family-ready” criteria in `docs/family-ready.md` are acceptable for beta (diagnostic → path → first lesson, parent visibility).

Artifacts

- [ ] Add a short “Beta Scope” note to the top of `docs/prelaunch-readiness-checklist.md` or a new `docs/beta-scope.md`:
  - [ ] Subjects and grades in scope.
  - [ ] Approximate number of pilot families.
  - [ ] Duration of beta.
  - [ ] Any known exclusions (for example, “no Science projects yet”).

---

## 1. Choose anchor standards and modules

We don’t need full coverage yet; we need excellent coverage for a small, high-value slice.

Anchor selection

- [ ] Open `data/curriculum/coverage_matrix_phase1.csv`.
- [ ] For each in-scope subject and grade, pick 2–4 anchor standards:
  - [ ] Use the Priority column (start with High).
  - [ ] Prefer standards with clear, motivating contexts (fractions, ratios, argument writing, and similar topics).
- [ ] Mark them clearly (for example, add `beta_anchor = true` or a note in the “notes” column).

Output

- [ ] Create a short table in this file (or a separate section) listing:
  - [ ] Subject.
  - [ ] Grade.
  - [ ] Standard code.
  - [ ] Module slug (if known).
  - [ ] Why it’s an anchor (one sentence).

### Suggested beta anchors (pre-filled)

These reflect the strongest, high-leverage standards in `coverage_matrix_phase1.csv` for Grades 3–8 Math and ELA, and Grades 6–8 Science. Adjust as needed and mark `beta_anchor = true` in the CSV.

| Subject | Grade | Standard | Focus/Notes | Status (Lesson / Practice / Assessment / Asset) |
| --- | --- | --- | --- | --- |
| Math | 3 | 3.OA.3 | Multiplication and division word problems within 100 | yes / yes (56/20) / assessment seeded / yes |
| Math | 4 | 4.NF.B.3 | Add/subtract fractions with like denominators | yes / yes (38/20) / assessment seeded / yes |
| Math | 5 | 5.NF.B.4 | Multiply fractions by fractions and whole numbers | yes / yes (38/20) / assessment seeded / yes |
| Math | 6 | 6.RP.A.3 | Ratio and rate reasoning in real contexts | yes / yes (39/20) / assessment seeded / yes |
| Math | 6 | 6.EE.B.7 | Solve one-step equations and inequalities | yes / yes (≥20) / assessment seeded / yes |
| Math | 7 | 7.RP.A.2 | Proportional relationships and slope connections | yes / yes (37/20) / assessment seeded / yes |
| Math | 7 | 7.EE.B.4a | Two-step equations and inequalities in context | yes / yes (≥20) / assessment seeded / yes |
| Math | 8 | 8.EE.C.8 | Systems of linear equations (solve and interpret) | yes / yes (≥20) / assessment seeded / yes |
| Math | 8 | 8.G.B.6 | Pythagorean Theorem and applications | yes / yes (94/20) / assessment seeded / yes |
| ELA | 3 | RL.3.1 | Ask/answer text-dependent questions | yes / yes (≈58/20) / assessment seeded / yes |
| ELA | 3 | W.3.1 | Opinion writing with reasons | yes / yes (≥20) / assessment seeded / yes |
| ELA | 4 | RI.4.5 | Identify text structures in informational texts | yes / yes (38/20) / assessment seeded / yes |
| ELA | 5 | RL.5.2 | Determine theme and summarize | yes / yes (57/20) / assessment seeded / yes |
| ELA | 6 | RL.6.1 | Cite textual evidence precisely | yes / yes (57/20) / assessment seeded / yes |
| ELA | 7 | RI.7.8 | Evaluate arguments and evidence quality | yes / yes (38/20) / assessment seeded / yes |
| ELA | 8 | RI.8.8 | Delineate and evaluate arguments and claims | yes / yes (38/20) / assessment seeded / yes |
| Science | 6–8 | MS-ESS2-2 | Earth surface processes and change | yes / strong (≈305/20) / assessment seeded / yes |
| Science | 6–8 | MS-LS2-3 | Cycling of matter and energy in ecosystems | yes / strong (114/20) / assessment seeded / yes |
| Science | 6–8 | MS-PS1-2 | Evidence of chemical reactions via properties | yes / strong (114/20) / assessment seeded / yes |
| Science | 6–8 | MS-PS2-2 | Forces, motion, net force relationships | yes / strong (114/20) / assessment seeded / yes |

---

## 2. Baseline coverage snapshot

Use the existing tools to see where those anchor cells stand. Repeat this snapshot regularly (for example, weekly) while you are filling anchors.

Run coverage commands (against your beta Supabase project)

- [ ] `npm run audit:completeness`
- [ ] `npm run audit:coverage-rollup`
- [ ] `npm run audit:coverage-gaps`
- [ ] `npm run audit:practice`

Environment hints (beta Supabase ref: `ciyidohmnkwwwpvfhbjj`)

- [ ] Set `SUPABASE_URL=https://ciyidohmnkwwwpvfhbjj.supabase.co` and the corresponding service keys before running audits.
- [ ] If using Supabase CLI locally, target that project ref when seeding or inspecting coverage views.

Anchor-focused view

- [ ] From the `coverage-gaps` output, filter down to the rows matching your `beta_anchor` standards.
- [ ] For each anchor cell, record what’s missing:
  - [ ] Explanation lesson?
  - [ ] Practice items to reach the baseline count?
  - [ ] Unit or quiz or diagnostic assessment?
  - [ ] External or enrichment asset?

Artifact

- [ ] Add or update a “Beta Anchor Status” table in this file:
  - [ ] Columns: standard, module, has lesson, has at least N practice items, has assessment, has asset, notes.

Status notes (2025-02-05)

- Beta Supabase (`ciyidohmnkwwwpvfhbjj`) now shows 0 coverage gaps for Grades 3–8 Math/ELA/Science after running `npx tsx scripts/fill_gaps_from_dashboard.ts --grades 3,4,5,6,7,8` to auto-seed baseline unit assessments and externals for non-anchor modules.
- `npm run audit:coverage-gaps` currently returns “No coverage gaps detected for current baseline” for those grades/subjects.
- Completeness spot-check scoped to Grades 3–8 Math/ELA/Science now shows: missing lessons 0, missing published lessons 0, missing assets 0, missing assessments 0 (`npx tsx` inline check with grade/subject filters). Global `audit:completeness` still reports missing lessons in other subjects/grades (K–2, 9–12, Social Studies/electives).

---

## 3. Fill each anchor cell (content loop)

For each anchor standard or module, follow the same fixed sequence until the baseline is met.

### 3.1 Explanation lesson

- [ ] Author or adapt at least one kid-friendly, on-grade explanation lesson:
  - [ ] Clear title and summary.
  - [ ] On-grade language; no heavy jargon.
  - [ ] Explicit alignment to the anchor standard.
- [ ] Ensure the import satisfies `docs/content-model-phase3.md`:
  - [ ] `lessons.visibility = 'public'`.
  - [ ] `metadata.standards` contains the correct framework and code.
  - [ ] Attribution and license are correct.

### 3.2 Practice set (depth)

Aim to meet or beat the practice baseline from `coverage_matrix_phase1.csv` (often 20–30 items or more).

- [ ] Collect or author enough practice items:
  - [ ] Mix item types where possible (multiple choice, open response, data or graph items).
  - [ ] Include both procedural and application items.
- [ ] Tag items correctly:
  - [ ] Link to the correct module or standard (for example, via `metadata.module_slug` and/or `metadata.standards`).
  - [ ] Ensure they are visible to the learner flows you expect (practice sessions, lesson checkpoints, and similar flows).

### 3.3 Assessment (quiz or diagnostic)

- [ ] Create a short assessment tied to the anchor module:
  - [ ] `assessments.module_id` or `metadata.module_slug` set.
  - [ ] `metadata.assessment_type` or `purpose` set appropriately (for example, `unit_assessment`, `quiz`, `diagnostic`).
- [ ] Ensure it is reachable:
  - [ ] From the module or lesson detail page.
  - [ ] Or as part of the early diagnostic → path → first lesson flow for that subject and grade.

### 3.4 External or enrichment asset

- [ ] Pick at least one high-quality external resource (OER or safe link):
  - [ ] Aligns with the same anchor standard.
  - [ ] Age-appropriate and on-level.
- [ ] Add as an `assets` row:
  - [ ] `metadata.storage_mode = 'link'` or `'embed'`.
  - [ ] Proper license metadata (per `docs/content-license-policy.md`).
  - [ ] Live link verified.

### 3.5 Mark the anchor cell done and re-run audits

- [ ] Run `npm run audit:coverage-gaps` again and confirm the anchor cell disappears from the “missing” list.
- [ ] Update `coverage_matrix_phase1.csv`:
  - [ ] Mark the practice, assessment, and enrichment goals as met.
  - [ ] Set `last_verified_at` once a human has checked it.

Repeat this loop until each in-scope grade and subject has at least 2–4 anchor standards fully covered.

---

## 4. Safety, tutor, and reporting checks

Most infrastructure is in place (for example, `server/ai.ts`, `supabase/migrations/027_tutor_answer_reports.sql`, `supabase/migrations/028_tutor_answer_reports_review.sql`, `src/components/Student/LearningAssistant.tsx`), but verify it works for beta.

- [ ] Confirm tutor safety behavior:
  - [ ] Unsafe prompt examples refuse with the guardrail message (PII, “meet up”, self-harm, and similar patterns).
  - [ ] Under-13 scenarios behave as expected (age-aware responses).
- [ ] Confirm “Report this answer” works end to end:
  - [ ] Student can open the report dialog and submit reasons and optional notes.
  - [ ] `tutor_answer_reports` rows appear in Supabase with metadata.
  - [ ] Admin review path works via backend (`server/tutorReports.ts`) or admin UI if present.
- [ ] Add or verify a visible “Safety and Privacy” section:
  - [ ] In the tutor panel.
  - [ ] In parent account or settings.
  - [ ] Content aligned with `docs/compliance.md` and `docs/family-ready.md`.

---

## 5. Parent experience and controls

- [ ] Verify parent dashboard:
  - [ ] Shows child status cards (on-track, at-risk, off-track) using the logic from `docs/family-ready.md`.
  - [ ] Explains recommended path and current focus in plain language.
- [ ] Verify AI controls per learner:
  - [ ] “Allow AI tutor chats” toggle.
  - [ ] “Limit open chat to lesson context only” toggle.
  - [ ] Any soft daily chat limits (if implemented).
  - [ ] Server-side enforcement works (tutor requests respect flags).
- [ ] Verify any weekly digest email or summary:
  - [ ] Uses the same status language as the dashboard.
  - [ ] Avoids confusing or conflicting messages.

---

## 6. Operational readiness for beta

You do not need full launch ops, but you do need basic visibility and runbooks.

- [ ] Configure monitoring for the beta environment:
  - [ ] Frontend Sentry (`VITE_SENTRY_*`) via `src/monitoring.ts`.
  - [ ] Backend Sentry (`SENTRY_*`) via `server/monitoring.ts`.
  - [ ] Supabase log drains or alerts pointing to Slack or Sentry.
- [ ] Expose a simple internal ops view:
  - [ ] Route or admin page that uses `server/opsMetrics.ts` (`getOpsSnapshot()`) to show:
    - [ ] Tutor success and error counts.
    - [ ] Safety-block reasons.
    - [ ] API failure routes.
- [ ] Capture minimal runbooks (link or update `docs/deployment-runbook.md`):
  - [ ] AI provider outage or degradation (how to fail gracefully, fallback models, messaging to students).
  - [ ] Supabase outage or partial outage (what remains read-only, what to hide or disable).
  - [ ] Stripe or billing webhook failures (how to reconcile and what parents see).

---

## 7. Staging environment and performance check

Use `docs/deployment-runbook.md` and `docs/performance-phase10.md` as references.

- [ ] Run Supabase migrations up through `029_phase10_performance_indexes.sql` using `npm run db:migrate`.
- [ ] Seed content and imports (at least the minimum to exercise anchor modules):
  - [ ] `npm install` (if not already done).
  - [ ] `npm run seed:skeleton`.
  - [ ] `npm run import:standards`.
- [ ] Add lesson and assessment content needed for anchors:
  - [ ] `npm run seed:lessons`.
  - [ ] `npm run seed:module-assessments`.
  - [ ] Any additional imports used for these anchors (`npm run import:openstax`, `npm run import:gutenberg`, `npm run import:federal`, and similar commands).
- [ ] Performance sanity checks:
  - [ ] Seed enough data to approximate beta usage (for example, 100 or more lessons, around 1,000 assets).
  - [ ] Hit `/catalog`, `/module/:id`, `/lesson/:id`, `/parent` on staging.
  - [ ] Confirm median responses are reasonable (for example, 400 ms or less) and no `[modules] ... truncated` warnings.
  - [ ] Verify new Phase 10 indexes are used for `student_progress`, `student_assignments`, `practice_events`, and `module_standards`.

---

## 8. QA and beta launch checklist

### 8.1 Automated checks

- [ ] `npm test` (Vitest) passes.
- [ ] `npm run lint` passes.
- [ ] E2E (Playwright) against staging:
  - [ ] `RUN_E2E=true E2E_BASE_URL=<staging-url> npm run test:e2e`.
  - [ ] Fix any red tests or brittle selectors in `tests/e2e/*.spec.ts`.

### 8.2 Manual smoke

For each in-scope subject and grade where anchors are done:

- [ ] Create a test parent account and student profile.
- [ ] Run: signup or login → consent → diagnostic → recommended path → first lesson.
- [ ] Confirm:
  - [ ] Diagnostic finishes in the expected time.
  - [ ] Recommended path shows at least your anchor modules.
  - [ ] Lesson loads correctly and saves progress.
  - [ ] Tutor opens, answers safe questions, and handles unsafe prompts properly.
  - [ ] “Report this answer” works at least once.
- [ ] For parents:
  - [ ] Dashboard reflects the student’s activity and status.
  - [ ] Controls and toggles for the AI tutor behave as expected.

### 8.3 Beta go or no-go

- [ ] For each in-scope subject and grade:
  - [ ] At least 2–4 anchor standards fully meet the baseline:
    - [ ] Public explanation lesson or lessons.
    - [ ] Practice meets baseline count and has some variety.
    - [ ] Assessment exists and is reachable.
    - [ ] External or enrichment asset exists and is safe.
- [ ] Monitoring and basic ops runbooks are in place.
- [ ] Product, Safety, and Engineering each give a simple “beta go” sign-off (can be a line in this file or your tracking ticket).

Once these items are checked for the beta scope, you are ready to invite a limited set of students and families into the beta and focus on learning from real usage.
