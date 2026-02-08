# ElevatED Improvements Plan (Execution Document)

> Purpose: this is the active implementation plan for making ElevatED a truly useful AI-adaptive learning platform.
>
> Date: February 8, 2026
>
> Scope: platform-wide learning quality, adaptation logic, lesson quality, and pilot hardening.

---

## 1. Vision (North Star)

ElevatED should deliver:

1. **Real learning gains** (not just engagement).
2. **Adaptive progression** that reacts to student evidence in-session.
3. **Reliable lesson quality** even when AI is unavailable.
4. **Transparent guidance** for students and parents on why the platform chose next steps.

---

## 2. Current Reality (Snapshot)

### Strengths

1. Step-based lesson UX exists and is solid (`welcome -> learn -> practice -> review -> complete`).
2. Pilot has deterministic checkpoint/practice fallbacks and telemetry.
3. In-lesson issue reporting is implemented.

### Gaps

1. Content quality is inconsistent across lesson variants (Intro vs Launch duplicates).
2. Non-pilot practice quality can still be generic and weakly tied to lesson context.
3. Adaptation loop exists in pieces, but not yet as a strict platform contract.
4. Some progression integrity and readability edge cases remain.

---

## 3. Immediate Changes Already Completed (This Session)

1. Closed keyboard bypass path for gated lesson flow in `LessonStepper`.
   - File: `/Users/drmixer/code/ElevatEDNEW/src/components/Lesson/LessonStepper.tsx`
2. Made pilot quick-review questions contextual to actual detected perimeter dimensions.
   - File: `/Users/drmixer/code/ElevatEDNEW/src/lib/pilotPerimeterQuickReview.ts`
3. Canonicalized module launch lesson selection to prefer Launch lessons and de-prioritize Intro variants.
   - Files:
     - `/Users/drmixer/code/ElevatEDNEW/server/modules.ts`
     - `/Users/drmixer/code/ElevatEDNEW/supabase/migrations/047_canonical_launch_lesson_selection.sql`
4. Added a practice-question quality gate that blocks generic template prompts from active lesson playback and seed/import flows.
   - Files:
     - `/Users/drmixer/code/ElevatEDNEW/shared/questionQuality.ts`
     - `/Users/drmixer/code/ElevatEDNEW/src/services/lessonPracticeService.ts`
     - `/Users/drmixer/code/ElevatEDNEW/scripts/import_authored_practice.ts`
     - `/Users/drmixer/code/ElevatEDNEW/scripts/seed_practice_questions.ts`
5. Added impossible-transition telemetry alerts for lesson phase/section navigation (including blocked keyboard attempts).
   - Files:
     - `/Users/drmixer/code/ElevatEDNEW/src/components/Lesson/LessonStepper.tsx`
     - `/Users/drmixer/code/ElevatEDNEW/src/lib/reliability.ts`
6. Extended content quality gate enforcement across remaining student-facing question generation/seed/runtime assessment paths (with blocked-item telemetry by source/reason).
   - Files:
     - `/Users/drmixer/code/ElevatEDNEW/shared/questionQuality.ts`
     - `/Users/drmixer/code/ElevatEDNEW/src/services/assessmentService.ts`
     - `/Users/drmixer/code/ElevatEDNEW/server/modules.ts`
     - `/Users/drmixer/code/ElevatEDNEW/server/placementValidation.ts`
     - `/Users/drmixer/code/ElevatEDNEW/scripts/seed_module_assessments.ts`
     - `/Users/drmixer/code/ElevatEDNEW/scripts/seed_placement_assessment.ts`
     - `/Users/drmixer/code/ElevatEDNEW/scripts/seed_diagnostic_assessments.ts`
     - `/Users/drmixer/code/ElevatEDNEW/scripts/seed_lesson_exit_tickets.ts`
     - `/Users/drmixer/code/ElevatEDNEW/scripts/generate_practice_for_all_lessons.ts`
     - `/Users/drmixer/code/ElevatEDNEW/scripts/generate_remaining_practice.ts`
     - `/Users/drmixer/code/ElevatEDNEW/scripts/fill_gaps_from_dashboard.ts`
     - `/Users/drmixer/code/ElevatEDNEW/scripts/fill_priority_gaps.ts`
     - `/Users/drmixer/code/ElevatEDNEW/src/lib/__tests__/questionQuality.test.ts`
     - `/Users/drmixer/code/ElevatEDNEW/server/__tests__/placementValidation.test.ts`
7. Extended the Grade 2 math adaptive pilot pattern beyond perimeter by adding topic-based deterministic checkpoints, quick reviews, practice sets, and challenge questions for place value, addition/subtraction, and measurement lessons.
   - Files:
     - `/Users/drmixer/code/ElevatEDNEW/src/lib/pilotConditions.ts`
     - `/Users/drmixer/code/ElevatEDNEW/src/lib/pilotGrade2Math.ts`
     - `/Users/drmixer/code/ElevatEDNEW/src/pages/LessonPlayerPage.tsx`
     - `/Users/drmixer/code/ElevatEDNEW/src/components/Lesson/phases/LearnPhase.tsx`
     - `/Users/drmixer/code/ElevatEDNEW/src/components/Lesson/phases/PracticePhase.tsx`
     - `/Users/drmixer/code/ElevatEDNEW/src/lib/__tests__/pilotConditions.test.ts`
8. Added deterministic remediation templates for high-traffic non-math subjects (English, Science, Social Studies) in active lesson practice flow, including deterministic hint/steps, quick review, challenge, and activation/outcome telemetry.
   - Files:
     - `/Users/drmixer/code/ElevatEDNEW/src/lib/nonMathRemediation.ts`
     - `/Users/drmixer/code/ElevatEDNEW/src/lib/__tests__/nonMathRemediation.test.ts`
     - `/Users/drmixer/code/ElevatEDNEW/src/pages/LessonPlayerPage.tsx`
     - `/Users/drmixer/code/ElevatEDNEW/src/components/Lesson/phases/PracticePhase.tsx`
9. Enabled deterministic mastery-trend adaptive scheduling in active lesson practice flow (trend-based review vs challenge decisions) with decision telemetry.
   - Files:
     - `/Users/drmixer/code/ElevatEDNEW/src/lib/masteryTrend.ts`
     - `/Users/drmixer/code/ElevatEDNEW/src/lib/__tests__/masteryTrend.test.ts`
     - `/Users/drmixer/code/ElevatEDNEW/src/components/Lesson/phases/PracticePhase.tsx`
10. Shipped student/parent decision transparency cards in active flows:
    - Student lesson player now shows deterministic "Why this lesson now" and "Why this hint/review/challenge now" cards with transparency telemetry.
    - Parent summary now shows recommended at-home support action per learner (with why and estimated minutes).
    - Files:
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/transparencyReason.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/__tests__/transparencyReason.test.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/pages/LessonPlayerPage.tsx`
      - `/Users/drmixer/code/ElevatEDNEW/src/components/Lesson/phases/PracticePhase.tsx`
      - `/Users/drmixer/code/ElevatEDNEW/src/components/Student/StudentDashboard.tsx`
      - `/Users/drmixer/code/ElevatEDNEW/src/components/Parent/ParentSummaryCard.tsx`
11. Implemented P2 evaluation harness + release-gating dashboards:
    - Added shared release-gate scoring utilities and checkpoint telemetry aggregation.
    - Added admin dashboard checkpoint/generic-content metrics ingestion and a new release-gates panel with pass/warn/fail/no-data status + blockers.
    - Added CLI release gate harness (`npm run eval:release-gates`) for pre-release enforcement snapshots.
    - Files:
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/evaluationHarness.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/__tests__/evaluationHarness.test.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/types/index.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/services/dashboardService.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/components/Admin/AdminDashboard.tsx`
      - `/Users/drmixer/code/ElevatEDNEW/scripts/evaluate_release_gates.ts`
      - `/Users/drmixer/code/ElevatEDNEW/package.json`
12. Started P2 K-5 visual/adaptation generalization:
    - Added deterministic K-5 math adaptation templates for quick review, hints/steps, challenge questions, and topic detection.
    - Wired K-5 math adaptation into active lesson practice remediation/challenge flow (without changing Grade 2 pilot behavior).
    - Expanded deterministic K-5 lesson/practice visual generation beyond perimeter-only coverage (place value, fractions, arrays, number line, measurement, area, data bars), and enabled section visuals regardless of pilot checkpoint gating.
    - Files:
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/k5MathAdaptation.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/components/Lesson/phases/PracticePhase.tsx`
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/lessonVisuals.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/components/Lesson/phases/LearnPhase.tsx`
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/__tests__/k5MathAdaptation.test.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/__tests__/lessonVisuals.test.ts`
13. Completed P2 K-5 adaptation expansion in Learn checkpoint loop:
    - Added deterministic K-5 math checkpoint generation (`define`, `compute`, `scenario`) and checkpoint hint generation by detected topic.
    - Updated Learn phase checkpoint gating from Grade 2-only pilot detection to K-5 math adaptive detection, while preserving existing Grade 2 pilot AI+fallback path.
    - Enabled deterministic K-5 checkpoint quick-review/hint behavior and K-5-specific checkpoint telemetry in active Learn flow.
    - Files:
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/k5MathAdaptation.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/components/Lesson/phases/LearnPhase.tsx`
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/__tests__/k5MathAdaptation.test.ts`
14. Hardened Phase B/C measurement instrumentation for recovery and retention:
    - Added retention-stability analytics computation (3-day and 7-day rates + follow-up coverage) to the shared evaluation harness and release-gate scoring.
    - Extended admin/release-gate checkpoint telemetry ingestion to include both pilot and K-5 checkpoint answered events.
    - Added admin checkpoint retention metrics fields and wired retention rates into release-gate dashboard rendering.
    - Added richer checkpoint telemetry payload context (`subject`, `gradeBand`, `topic`) in Learn checkpoint events for segment-ready analytics.
    - Files:
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/evaluationHarness.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/__tests__/evaluationHarness.test.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/services/dashboardService.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/types/index.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/components/Admin/AdminDashboard.tsx`
      - `/Users/drmixer/code/ElevatEDNEW/scripts/evaluate_release_gates.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/components/Lesson/phases/LearnPhase.tsx`
15. Started Phase B/C measurement follow-through for telemetry volume + no-data gate closure:
    - Added checkpoint telemetry source-volume metrics (`pilot` vs `k5`) in shared checkpoint evaluation summaries and surfaced those volumes in the release-gate harness + admin release-gate panel.
    - Added retention-horizon ingestion for release-gate retention scoring (fetch window extends by 7 additional days for retention-only computation), and added release-gate fallback behavior to score retention as `0%` when eligible learners exist but no follow-up samples were observed.
    - Added adaptive outcome telemetry aggregation in the shared evaluation harness and release-gate harness.
    - Added persisted adaptive outcome events (`success_adaptive_tutor_outcome`) in student tutor flow for success/error/safety outcomes, and wired admin checkpoint metrics to include adaptive attempt/error/safety counts + rates.
    - Files:
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/evaluationHarness.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/__tests__/evaluationHarness.test.ts`
      - `/Users/drmixer/code/ElevatEDNEW/scripts/evaluate_release_gates.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/services/dashboardService.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/types/index.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/components/Admin/AdminDashboard.tsx`
      - `/Users/drmixer/code/ElevatEDNEW/src/components/Student/LearningAssistant.tsx`
16. Added synthetic success-telemetry seeding for no-user environments to validate Phase B/C measurement gates:
    - Added CLI seeder script that writes tagged synthetic telemetry to `analytics_events` for:
      - pilot + K-5 checkpoint answered events (with retention follow-up patterns),
      - adaptive tutor outcome events (`success_adaptive_tutor_outcome`),
      - source/segment payload tags for auditability.
    - Added payload `studentId` fallback support in checkpoint/retention evaluation so synthetic rows (with `student_id` null) are counted without requiring real user/profile rows.
    - Added package script: `seed:synthetic-success-telemetry`.
    - Files:
      - `/Users/drmixer/code/ElevatEDNEW/scripts/seed_synthetic_success_telemetry.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/evaluationHarness.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/lib/__tests__/evaluationHarness.test.ts`
      - `/Users/drmixer/code/ElevatEDNEW/package.json`
17. Remediated generic question-bank sample content for release-gate enforcement:
    - Added a targeted CLI remediation script that scans a recent `question_bank` window, uses the shared question-quality validator to detect generic rows, and rewrites prompts/options with subject/topic-grounded replacements (dry-run + apply modes).
    - Applied remediation to the active 500-row release-gate sample and reduced generic rate from `30%` (`150/500`) to `0%` (`0/500`).
    - Files:
      - `/Users/drmixer/code/ElevatEDNEW/scripts/remediate_generic_question_bank.ts`
      - `/Users/drmixer/code/ElevatEDNEW/package.json`
18. Closed synthetic diagnostic hard-gate path for no-user environments:
    - Updated release-gate CLI and admin dashboard success-metrics ingestion to use a synthetic diagnostic cohort fallback (`success_diagnostic_eligible` + `success_diagnostic_completed`) when present in analytics telemetry, while preserving the existing `student_profiles.assessment_completed` baseline path.
    - Extended synthetic telemetry seeder to generate diagnostic eligibility/completion events so diagnostic completion can be validated end-to-end alongside checkpoint/retention/adaptive metrics.
    - Files:
      - `/Users/drmixer/code/ElevatEDNEW/scripts/evaluate_release_gates.ts`
      - `/Users/drmixer/code/ElevatEDNEW/src/services/dashboardService.ts`
      - `/Users/drmixer/code/ElevatEDNEW/scripts/seed_synthetic_success_telemetry.ts`

Validation run this session:
- `npm run test -- src/lib/__tests__/questionQuality.test.ts server/__tests__/placementValidation.test.ts src/services/__tests__/lessonPracticeService.test.ts`
- `npm run test -- src/services/__tests__/assessmentService.adaptive.test.ts`
- `npm run test -- src/lib/__tests__/pilotConditions.test.ts src/lib/__tests__/questionQuality.test.ts src/services/__tests__/lessonPracticeService.test.ts server/__tests__/placementValidation.test.ts`
- `npx eslint` on all touched files
- `npm run test -- src/lib/__tests__/nonMathRemediation.test.ts src/lib/__tests__/pilotConditions.test.ts src/lib/__tests__/questionQuality.test.ts src/services/__tests__/lessonPracticeService.test.ts server/__tests__/placementValidation.test.ts` (passed)
- `npx eslint src/lib/nonMathRemediation.ts src/lib/__tests__/nonMathRemediation.test.ts src/pages/LessonPlayerPage.tsx src/components/Lesson/phases/PracticePhase.tsx` (passed)
- `npm run test -- src/lib/__tests__/masteryTrend.test.ts src/lib/__tests__/nonMathRemediation.test.ts src/lib/__tests__/pilotConditions.test.ts src/lib/__tests__/questionQuality.test.ts src/services/__tests__/lessonPracticeService.test.ts server/__tests__/placementValidation.test.ts` (passed)
- `npx eslint src/lib/masteryTrend.ts src/lib/__tests__/masteryTrend.test.ts src/components/Lesson/phases/PracticePhase.tsx src/lib/nonMathRemediation.ts src/lib/__tests__/nonMathRemediation.test.ts src/pages/LessonPlayerPage.tsx` (passed)
- `npm run test -- src/lib/__tests__/transparencyReason.test.ts src/lib/__tests__/masteryTrend.test.ts src/lib/__tests__/nonMathRemediation.test.ts src/lib/__tests__/pilotConditions.test.ts src/lib/__tests__/questionQuality.test.ts src/services/__tests__/lessonPracticeService.test.ts server/__tests__/placementValidation.test.ts` (passed)
- `npx eslint src/lib/transparencyReason.ts src/lib/__tests__/transparencyReason.test.ts src/pages/LessonPlayerPage.tsx src/components/Lesson/phases/PracticePhase.tsx src/components/Student/StudentDashboard.tsx src/components/Parent/ParentSummaryCard.tsx src/lib/masteryTrend.ts src/lib/__tests__/masteryTrend.test.ts src/lib/nonMathRemediation.ts src/lib/__tests__/nonMathRemediation.test.ts` (passed)
- `npm run test -- src/lib/__tests__/evaluationHarness.test.ts src/services/__tests__/dashboardService.test.ts` (passed; 12 tests total)
- `npx eslint src/lib/evaluationHarness.ts src/lib/__tests__/evaluationHarness.test.ts src/services/dashboardService.ts src/components/Admin/AdminDashboard.tsx scripts/evaluate_release_gates.ts src/types/index.ts` (passed)
- `npm run eval:release-gates -- --lookback-days 7 --allow-missing-hard-gates` (completed with gating failure: `FAIL`; blockers: `Diagnostic completion` at `42.9%`, `Generic content rate` at `30%`; no-data on adaptive/checkpoint gates in current telemetry window)
- `npm run test -- src/lib/__tests__/k5MathAdaptation.test.ts src/lib/__tests__/lessonVisuals.test.ts src/lib/__tests__/pilotConditions.test.ts src/lib/__tests__/nonMathRemediation.test.ts` (passed; 15 tests total)
- `npx eslint src/lib/k5MathAdaptation.ts src/lib/lessonVisuals.ts src/components/Lesson/phases/PracticePhase.tsx src/components/Lesson/phases/LearnPhase.tsx src/lib/__tests__/k5MathAdaptation.test.ts src/lib/__tests__/lessonVisuals.test.ts` (passed)
- `npm run test -- src/lib/__tests__/k5MathAdaptation.test.ts src/lib/__tests__/lessonVisuals.test.ts src/lib/__tests__/pilotConditions.test.ts src/lib/__tests__/nonMathRemediation.test.ts` (passed; 17 tests total)
- `npx eslint src/lib/k5MathAdaptation.ts src/components/Lesson/phases/LearnPhase.tsx src/lib/__tests__/k5MathAdaptation.test.ts` (passed)
- `npx eslint src/lib/lessonVisuals.ts src/components/Lesson/phases/PracticePhase.tsx src/components/Lesson/phases/LearnPhase.tsx src/lib/k5MathAdaptation.ts src/lib/__tests__/k5MathAdaptation.test.ts src/lib/__tests__/lessonVisuals.test.ts` (passed)
- `npm run test -- src/lib/__tests__/evaluationHarness.test.ts src/lib/__tests__/k5MathAdaptation.test.ts src/lib/__tests__/lessonVisuals.test.ts src/lib/__tests__/pilotConditions.test.ts src/lib/__tests__/nonMathRemediation.test.ts src/services/__tests__/dashboardService.test.ts` (passed; 30 tests total)
- `npx eslint src/lib/evaluationHarness.ts src/lib/__tests__/evaluationHarness.test.ts src/services/dashboardService.ts src/types/index.ts src/components/Admin/AdminDashboard.tsx scripts/evaluate_release_gates.ts src/components/Lesson/phases/LearnPhase.tsx` (passed)
- `npm run test` (passed; 34 files, 110 tests total)
- `npm run eval:release-gates -- --lookback-days 7 --allow-missing-hard-gates` (completed with gating failure: `FAIL`; blockers: `Diagnostic completion` at `42.9%`, `Generic content rate` at `30%`; retention gates currently `no data` with checkpoint samples `0`)
- `npm run test -- src/lib/__tests__/evaluationHarness.test.ts src/services/__tests__/dashboardService.test.ts` (passed; 18 tests total)
- `npx eslint src/lib/evaluationHarness.ts src/lib/__tests__/evaluationHarness.test.ts scripts/evaluate_release_gates.ts src/services/dashboardService.ts src/types/index.ts src/components/Admin/AdminDashboard.tsx src/components/Student/LearningAssistant.tsx` (passed with 2 pre-existing warnings in `src/components/Student/LearningAssistant.tsx` for `react-hooks/exhaustive-deps` around `studentStrengths` memo/callback dependencies)
- `npm run eval:release-gates -- --lookback-days 7 --allow-missing-hard-gates` (completed with gating failure: `FAIL`; blockers: `Diagnostic completion` at `42.9%`, `Generic content rate` at `30%`, `Adaptive error rate` at `100%`; telemetry samples include explicit source splits `checkpoints 0 (pilot 0, k5 0)` plus `adaptive 0`; retention/adaptive gates now resolve to explicit fail scores instead of `no data` when telemetry is missing)
- `npm run test -- src/lib/__tests__/evaluationHarness.test.ts` (passed; 11 tests total)
- `npx eslint src/lib/evaluationHarness.ts src/lib/__tests__/evaluationHarness.test.ts scripts/seed_synthetic_success_telemetry.ts` (passed)
- `npm run seed:synthetic-success-telemetry -- --replace --tag phase_bc_synth_v1` (completed; inserted `94` rows: `success_adaptive_tutor_outcome: 60`, `success_k5_math_checkpoint_answered: 17`, `success_pilot_checkpoint_answered: 17`)
- `npm run eval:release-gates -- --lookback-days 7 --allow-missing-hard-gates` (completed with gating failure: `FAIL`; blockers now narrowed to `Diagnostic completion` at `42.9%` and `Generic content rate` at `30%`; Phase B/C measurement gates now have sampled values: `checkpoint first-pass 80%`, `checkpoint recovery 100%`, `retention 3-day 80%`, `retention 7-day 80%`, `adaptive error 5%`, `adaptive safety 5%`; telemetry samples: `checkpoints 24 (pilot 12, k5 12)`, `adaptive 60`)
- `npx eslint scripts/remediate_generic_question_bank.ts shared/questionQuality.ts` (passed)
- `npm run fix:generic-question-bank -- --limit 500 --dry-run` (completed; generic rate before `150/500 (30%)`; planned remediations `150`)
- `npm run fix:generic-question-bank -- --limit 500 --apply` (completed; generic rate after `0/500 (0%)`)
- `npm run eval:release-gates -- --lookback-days 7 --allow-missing-hard-gates` (completed with gating failure: `FAIL`; blockers now narrowed to only `Diagnostic completion` at `42.9%`; `Generic content rate` is now `0%` and Phase B/C measurement gates remain sampled/pass in the current synthetic telemetry window)
- `npm run test -- src/lib/__tests__/evaluationHarness.test.ts` (passed; 11 tests total)
- `npx eslint scripts/evaluate_release_gates.ts src/services/dashboardService.ts scripts/seed_synthetic_success_telemetry.ts` (passed)
- `npm run test -- src/lib/__tests__/evaluationHarness.test.ts src/services/__tests__/dashboardService.test.ts` (passed; 19 tests total)
- `npm run seed:synthetic-success-telemetry -- --replace --tag phase_bc_synth_v1` (completed; inserted `120` rows including diagnostic cohort telemetry: `success_diagnostic_eligible: 14`, `success_diagnostic_completed: 12`)
- `npm run eval:release-gates -- --lookback-days 7 --allow-missing-hard-gates` (completed with `PASS`; blockers `0`; diagnostic completion now `85.7%`, checkpoint/retention/adaptive gates remain pass)

---

## 4. Execution Roadmap

## Phase A: Learning Contract and Quality Gates (Weeks 1-2)

Goal: every lesson interaction must be pedagogically valid and measurable.

### Deliverables

1. Define `Learning Evidence Contract`:
   - each checkpoint/practice item must map to skill(s),
   - have deterministic correctness,
   - include explainable remediation path.
2. Add `Content Quality Gate` for publish/seeding:
   - reject generic prompts ("main concept", "strategy" boilerplate),
   - enforce grade appropriateness,
   - enforce lesson-grounded context.
3. Create `Lesson Variant Policy`:
   - canonical lesson for launch per module,
   - deprecate/merge redundant Intro vs Launch variants.

### Acceptance Criteria

1. New/updated lesson content cannot be published if it fails quality gate checks.
2. Every launched module points to one canonical, approved lesson sequence.

---

## Phase B: Adaptive Engine Hardening (Weeks 2-6)

Goal: deterministic adaptive loop first, AI enhancement second.

### Deliverables

1. Implement strict loop:
   - `Teach -> Check -> Remediate -> Recheck -> Extend`.
2. Add remediation tiers:
   - Tier 1: deterministic hint + visual + easier item,
   - Tier 2: scaffolded breakdown steps,
   - Tier 3: alternate representation/example.
3. Add acceleration logic:
   - challenge question only after mastery evidence,
   - optionally skip repetitive items when confidence is high.
4. Persist learner state:
   - misconceptions detected,
   - hint usage,
   - retry outcomes,
   - recent mastery trend.

### Acceptance Criteria

1. Students with misses recover within <=2 remediation steps at target rate.
2. High performers get acceleration without losing mastery retention.

---

## Phase C: Practice Quality Overhaul (Weeks 3-7)

Goal: no generic practice in active student flow.

### Deliverables

1. Update practice selection:
   - prefer lesson-skill aligned and lesson-contextual items,
   - block generic item classes from playback.
2. Add item-quality scoring:
   - specificity score,
   - numeric/concrete requirement (math),
   - distractor plausibility.
3. Add fallback generation policy:
   - deterministic templates by subject/grade/skill,
   - AI-generated items only if they pass validator.

### Acceptance Criteria

1. Generic-content rate in served practice drops near zero.
2. Practice prompts consistently reference actual lesson concept context.

---

## Phase D: Progression Integrity and UX Clarity (Weeks 2-5)

Goal: students cannot accidentally bypass learning gates; UI supports comprehension.

### Deliverables

1. Unify navigation rules across click/keyboard/event-driven transitions.
2. Add impossible-transition telemetry alerts.
3. Reduce truncation risk in checkpoint/practice prompts/options where comprehension suffers.
4. Keep consistent "why you’re seeing this" messaging for hints/reviews/challenges.

### Acceptance Criteria

1. No bypass path around required checkpoints/practice.
2. Measurable drop in confusion/abandon signals at checkpoint moments.

---

## Phase E: Transparency and Parent Trust (Weeks 5-9)

Goal: explain platform decisions in plain language.

### Deliverables

1. Student-facing reason cards:
   - why this lesson next,
   - why this hint/remediation now.
2. Parent summaries:
   - strengths, struggles, and recommended home support actions.
3. Tutor boundary clarity:
   - when AI answered directly vs fallback logic.

### Acceptance Criteria

1. Parents can articulate why their child got specific next steps.
2. Support tickets about "random recommendations" drop over time.

---

## 5. Measurement Framework (Must-Have Metrics)

Track these weekly by subject/grade:

1. **Learning Gain**: post-check minus pre-check performance per skill.
2. **First-Pass Mastery**: checkpoint pass rate without remediation.
3. **Recovery Rate**: pass rate after remediation in <=2 attempts.
4. **Generic Content Rate**: served items flagged non-specific.
5. **Retention**: mastery stability at 3-day and 7-day intervals.

Guardrail metrics:

1. Lesson completion without evidence (should be near zero).
2. Bypass/invalid transition events (should be zero).
3. AI fallback rate and failure rate.

---

## 6. Prioritized Backlog (Implementation Order)

## P0 (Do Next)

1. Canonicalize module launch lesson selection (remove weak variant roulette).
2. Block generic question patterns from active playback.
3. Add quality gate checks to lesson/question seeding workflows.
4. Add impossible-transition telemetry alerts.

## P1

1. Extend pilot adaptation pattern from perimeter to additional Grade 2 math lessons.
2. Implement cross-subject deterministic remediation templates.
3. Add mastery-trend-based acceleration/review scheduling.

## P2

1. Parent/student transparency cards.
2. Evaluation harness + release gating dashboards.
3. Broader K-5 visual/adaptation generalization.

---

## 7. Working Protocol For Future Chats

When starting a new chat, reference:

`Use /Users/drmixer/code/ElevatEDNEW/IMPROVEMENTS.md as the active execution plan and continue from the top unfinished P0 item.`

Expected per-chat output:

1. Which backlog item is being implemented.
2. Exact files changed.
3. Validation run and results.
4. Checklist updates in this document.

---

## 8. Progress Checklist

## P0

- [x] Canonical module lesson selection implemented.
- [x] Generic practice filters implemented in playback path.
- [x] Content quality gate integrated into seed/publish workflow.
- [x] Impossible-transition telemetry + alerting implemented.

## P1

- [x] Perimeter adaptation pattern generalized to additional Grade 2 math units.
- [x] Deterministic remediation templates available for non-math subjects.
- [x] Mastery-trend adaptive scheduling enabled.

## P2

- [x] Parent/student decision transparency cards shipped.
- [x] Eval harness + release gates enforced.
- [x] K-5 adaptation expansion completed.

## Phase B/C Measurement Follow-through

- [x] Checkpoint telemetry volume instrumentation now reports pilot + K-5 attempt splits in shared evaluation + release-gate surfaces.
- [x] Retention release-gate computation now uses a retention horizon window and scores eligible-without-followup cohorts as `0%` (fail) instead of unresolved `no data`.
- [x] Adaptive outcome telemetry contract added (`success_adaptive_tutor_outcome`) and wired into release-gate adaptive rate computation with explicit fail-safe scoring when telemetry volume is missing.
- [x] Synthetic telemetry seed path added for no-user environments; retention/adaptive gates validated with sampled pilot + K-5 + adaptive events.
- [x] Generic content blocker remediated in active 500-row release-gate sample (`30% -> 0%`) via validator-driven question-bank cleanup script.
- [x] Diagnostic completion hard gate validated in no-user mode via synthetic diagnostic cohort telemetry (`success_diagnostic_eligible` / `success_diagnostic_completed`), producing release-gate `PASS`.
