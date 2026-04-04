# Student-Safe Adaptive Path Plan

Purpose: document the next implementation pass for the grades 3-8 learner experience so the product stays student-safe on the surface while getting more adaptive underneath.

Status:
- `Implemented locally`

Related docs:
- [adaptive-phase1-implementation-plan.md](/Users/drmixer/code/ElevatEDNEW/docs/adaptive-phase1-implementation-plan.md)
- [student-experience-improvements.md](/Users/drmixer/code/ElevatEDNEW/docs/student-experience-improvements.md)
- [family-ready.md](/Users/drmixer/code/ElevatEDNEW/docs/family-ready.md)
- [adaptive-profile-blend-signal-reference.md](/Users/drmixer/code/ElevatEDNEW/docs/adaptive-profile-blend-signal-reference.md)

## 1. Product goal

The learner experience should:
- feel like one simple personalized path
- avoid exposing grade labels or placement levels to the student
- keep subject-specific placement and adaptation logic underneath
- adapt quietly as the student improves or struggles

Working example:
- a 12-year-old can place into stronger ELA and weaker Math
- the student never sees "4th grade math" or "7th grade reading"
- the system still uses those internal signals to build and refine the path

## 2. Current repo state

Already implemented on `main`:
- mixed Math and ELA onboarding assessment in one UX flow
- separate subject scoring and subject placement state underneath
- blended profile-level path generation across Math, ELA, Science, and Social Studies
- science and social studies mixed in using nominal grade theme plus ELA-tuned accessibility
- grades 3-8 canonical blended path support
- `soft_launch` release gate mode for low-traffic family use

Important current behavior:
- the system already stores separate subject placement state and a blended `student_profiles.learning_path`
- lesson and practice events already feed server-side adaptive logic through `POST /api/v1/student/event`
- server adaptive logic already tracks rolling accuracy, target difficulty, misconceptions, and inserts remediation or stretch entries into stored `student_paths`

Important current limitation:
- the blended profile path does not yet fully re-plan itself from live mastery in a stable, intentional way
- some student-facing UI still showed grade labels before the in-progress local patch listed below

## 3. In-progress local patch

There are currently uncommitted local edits in the worktree to hide grade labels on active student-facing routes:
- [LessonHeader.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Lesson/LessonHeader.tsx)
- [WelcomePhase.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Lesson/phases/WelcomePhase.tsx)
- [LessonPlayerPage.tsx](/Users/drmixer/code/ElevatEDNEW/src/pages/LessonPlayerPage.tsx)
- [ModulePage.tsx](/Users/drmixer/code/ElevatEDNEW/src/pages/ModulePage.tsx)
- [CatalogPage.tsx](/Users/drmixer/code/ElevatEDNEW/src/pages/CatalogPage.tsx)
- [StudentDashboard.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/StudentDashboard.tsx)
- [WeeklyPlanCard.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/WeeklyPlanCard.tsx)

That patch does:
- hide grade chips and grade-band text for student accounts
- keep grade metadata available internally for logic
- remove hidden cached grade filters from the student catalog state
- replace one remaining "grade level" explanation string with neutral "current path" wording

Validation already run on this patch:
- `npx eslint src/components/Lesson/LessonHeader.tsx src/components/Lesson/phases/WelcomePhase.tsx src/pages/LessonPlayerPage.tsx src/pages/ModulePage.tsx src/pages/CatalogPage.tsx src/components/Student/StudentDashboard.tsx src/components/Student/WeeklyPlanCard.tsx`
- `npm run build`

## 4. What is true right now about adaptivity

### 4.1 What already adapts

The current server adaptive layer in [learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/server/learningPaths.ts):
- reads recent `practice_answered`, `quiz_submitted`, and `lesson_completed` events
- computes rolling accuracy
- updates `adaptive_state.current_difficulty`
- detects repeated misconceptions by standard
- inserts `review` entries for remediation
- inserts `practice` entries for stretch when the student is outperforming the current target

This means:
- if a student struggles repeatedly, the stored path can bias toward remediation
- if a student succeeds consistently, the stored path can add harder follow-up work

### 4.2 What does not yet adapt enough

The blended profile path is not yet fully regenerated from live mastery signals.

Today the system is still stronger at:
- initial placement
- subject-level stored path adjustment
- dashboard-level refresh from suggestions

It is not yet strong enough at:
- rebalancing the profile-level blended queue after meaningful evidence
- reducing remediation after repeated demonstrated improvement
- updating the Math vs ELA weekly mix from mastery changes with clear anti-thrash rules

## 5. Recommended next implementation scope

The next pass should do two things only:

1. Finish the student-safe UX layer
2. Add mastery-driven blended re-planning

Non-goals for this pass:
- no new subject diagnostics
- no visible level labels for the student
- no per-question path regeneration
- no large parent/admin redesign

## 6. Target product behavior

After this pass:
- the student sees neutral labels like "personalized path", "starting point", and "next lesson"
- the student never sees internal grade labels or working levels on student routes
- Math and ELA placement stay separate internally
- the blended path quietly shifts based on demonstrated performance

Example:
- student places below expected in multiplication-heavy Math
- early path emphasizes foundational Math plus on-level ELA
- after several successful multiplication lessons and checkpoints, remediation pressure drops
- the profile path shifts toward the next appropriate Math concept without announcing a grade jump

## 7. Implementation plan

### Step 1. Commit the student-safe grade-hiding patch

Goal:
- make student-facing routes consistent before deeper adaptive work

Acceptance:
- no grade labels shown on student lesson, module, catalog, or dashboard routes
- parent/admin/internal logic still retain grade metadata

### Step 2. Define re-planning triggers

Goal:
- only rebuild the blended path when there is enough evidence to matter

Recommended triggers:
- on `lesson_completed`
- on checkpoint bundles or practice evidence after a small threshold
- not on every single answer

Recommended initial rule:
- rebuild when a lesson completes
- optionally rebuild when 3 same-skill practice/checkpoint signals arrive with consistent direction

### Step 3. Aggregate live evidence into stable subject signals

Goal:
- convert noisy events into a few reliable signals the path builder can consume

Suggested inputs:
- `student_mastery`
- recent practice accuracy by subject
- recent checkpoint accuracy by subject
- recent misconception tags by standard

Suggested outputs per subject:
- `mastery_trend`
- `recent_accuracy`
- `support_pressure`
- `stretch_readiness`
- `last_replanned_at`

Do not build a second independent truth store unless the existing data is insufficient.

### Step 4. Regenerate the blended profile path from live signals

Goal:
- update `student_profiles.learning_path` from current evidence, not only original placement

Recommended behavior:
- Math weight increases if Math support pressure is high
- ELA weight increases if ELA support pressure is high
- Science and Social Studies remain contextual supports
- if a subject stabilizes, its blend returns toward a balanced ratio

Recommended v1 ratio logic:
- balanced: `2 core Math/ELA slots + 1 science/social studies slot`
- if one core subject is materially behind: give that subject one extra slot
- cap the difference so one subject cannot starve the other

### Step 5. Add stability rules

Goal:
- avoid path thrash and false swings

Required rules:
- require repeated evidence before changing the blend materially
- require repeated success before removing remediation pressure
- debounce re-planning so it cannot happen too frequently

Suggested guardrails:
- minimum re-plan interval per subject: one completed lesson or a short time window
- require two positive signals to retire a remediation standard
- require two negative signals before adding new remediation pressure

### Step 6. Test realistic learner scenarios

Required cases:
- stronger ELA, weaker Math
- stronger Math, weaker ELA
- student improves after initial struggle
- student has one bad lesson after improving
- missing or sparse recent evidence

Acceptance:
- path changes are explainable
- stronger subjects keep moving
- weaker subjects get support without taking over the whole path

## 8. Suggested file touch points

Likely implementation files:
- [learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/src/lib/learningPaths.ts)
- [adaptiveService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/adaptiveService.ts)
- [assessmentService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/assessmentService.ts)
- [dashboardService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/dashboardService.ts)
- [learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/server/learningPaths.ts)
- [LessonPlayerPage.tsx](/Users/drmixer/code/ElevatEDNEW/src/pages/LessonPlayerPage.tsx)
- [StudentDashboard.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/StudentDashboard.tsx)
- [learningPaths.test.ts](/Users/drmixer/code/ElevatEDNEW/src/lib/learningPaths.test.ts)
- [dashboardService.test.ts](/Users/drmixer/code/ElevatEDNEW/src/services/__tests__/dashboardService.test.ts)
- server tests around path projection and adaptive behavior

## 9. Recommended execution order

1. Commit the in-progress hidden-grade UI patch.
2. Add subject-signal aggregation helpers.
3. Add re-plan trigger logic on top of lesson completion and stable evidence.
4. Rebuild `student_profiles.learning_path` from live signals.
5. Update dashboard copy only if needed for explainability.
6. Add scenario tests.
7. Run lint and build.

## 10. Acceptance checklist

- student-facing routes do not reveal grade labels or placement levels
- internal placement and path metadata still work
- blended profile path now rebuilds from live subject signals on `lesson_completed`
- stable three-signal practice or checkpoint clusters can trigger a quieter re-plan between lessons
- per-subject blended signal snapshots are stored in `student_subject_state.metadata.profile_blend_signal`
- stronger subjects keep moving while weaker subjects get one extra core slot instead of taking over the whole path

## 11. Local validation

Validated locally after implementation:
- `npx vitest run src/lib/learningPaths.test.ts server/__tests__/learningPaths.test.ts`
- `npx eslint src/lib/learningPaths.ts src/lib/learningPaths.test.ts server/learningPaths.ts server/__tests__/learningPaths.test.ts`
- `npm run lint`
- `npm run build`
- lesson completion can trigger blended re-planning
- path changes are stable and explainable
- improvement in a weak area eventually reduces remediation
- one bad event does not immediately swing the path
- stronger subjects do not get starved
- `npm run build` passes
- targeted tests pass

## 11. Handoff note

When continuing this work in a fresh chat:
- start from the current dirty worktree
- preserve the uncommitted grade-hiding patch unless explicitly changing it
- implement and commit in two logical chunks:
  - `Hide grade labels in student routes`
  - `Reblend student path from live mastery signals`
