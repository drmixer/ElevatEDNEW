# Onboarding Fix Plan (Avatars + Placement/Diagnostic Assessment)

## What you reported (staging/Netlify)

1. **Avatar chooser shows text only** (names/descriptions), no visual preview.
2. **“General / balanced” onboarding assessment skewed to Computer Science** (elective) instead of core subjects (Math/ELA/Science).
3. **Assessment questions/options are “not real”**: prompts missing/empty, and multiple-choice options look like generic rubrics (e.g., “Correct (grade level)”, “Mostly correct”, etc.), sometimes duplicated.

This doc proposes a phased approach that fixes UX first, then correctness (assessment selection), then question content quality and seeding.

---

## Quick repo findings (likely root causes)

### A) Avatar chooser has no rendering for `image_url` or icon

- `src/components/Student/OnboardingFlow.tsx` builds `avatars` state with only `{ id, name, metadata }` and renders only text.
- The API returns `image_url` and `metadata` (and avatar metadata already supports palette/icon patterns), but onboarding doesn’t display them.

**Impact:** even if avatars are configured, onboarding feels “broken” because there’s no preview.

### B) Placement assessment selection is overly permissive and can pick a module “baseline” assessment (including electives)

- `server/learningPaths.ts` → `findPlacementAssessmentId()`:
  - Loads up to 200 assessments and treats **`baseline`** / `diagnostic` / `placement` as acceptable “placement candidates”.
  - Picks the **first** candidate without deterministic ordering or a “core subjects only” preference.
- Module baseline assessments are seeded with `metadata.purpose = 'baseline'` (see `scripts/seed_module_assessments.ts`) and include elective modules like CS.

**Impact:** onboarding placement can accidentally use a CS baseline quiz (or any other module baseline), which contradicts the expected “core diagnostic”.

### C) The “rubric-like” answer options match placeholder content produced by gap-filler scripts

- `scripts/fill_gaps_from_dashboard.ts` inserts placeholder `question_options` like:
  - “Correct answer (on-grade).”
  - “Common misconception.”
  - “Partially correct idea.”
  - “Off-topic choice.”
- If onboarding is served a baseline assessment built from these placeholders, the UI will show “nonsense” options that aren’t real answers.

**Impact:** even when the UI is functioning, the assessment content feels fake/unusable.

### D) (Secondary) Diagnostic selection in `assessmentService` can also drift

If the user is in `src/components/Student/AssessmentFlow.tsx` (separate from onboarding placement):
- `src/services/assessmentService.ts` selects from the last 5 assessments and has broad heuristics for “diagnostic-like”.
- Its grade matching compares `metadata.grade_band` to `student.grade.toString()` (e.g., `"7"`), which likely won’t match `"6-8"`.

**Impact:** the “Diagnostic Assessment” flow can also select an unintended assessment if staging has recently seeded electives/baselines.

---

## Goals / acceptance criteria

### Avatar selection
- Avatar chooser shows a clear visual preview (image if available, otherwise icon + color palette).
- Selected state is obvious and accessible.

### Placement/diagnostic correctness
- “Balanced / general” onboarding placement uses **core subjects only** (Math, ELA/English, Science; optionally Social Studies if desired).
- Electives (CS, Arts, etc.) are included only when explicitly chosen as a focus.

### Question integrity
- Every displayed question has a non-empty prompt.
- Multiple-choice questions have 2–6 distinct, meaningful options (not rubric placeholders).
- If content is missing/invalid, the API fails safely with a diagnostic error (and the UI shows a friendly message + retry).

---

## Phased plan

### Phase 0 — Baseline staging sanity (same day)

**Why:** onboarding debugging is noisy if staging DB/API are partially migrated or serving unexpected assessment rows.

Tasks:
- Confirm Netlify `/api/v1/*` is hitting the API function and not SPA HTML.
- Apply missing Supabase migrations to staging (at least: `supabase/migrations/041_plan_opt_outs.sql` and any assignment-related migrations).
- Run a quick DB audit query (manually in Supabase SQL editor):
  - List all `assessments` with `metadata->>'purpose'` in (`baseline`,`diagnostic`,`placement`)
  - Include `module_id`, `subject_id`, `created_at`, and `metadata.grade_band` / `metadata.subject_key`
  - Identify which assessment ID onboarding is actually using.

Exit criteria:
- No API calls return HTML.
- Staging errors unrelated to onboarding are reduced (especially missing tables).

---

### Phase 1 — Avatar preview UX fix (small + safe)

Tasks:
- Update `src/components/Student/OnboardingFlow.tsx` to render avatar preview:
  - Prefer `avatar.image_url` when present (render `<img>`).
  - Otherwise render `metadata.icon` (emoji) inside a circle using `metadata.palette`.
  - Keep name/description below; show selected ring/border.
- Update `avatars` state type in onboarding to keep `image_url` and the `metadata.icon/palette` fields.

QA:
- Verify on staging: avatar grid shows visuals, not just text.

Exit criteria:
- Avatar selection looks correct even if `image_url` is null (icon fallback).

---

### Phase 2 — Fix assessment selection for placement (correctness over UX)

Tasks (backend):
- Tighten `server/learningPaths.ts` placement selection:
  - `findPlacementAssessmentId()` should **not** accept `baseline` module assessments.
  - Prefer a dedicated assessment marked explicitly, e.g. `metadata.purpose = 'placement'`.
  - Exclude module-linked assessments by requiring `module_id IS NULL` (requires selecting `module_id` in the query).
  - Add deterministic ordering (e.g., newest `created_at`, or a stable `metadata.slug`).
  - Add “core subjects only” gating for the default/balanced onboarding:
    - If the assessment is mixed-subject, it can have `subject_id = NULL` + `metadata.subjects = ['math','english','science']`.
    - Otherwise, choose from a known set of diagnostic assessments.

Tasks (frontend):
- Surface better error context when `/student/assessment/start` returns invalid/empty questions (show “we’re fixing the assessment content” + retry).

QA:
- In staging, onboarding placement starts on the intended assessment ID and shows core-subject strands.

Exit criteria:
- Placement no longer drifts into elective module baselines.

---

### Phase 3 — Filter/validate question payloads (prevent “fake” questions)

Tasks:
- Add server-side validation in `loadPlacementQuestions()` (and optionally the diagnostic loader) to reject or skip questions that are not currently supported:
  - Require `prompt.trim().length > 0`.
  - For `question_type`:
    - If `multiple_choice` / `true_false`: require `options.length >= 2` and at least 2 distinct `option.content` values.
    - If `short_answer` / `essay`: either implement a short-answer UI or do not include them in placement until supported.
  - Detect placeholder option patterns (“Correct answer (on-grade).”, “Common misconception.”, etc.) and treat them as invalid for onboarding placement.

Optional but recommended:
- Add a lightweight “assessment content audit” script that prints invalid questions (by assessment id) for quick cleanup.

Exit criteria:
- Even if staging contains placeholder questions elsewhere, onboarding never surfaces them.

---

### Phase 4 — Seed/curate a real placement diagnostic (data + product)

Goal: ensure the onboarding assessment is genuinely useful and spans core subjects.

Options (choose one):

**Option A: Single mixed-subject placement assessment**
- Create a new seed script (or extend `scripts/seed_diagnostic_assessments.ts`) to insert:
  - `assessments` row with `metadata.purpose='placement'`, `grade_band='6-8'`, `subjects=['math','english','science']`.
  - Multiple `assessment_sections` (Math/ELA/Science).
  - Hand-curated question sets (can reuse `data/assessments/diagnostics_phase13.json` for Math/ELA/Science).

**Option B: Multi-step placement (one section per subject)**
- Onboarding placement becomes a short sequence:
  - 4–6 questions Math → 4–6 ELA → 4–6 Science
  - Produces separate strand estimates and then builds the path.

Exit criteria:
- Placement questions are clearly “real”, varied, and map to meaningful standards/strands.

---

### Phase 5 — Regression protection (tests + monitoring)

Tests:
- Add mocked E2E covering:
  - Avatar grid renders a visual preview (img or icon).
  - Placement start returns questions with non-empty prompt and non-placeholder options.
  - “Balanced” mode does not select elective-only strands.

Monitoring:
- Emit a server event when a placement assessment is selected:
  - `assessment_id`, `metadata.purpose`, `module_id`, `grade_band`, and counts of invalid/skipped questions.
- Add an alert threshold if placement returns 0 valid questions.

Exit criteria:
- Future data seeds/migrations cannot silently break onboarding without being noticed.

---

## Suggested execution order

1. Phase 1 (avatar preview) — quick win, improves perceived quality immediately.
2. Phase 2 (placement selection) — fixes the core “CS drift” problem.
3. Phase 3 (validation) — prevents bad data from surfacing.
4. Phase 4 (curated placement) — makes onboarding genuinely useful.
5. Phase 5 (tests/monitoring) — keeps it stable.

---

## Notes / open questions to resolve early

- Should “core” include Social Studies in the initial placement, or keep it to Math/ELA/Science?
- Do we want placement to be “mixed subject in one assessment” or “3 short assessments”?
- Are avatar images intended to be hosted (e.g., Supabase Storage) or just emoji/icon based for now?

