# Adaptive Path Hardening Plan

Purpose: turn the remaining post-launch adaptive-path work into a concrete execution plan that can be completed in small, reviewable steps.

Status:
- `Proposed`

Related docs:
- [student-safe-adaptive-path-plan.md](/Users/drmixer/code/ElevatEDNEW/docs/student-safe-adaptive-path-plan.md)
- [adaptive-phase1-implementation-plan.md](/Users/drmixer/code/ElevatEDNEW/docs/adaptive-phase1-implementation-plan.md)
- [phase7-hardening-launch.md](/Users/drmixer/code/ElevatEDNEW/docs/phase7-hardening-launch.md)
- [adaptive-profile-blend-signal-reference.md](/Users/drmixer/code/ElevatEDNEW/docs/adaptive-profile-blend-signal-reference.md)

Implementation progress on this branch:
- Workstream A baseline shipped locally
- Workstream B DB-backed coverage shipped locally
- Workstream C telemetry baseline shipped locally
- Workstream D signal reference doc shipped locally
- Workstream E still optional and not yet implemented

## 1. Current state

Already done on `main`:
- hidden grade labels on active student-facing routes
- mastery-driven blended path replanning from live lesson and stable practice signals
- internal `profile_blend_signal` snapshots stored in `student_subject_state.metadata`
- unit and mocked integration coverage for adaptive replanning behavior
- route-level coverage for `POST /api/v1/student/event`

What remains:
- adult-only observability for why a blended path shifted
- stronger confidence against real database behavior
- threshold tuning from live traffic instead of code-only assumptions
- clearer internal documentation for the new signal model
- optional end-to-end verification after the lower-level confidence work is done

## 2. Goal

The next pass should make adaptive blended replanning:
- inspectable by adults without exposing internal level logic to students
- safer against schema/query regressions
- easier to tune from real usage data
- easier for future engineers to understand and modify

Non-goals:
- no student-facing placement or grade disclosures
- no new adaptive UX promises
- no broad redesign of parent/admin dashboards in the first step
- no browser E2E-first strategy when lower-cost server confidence gaps remain

## 3. Recommended execution order

1. Add adult-only observability for the internal blend signal.
2. Add true DB-backed server integration coverage for replanning.
3. Add anti-thrash and threshold-tuning instrumentation.
4. Document the internal signal contract and operator expectations.
5. Add optional browser E2E verification only after the server layer is stable.

## 4. Workstreams

### Workstream A. Adult-only observability

Goal:
- let parents, admins, or internal operators understand why the path shifted without showing internal grade or placement labels to the learner

Recommended output:
- an admin/debug view of the current `profile_blend_signal`
- latest replan timestamp
- trigger event type and subject
- support pressure vs stretch readiness per core subject
- short internal rationale text like:
  - `Math support pressure increased after 3 low-confidence signals`
  - `English returned to balanced mix after stable mastery recovery`

Suggested implementation shape:
- keep student routes unchanged
- add adult-only derived copy in admin or parent tooling
- do not surface raw grade-band labels on student screens

Suggested file touch points:
- [server/learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/server/learningPaths.ts)
- [src/services/dashboardService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/dashboardService.ts)
- [src/components/Parent/ParentDashboard.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Parent/ParentDashboard.tsx)
- [src/components/Admin/AdminDashboard.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Admin/AdminDashboard.tsx)

Acceptance:
- adults can inspect the latest replan reason
- students still do not see level or grade-placement language
- rationale text maps directly to stored signal fields

### Workstream B. True DB-backed adaptive integration tests

Goal:
- verify the replanning flow against the real schema and real query/update behavior rather than only mocked or in-memory stubs

Recommendation:
- do this before browser E2E

Why:
- the largest remaining risk is persistence/query correctness
- browser E2E is slower and less targeted to the likely failure mode

Minimum DB-backed cases:
- `lesson_completed` causes a blended profile replan
- 3 aligned practice/checkpoint signals trigger a replan
- debounce prevents repeated path churn
- sparse evidence does not overreact

Preferred implementation shape:
- test against a local Supabase/Postgres-backed environment
- seed minimal rows for:
  - `student_profiles`
  - `student_subject_state`
  - `student_paths`
  - `student_path_entries`
  - `student_events`
  - `student_mastery` or `student_mastery_by_subject` inputs
  - `learning_sequences`
  - `modules`
- assert final `student_profiles.learning_path` contents and ordering

Suggested file touch points:
- [server/__tests__/learningPaths.test.ts](/Users/drmixer/code/ElevatEDNEW/server/__tests__/learningPaths.test.ts)
- new DB-backed test harness under [server/__tests__](/Users/drmixer/code/ElevatEDNEW/server/__tests__)
- test setup or seed helpers under [src/test](/Users/drmixer/code/ElevatEDNEW/src/test)
- possible CI wiring in repo test scripts

Acceptance:
- tests fail if query shape, persistence, or blend ordering regresses
- tests run consistently in local dev and CI
- at least one test proves the persisted profile queue changed in the database

### Workstream C. Threshold tuning and telemetry

Goal:
- tune the replanning system from observed learner behavior instead of fixed code assumptions

Recommended telemetry to capture:
- replan count by day
- trigger source by event type
- subject mix before vs after replan
- time since previous replan
- support-pressure and stretch-readiness distributions
- cases where a subject oscillates repeatedly within a short window

Recommended questions to answer:
- are we over-replanning?
- are Math and ELA receiving the expected extra slot behavior?
- do support-heavy learners eventually rebalance?
- are we keeping stronger subjects moving?

Suggested implementation shape:
- add structured telemetry or ops events when a replan happens
- keep event payloads internal-only
- build one lightweight operator report before changing thresholds

Suggested file touch points:
- [server/learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/server/learningPaths.ts)
- [server/opsMetrics.ts](/Users/drmixer/code/ElevatEDNEW/server/opsMetrics.ts)
- [docs/smoke-test-procedure.md](/Users/drmixer/code/ElevatEDNEW/docs/smoke-test-procedure.md)

Acceptance:
- operators can see how often replans happen and why
- threshold changes are based on observed patterns, not guesswork alone

### Workstream D. Internal schema and maintainer docs

Goal:
- make the new adaptive signal model understandable and stable for future work

Recommended documentation:
- `profile_blend_signal` field reference
- expected value ranges for:
  - `recent_accuracy`
  - `mastery_pct`
  - `support_pressure`
  - `stretch_readiness`
  - `mastery_trend`
- trigger rules and debounce rules
- known limitations
- how to safely tune thresholds

Open design decision:
- keep `profile_blend_signal` in `student_subject_state.metadata`
- or promote the most important fields into migration-backed columns later

Recommendation:
- document first
- only promote to columns if observability, indexing, or query complexity starts to justify it

Suggested file touch points:
- this doc
- [docs/student-safe-adaptive-path-plan.md](/Users/drmixer/code/ElevatEDNEW/docs/student-safe-adaptive-path-plan.md)
- optional new internal reference doc if the field contract grows

Acceptance:
- a new engineer can trace where replanning inputs come from
- operators know what each stored signal means
- future schema changes have a written baseline

### Workstream E. Optional browser E2E verification

Goal:
- verify that the learner-facing experience still behaves correctly after internal replanning

Recommendation:
- do this after Workstreams A through D

Suggested scope:
- student completes lesson
- dashboard refreshes
- next lessons remain student-safe
- no grade labels appear
- path visibly shifts only in neutral learner-safe wording

Why this is optional at first:
- the browser is not the highest-risk layer for this change
- lower-level confidence work gives better signal per hour invested

Suggested file touch points:
- [tests/e2e](/Users/drmixer/code/ElevatEDNEW/tests/e2e)
- [docs/smoke-test-procedure.md](/Users/drmixer/code/ElevatEDNEW/docs/smoke-test-procedure.md)

Acceptance:
- learner-safe UI remains intact after adaptive shifts
- end-to-end flow catches regressions not visible from server tests alone

## 5. Suggested milestones

### Milestone 1. Explainability and safety
- add adult-only replan reason visibility
- keep student UI unchanged

### Milestone 2. Database confidence
- land DB-backed adaptive integration tests
- wire them into local and CI workflows

### Milestone 3. Operational tuning
- add replan telemetry
- review early production-like data
- adjust thresholds only after review

### Milestone 4. Final confidence
- add optional browser E2E if needed
- update docs and runbooks

## 6. Recommended first task

If this plan is executed one item at a time, start with:

1. add an adult-only internal rationale surface for the latest blended replan
2. then add the first DB-backed `lesson_completed` replan test

Reason:
- observability makes the system easier to debug while writing the DB-backed tests
- DB-backed coverage is the highest-confidence technical hardening step still missing

## 7. Definition of done for this hardening phase

- adults can inspect why a path changed
- DB-backed tests cover the main replan triggers and guardrails
- replans emit enough telemetry to tune thresholds safely
- the internal signal contract is documented
- any optional browser E2E is additive, not the only confidence layer
