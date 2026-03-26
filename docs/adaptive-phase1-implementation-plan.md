# Adaptive Foundation Phase 1 Implementation Plan

Purpose: turn Phase 1 from [adaptive-foundation-plan.md](/Users/drmixer/code/ElevatEDNEW/docs/adaptive-foundation-plan.md) into a repo-ready implementation plan for this codebase.

Status:
- `Proposed`

Scope:
- Math
- ELA
- one student at home first

Non-goals for this phase:
- no AI-led placement decisions
- no all-subject rollout
- no continuous live re-leveling from every event yet
- no investor-style adaptivity claims

---

## 1. Current Repo Constraints

The repo already has useful placement and path infrastructure, but Phase 1 is not implementation-ready without narrowing and correcting a few behaviors.

Current strengths:
- onboarding already calls server-backed placement start/save/submit
- placement attempts and responses already persist
- `student_paths` and `student_path_entries` already exist
- canonical sequences already exist in `learning_sequences`
- the dashboard already knows how to show a path and simple rationale

Current blockers:
- onboarding collects `gradeBand`, not age
- placement start/submit are effectively single-subject at a time with no first-class per-subject learner state
- `buildStudentPath()` in [server/learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/server/learningPaths.ts) builds by `grade_band` only and does not thread `subject` through canonical path selection
- `getStudentPath()` and `useStudentPath()` assume one current path instead of separate Math and ELA paths
- `student_profiles.learning_path` is still acting like a broad legacy summary, not a trustworthy per-subject source of truth

Phase 1 should fix the minimum needed to make initial subject placement correct and explainable.

---

## 2. Recommended Phase 1 Product Shape

For this repo, Phase 1 should mean:

1. parent or student enters age and optional current grade
2. system computes an explainable expected starting level prior
3. student completes a short Math diagnostic
4. student completes a short ELA diagnostic
5. system stores separate subject placement results
6. system generates separate initial Math and ELA paths
7. dashboard shows both subjects, their current working levels, and the first recommended module/lesson for each

This phase should be deterministic:
- age and current grade only create the prior
- diagnostic results decide the working level
- path selection is a canonical sequence lookup filtered by subject and working level

---

## 3. Data Model Changes

### 3.1 Student profile additions

Add to `student_profiles`:
- `age_years smallint`
- keep `grade_level` as the parent-reported or student-reported current grade

Why:
- the repo already has `grade_level`; it should remain the reported school grade
- Phase 1 needs age captured separately so the expected-level prior is explainable

### 3.2 New `student_subject_state` table

Add a new table instead of overloading `student_profiles.learning_path`.

Suggested shape:

- `id bigserial primary key`
- `student_id uuid not null references public.student_profiles (id) on delete cascade`
- `subject text not null`
- `expected_level int not null`
- `working_level int`
- `level_confidence numeric(4,3) not null default 0`
- `placement_status text not null default 'not_started'`
- `diagnostic_assessment_id bigint references public.assessments (id) on delete set null`
- `diagnostic_attempt_id bigint references public.student_assessment_attempts (id) on delete set null`
- `diagnostic_completed_at timestamptz`
- `strand_scores jsonb not null default '{}'::jsonb`
- `weak_standard_codes text[] not null default '{}'::text[]`
- `recommended_module_slugs text[] not null default '{}'::text[]`
- `last_path_id bigint references public.student_paths (id) on delete set null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- unique constraint on `(student_id, subject)`

Purpose:
- one row per student per subject
- Phase 1 source of truth for placement outcome
- base for Phase 2 subject state without redesigning again

### 3.3 `student_paths` subject column

Add to `student_paths`:
- `subject text`

Recommended rule:
- one active path per `student_id + subject`

Why:
- the current API assumes one latest path overall
- Phase 1 needs separate Math and ELA paths without collapsing them into one generic queue

### 3.4 Assessment metadata conventions

Do not add new assessment tables yet. Reuse existing `assessments`, `assessment_sections`, `assessment_questions`, and `question_bank.metadata`, but make placement metadata stricter.

Required metadata for placement assessments:
- `purpose: "placement"`
- `subject_key: "math" | "ela"`
- `placement_level: <int>`
- `placement_window: { min_level, max_level }`
- `phase: "subject_placement_v1"`

Required question metadata for placement items:
- `strand`
- `standards`
- `placement_level`

This is enough for deterministic scoring without a new item model.

### 3.5 Legacy fields that should stay for now

Keep for Phase 1:
- `student_profiles.learning_path`
- `student_profiles.assessment_completed`
- `student_path_entries`

But treat them as compatibility surfaces, not the new source of truth.

---

## 4. Deterministic Placement Logic

### 4.1 Expected level prior

Use age plus optional current grade to create an expected subject starting level.

For the home-use Math/ELA MVP:
- supported working levels: `3` through `8`
- `age_prior_level = clamp(age_years - 5, 3, 8)`
- if `grade_level` exists:
  - `expected_level = clamp(round((age_prior_level + grade_level) / 2), 3, 8)`
- else:
  - `expected_level = age_prior_level`

Examples:
- age `8`, no grade => expected level `3`
- age `10`, grade `5` => expected level `5`
- age `13`, grade `6` => expected level `7` prior, then diagnostic can pull it back down

This should be recorded in `student_subject_state.expected_level`.

### 4.2 Diagnostic launch window

For each subject:
- start from `expected_level`
- load a placement assessment targeted to that subject and level window
- preferred question mix per subject:
  - 2 questions at `expected_level - 1`
  - 4 questions at `expected_level`
  - 2 questions at `expected_level + 1`

If content is not rich enough yet:
- allow a single subject placement assessment per level
- still require every question to carry `placement_level`, `strand`, and `standards`

### 4.3 Subject-level scoring

Use deterministic scoring only.

For each subject:
- compute per-level accuracy from question metadata `placement_level`
- compute per-strand accuracy from `strand`
- compute weighted overall subject score using existing question weight

Recommended level estimate:
- choose the highest `placement_level` where:
  - at least 2 items were answered at that level
  - accuracy at that level is `>= 70%`
- if no level meets that rule:
  - choose the lowest tested level with `>= 50%`
- if the student misses heavily across the tested window:
  - place at the bottom of the tested window

Confidence:
- `high` / `0.85` if:
  - chosen level has at least 3 answered items and `>= 80%`, and
  - next higher tested level is `< 60%` or not passed
- `medium` / `0.65` if:
  - chosen level has at least 2 answered items and `>= 70%`
- `low` / `0.45` if:
  - sparse evidence, inconsistent results, or only one level was meaningfully tested

Weak area logic:
- any strand below `60%` goes into `weak_standard_codes` or `metadata.weak_strands`

Explainability rule:
- every placement result should be reducible to:
  - expected level from age/grade
  - tested levels
  - chosen level
  - weakest strands

### 4.4 What not to do in Phase 1

Do not:
- infer working level from AI summaries
- use tutor chat as grading evidence
- auto-jump multiple levels after a single diagnostic
- claim “continuous adaptation” before Phase 3

---

## 5. Path Generation Changes

### 5.1 Build paths from subject state, not broad grade band

Phase 1 initial path generation should use:
- `student_subject_state.subject`
- `student_subject_state.working_level`
- `student_subject_state.recommended_module_slugs`

Not:
- only `student_profiles.grade_band`
- only legacy `student_profiles.learning_path`

### 5.2 Canonical sequence lookup must become subject-aware

Current issue:
- [server/learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/server/learningPaths.ts) `fetchCanonicalSequence()` queries `learning_sequences` by `grade_band` only

Phase 1 change:
- require `subject`
- query `learning_sequences` by both `grade_band` and `subject`
- if no exact level match exists:
  - fallback within the same subject only
  - first nearest adjacent level
  - only then broader module fallback

### 5.3 Separate initial Math and ELA paths

Recommended behavior:
- create one active `student_paths` row for Math
- create one active `student_paths` row for ELA
- seed `student_path_entries` from the canonical sequence for each subject
- keep initial path short:
  - 3 modules per subject
  - first launch lesson or first module entry for each

### 5.4 Legacy compatibility

For Phase 1, continue writing a summary into `student_profiles.learning_path`, but only as a compact dashboard cache.

Suggested shape:
- first Math entries
- first ELA entries
- each summary entry includes `subject`, `moduleSlug`, `moduleTitle`, `workingLevel`, `status`

### 5.5 Suggestion RPC

Smallest practical Phase 1 choice:
- do not make initial placement depend on `suggest_next_lessons`
- keep initial path generation deterministic in application code

Optional Phase 1 extension if time allows:
- add `p_subject text default null` to `suggest_next_lessons`
- make it read from `student_subject_state`

That RPC change is useful, but it should not block the first trustworthy MVP.

---

## 6. Backend and Service Changes

### 6.1 API surface

Update [server/api.ts](/Users/drmixer/code/ElevatEDNEW/server/api.ts):

- `POST /student/assessment/start`
  - accept `subject`
  - accept `ageYears`
  - accept optional `gradeLevel`
  - return subject-specific placement items

- `POST /student/assessment/submit`
  - accept `subject`
  - compute and persist subject placement result
  - return:
    - `subjectState`
    - `subjectPath`
    - `score`
    - `workingLevel`
    - `confidence`

- `GET /student/path`
  - either:
    - return `subjectPaths: { math, english }`
  - or:
    - add a new `GET /student/paths`

For this repo, the cleaner Phase 1 direction is:
- keep `/student/path` for backwards compatibility
- add `GET /student/paths`
- migrate the dashboard to the new endpoint

### 6.2 Placement orchestration

Update [server/learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/server/learningPaths.ts):

- extend `ensureStudentProfileProvisioned()` to persist `age_years`
- replace single generic placement flow with subject-aware helpers:
  - `startSubjectPlacementAssessment()`
  - `submitSubjectPlacementAssessment()`
  - `upsertStudentSubjectState()`
  - `buildStudentSubjectPath()`
  - `getStudentSubjectPaths()`

Do not delete the current helpers immediately. Wrap or refactor them to avoid breaking unrelated flows.

### 6.3 Placement selection

Update [server/placementSelection.ts](/Users/drmixer/code/ElevatEDNEW/server/placementSelection.ts):

- prefer subject-specific placement assessments
- stop preferring mixed core assessments for Phase 1 onboarding
- selection inputs should be:
  - `subject`
  - `expectedLevel` or level-derived grade band
  - optional `goalFocus`

### 6.4 Placement validation

[server/placementValidation.ts](/Users/drmixer/code/ElevatEDNEW/server/placementValidation.ts) can stay mostly as-is.

Small additions only:
- require placement question metadata needed for scoring:
  - `strand`
  - at least one standard code
  - `placement_level`

### 6.5 Client services

Update [src/services/onboardingService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/onboardingService.ts):

- placement start payload should include:
  - `subject`
  - `ageYears`
  - `gradeLevel`
- placement submit response should include subject state
- add `fetchStudentPaths()` for separate Math and ELA path cards

### 6.6 Dashboard aggregation

Update [src/services/dashboardService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/dashboardService.ts) only enough to:
- load subject placement summaries
- surface subject working levels
- avoid presenting a single “one true level” for the student

Do not redesign the whole dashboard service in Phase 1.

---

## 7. Frontend and Onboarding Changes

### 7.1 Onboarding flow shape

Update [src/components/Student/OnboardingFlow.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/OnboardingFlow.tsx):

Current step 1:
- preferred name
- grade band

Phase 1 step 1 should become:
- preferred name
- age
- optional current grade
- AI tutor toggle

Step 2 can stay:
- avatar
- tutor persona

Step 3 should become:
- Math diagnostic
- ELA diagnostic
- show subject progress separately

Step 4 completion should show:
- Math working level
- ELA working level
- one “why” sentence per subject
- first recommended module or lesson per subject

### 7.2 Path display

Update [src/hooks/useStudentData.ts](/Users/drmixer/code/ElevatEDNEW/src/hooks/useStudentData.ts):
- add `useStudentPaths()`
- stop assuming one latest path is enough for onboarding completion

Update [src/components/Student/StudentDashboard.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/StudentDashboard.tsx):
- show subject cards for Math and ELA
- show distinct working levels
- show separate up-next items

Minimal Phase 1 UI is enough:
- two subject cards
- not a full adaptive dashboard rewrite

### 7.3 Parent view

Update [src/components/Parent/ParentDashboard.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Parent/ParentDashboard.tsx) enough to show:
- Math placement level
- ELA placement level
- diagnostic completed / pending state
- short explanation such as “Started at Grade 6 Math after diagnostic performance in ratios and expressions.”

Do not add advanced controls or pacing tools yet.

---

## 8. Exact Files Likely To Change

### Must change for Phase 1

- [server/api.ts](/Users/drmixer/code/ElevatEDNEW/server/api.ts)
- [server/learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/server/learningPaths.ts)
- [server/placementSelection.ts](/Users/drmixer/code/ElevatEDNEW/server/placementSelection.ts)
- [server/placementValidation.ts](/Users/drmixer/code/ElevatEDNEW/server/placementValidation.ts)
- [src/components/Student/OnboardingFlow.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/OnboardingFlow.tsx)
- [src/services/onboardingService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/onboardingService.ts)
- [src/hooks/useStudentData.ts](/Users/drmixer/code/ElevatEDNEW/src/hooks/useStudentData.ts)
- [src/components/Student/StudentDashboard.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/StudentDashboard.tsx)
- [src/components/Parent/ParentDashboard.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Parent/ParentDashboard.tsx)
- [supabase/migrations/001_core_schema.sql](/Users/drmixer/code/ElevatEDNEW/supabase/migrations/001_core_schema.sql) only as historical reference
- new migration file after the latest migration, for example:
  - [supabase/migrations](/Users/drmixer/code/ElevatEDNEW/supabase/migrations)

### Likely to change if subject paths are exposed cleanly

- [src/types/index.ts](/Users/drmixer/code/ElevatEDNEW/src/types/index.ts)
- [src/services/dashboardService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/dashboardService.ts)
- [src/lib/learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/src/lib/learningPaths.ts)

### Content and seeding files likely to change

- [scripts/seed_placement_assessment.ts](/Users/drmixer/code/ElevatEDNEW/scripts/seed_placement_assessment.ts)
- [scripts/seed_diagnostic_assessments.ts](/Users/drmixer/code/ElevatEDNEW/scripts/seed_diagnostic_assessments.ts)
- any seeded assessment JSON or curriculum inputs used by those scripts

### Optional later-in-phase changes

- [supabase/migrations/047_canonical_launch_lesson_selection.sql](/Users/drmixer/code/ElevatEDNEW/supabase/migrations/047_canonical_launch_lesson_selection.sql)
- [src/services/adaptiveService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/adaptiveService.ts)

These should only move in Phase 1 if the existing fallback path logic leaks across subjects after the subject-path work lands.

---

## 9. What Can Stay As-Is For Now

Keep as-is in Phase 1 unless required by integration:

- avatar and tutor persona catalogs
  - [server/personalization.ts](/Users/drmixer/code/ElevatEDNEW/server/personalization.ts)
  - [src/services/avatarService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/avatarService.ts)
- AI tutor behavior
  - [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts)
  - [supabase/functions/tutor/index.ts](/Users/drmixer/code/ElevatEDNEW/supabase/functions/tutor/index.ts)
- XP and streak systems
  - [server/xpService.ts](/Users/drmixer/code/ElevatEDNEW/server/xpService.ts)
- current lesson/practice adaptive event loop
  - [server/learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/server/learningPaths.ts)
  - this becomes important in Phase 3, not Phase 1
- legacy generic diagnostic flow
  - [src/components/Student/AssessmentFlow.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/AssessmentFlow.tsx)
  - keep it if other parts of the app still use it

Phase 1 should not try to unify every assessment path in the app.

---

## 10. Acceptance Criteria

Phase 1 is complete when all of the following are true:

- onboarding collects `age` and optional `current grade`
- the system stores age separately from grade
- the student completes both Math and ELA placement during onboarding
- Math and ELA can resolve to different working levels for the same student
- each subject result is persisted in `student_subject_state`
- each subject gets its own initial path based on working level
- the student dashboard shows separate Math and ELA next steps
- the parent dashboard shows separate Math and ELA placement summaries
- path selection is explainable without AI
- if content is missing for an exact level, fallback stays within the same subject and nearest level

Explicit non-criteria:
- no requirement for automatic re-leveling after every lesson
- no requirement for AI-generated “why” text
- no requirement for more than Math and ELA

---

## 11. Suggested Implementation Order

### Step 1. Schema and migration

Add:
- `student_profiles.age_years`
- `student_subject_state`
- `student_paths.subject`
- supporting indexes and unique constraints

Deliverable:
- migration applies cleanly
- no existing reads break

### Step 2. Subject-aware backend placement

Update:
- placement selection
- placement start/submit payloads
- subject-state upsert

Deliverable:
- Math and ELA can each be started and submitted independently

### Step 3. Subject-aware path creation

Fix:
- canonical sequence lookup by subject + level
- build one path per subject

Deliverable:
- placement submission creates separate Math and ELA paths

### Step 4. Onboarding UI update

Update:
- age/current grade capture
- sequential Math then ELA diagnostics
- completion screen with both subjects

Deliverable:
- one new student can finish onboarding end-to-end

### Step 5. Dashboard read path

Update:
- student hooks
- student dashboard
- parent dashboard

Deliverable:
- both dashboards show subject-specific results from the new backend state

### Step 6. Content validation and seed pass

Ensure:
- subject placement assessments exist for Math and ELA
- questions contain placement metadata required by scoring

Deliverable:
- no silent fallback to broken placement content

### Step 7. Acceptance and smoke tests

Add or extend tests for:
- subject assessment selection
- scoring logic
- subject path generation
- onboarding submit response shape

---

## 12. Smallest Practical MVP For Your Son

The smallest useful MVP for one learner at home is:

- collect age and optional current grade during onboarding
- run one short Math diagnostic and one short ELA diagnostic
- produce one Math working level and one ELA working level
- generate 3 starting modules for Math and 3 for ELA
- show one clear next step per subject
- store enough subject state so the next login resumes correctly

Recommended MVP cut:
- no Science yet
- no dynamic mid-diagnostic branching
- no post-lesson auto-releveling yet
- no AI explanation layer beyond static plain-language copy

Success for this MVP is not “fully adaptive.”
Success is:
- the first path is more correct than a single grade-band guess
- a parent can understand why Math and ELA differ
- the student can start learning immediately with low friction

---

## 13. Recommended Migration Shape

Create one new migration after the current latest migration that:

1. adds `age_years` to `student_profiles`
2. adds `subject` to `student_paths`
3. creates `student_subject_state`
4. adds indexes:
   - `student_subject_state_student_subject_idx`
   - `student_paths_student_subject_status_idx`
5. backfills:
   - `student_paths.subject` from `metadata->>'subject'` when present
6. leaves `student_profiles.learning_path` untouched

This keeps rollback and inspection straightforward.

---

## 14. Testing Checklist

Minimum tests to add:

- backend unit tests
  - subject assessment selection by subject + level
  - expected-level prior calculation from age + grade
  - subject working-level calculation from deterministic score bands
  - path generation stays inside the chosen subject

- integration tests
  - start Math placement
  - submit Math placement
  - start ELA placement
  - submit ELA placement
  - fetch student subject paths

- frontend tests
  - onboarding age/current-grade step
  - completion UI shows two subject results

---

## 15. Repo Decision Summary

The smallest correct Phase 1 for this repo is:
- add `age_years`
- add `student_subject_state`
- make `student_paths` subject-aware
- make placement start/submit subject-aware
- generate Math and ELA paths separately from deterministic placement
- keep AI, XP, and continuous adaptation largely untouched for now

That gives the repo a trustworthy adaptive foundation without pretending the later phases are already done.
