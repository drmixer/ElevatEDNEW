# Adaptive Foundation Plan

Purpose: define the practical, trustworthy path from the current repo state to a genuinely adaptive home-learning system that can grow with one student over time.

Status:
- `Active`

Related docs:
- [vision_plan.md](/Users/drmixer/code/ElevatEDNEW/docs/vision_plan.md)
- [family-ready.md](/Users/drmixer/code/ElevatEDNEW/docs/family-ready.md)
- [adaptive-phase1-implementation-plan.md](/Users/drmixer/code/ElevatEDNEW/docs/adaptive-phase1-implementation-plan.md)
- [product_polish_todo.md](/Users/drmixer/code/ElevatEDNEW/docs/product_polish_todo.md)
- [release-checklist.md](/Users/drmixer/code/ElevatEDNEW/docs/release-checklist.md)
- [src/services/assessmentService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/assessmentService.ts)
- [src/services/adaptiveService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/adaptiveService.ts)
- [src/lib/learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/src/lib/learningPaths.ts)
- [server/learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/server/learningPaths.ts)

---

## 1. Product Goal

The target experience is:
- a parent enters age and optionally current grade
- the system treats that input as a starting prior, not the final truth
- the student gets short subject diagnostics
- the platform estimates working level separately by subject
- the first path is built from those subject-level estimates
- later lesson, quiz, and practice evidence keeps adjusting the path
- AI helps explain and support the path, but does not act as an opaque grading authority

Example target outcome:
- student age `14`
- ELA working level `8`
- math working level `6`
- science working level `7`

That is feasible.

The repo should pursue it through a strong deterministic foundation first, then add AI on top.

---

## 2. Core Principles

1. Usefulness over novelty.
2. Deterministic level decisions before AI-driven level decisions.
3. Subject-by-subject placement instead of one global grade guess.
4. Explainable path updates that a parent can inspect.
5. Narrow first scope: Math and ELA before broader cross-subject adaptivity.
6. Home-learning tone: low-pressure, practical, and easy to resume.

Do not optimize first for:
- investor-style adaptive claims
- broad analytics
- fully AI-generated placement from scratch
- every subject at once

---

## 3. Current Repo Reality

What exists now:
- diagnostics and placement entry flow can start and resume
- assessment completion updates `student_mastery` and `student_progress`
- a `learning_path` can be written back to `student_profiles`
- suggestion plumbing exists for adaptive recommendations
- canonical path fallback exists for grade/subject sequences

What does not exist yet at the required level:
- age-first onboarding that converts age into an initial level prior
- first-class per-subject working levels such as `math_level` and `ela_level`
- a stable rule engine that promotes, reinforces, or backfills by subject over time
- proven live adaptive behavior in production telemetry
- a trustworthy continuous loop where performance repeatedly reshapes the curriculum

Practical reading of the current state:
- the repo has adaptive infrastructure
- the repo does not yet have a finished adaptive engine

---

## 4. Recommended Architecture

Build the adaptive system in four layers.

### Layer A. Placement Foundation

Inputs:
- age
- optional current grade
- optional parent goal focus

Outputs:
- expected grade band prior
- subject diagnostics to launch
- per-subject level estimate + confidence

Rule:
- age/current grade informs the initial guess
- diagnostic evidence decides the starting working level

### Layer B. Per-Subject Path Engine

Store subject state separately, not only one generic path blob.

Each in-scope subject should eventually track:
- current working level
- confidence
- weak strands
- recently mastered strands
- recommended next modules
- recent evidence window

### Layer C. Continuous Adaptation

Every lesson, quiz, and practice session should contribute evidence.

Initial promotion/remediation policy should stay deterministic:
- `>= 85%` twice at current level: advance
- `60-84%`: reinforce nearby content
- `< 60%` twice: backfill prerequisites

The system should prefer small, explainable adjustments over dramatic jumps.

### Layer D. AI Explanation Layer

Use AI for:
- plain-language explanation of the chosen next step
- hints and alternate explanations
- summarizing strengths and weaknesses
- proposing path adjustments for review

Do not use AI as the first authority on level placement until deterministic behavior is stable.

---

## 5. Phased Delivery Plan

### Phase 1. Subject Placement MVP

Scope:
- Math
- ELA

Goal:
- a new student can finish onboarding with separate Math and ELA working levels

Deliverables:
- collect `age` and optional `current_grade`
- map those to an initial expected band
- launch subject diagnostics around that band
- compute subject-level estimates from strand and skill evidence
- persist subject placement results
- generate first subject-specific paths from those results

Acceptance criteria:
- student can place into different levels for Math and ELA
- first dashboard/path reflects those levels
- path choice is explainable in plain language

### Phase 2. Subject State Model

Goal:
- replace generic one-shot pathing with stable subject state

Deliverables:
- create a dedicated per-subject state model
- track current level, confidence, weak standards, and recent evidence
- keep canonical path generation, but start from subject state instead of broad grade-band fallback

Acceptance criteria:
- subject placement survives across sessions
- path rebuilds from subject state, not only from static curriculum defaults

### Phase 3. Continuous Adaptation Loop

Goal:
- update next steps after real work, not only after onboarding

Deliverables:
- consume lesson checkpoint results
- consume quiz results
- consume practice results
- apply deterministic advance/reinforce/backfill rules
- record why a path changed

Acceptance criteria:
- after repeated success, the path gets harder
- after repeated struggle, the path inserts repair work
- changes are visible and understandable

### Phase 4. AI Support Layer

Goal:
- make the adaptive loop feel intelligent without making it opaque

Deliverables:
- “why this lesson?” explanations
- tutor references current struggles or strengths
- session summaries
- optional AI-suggested adjustments for review

Acceptance criteria:
- AI language matches actual student evidence
- AI never becomes the only explanation for a level change

---

## 6. Data Model Direction

The repo should move toward explicit per-subject learner state.

Recommended additions:
- `student_profiles.age` or equivalent onboarding age capture
- `student_subject_state` table or equivalent structured object

Suggested `student_subject_state` fields:
- `student_id`
- `subject`
- `expected_level`
- `working_level`
- `confidence`
- `diagnostic_completed_at`
- `weak_standard_codes`
- `mastered_standard_codes`
- `recent_accuracy`
- `last_relevel_at`
- `metadata`

This should coexist with legacy `student_profiles.learning_path` during migration, not replace it abruptly.

---

## 7. Repo Touchpoints

The likely first implementation touchpoints are:

- onboarding / placement orchestration:
  - [server/learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/server/learningPaths.ts)
- diagnostic load / scoring / profile update:
  - [src/services/assessmentService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/assessmentService.ts)
- adaptive suggestions / fallback path generation:
  - [src/services/adaptiveService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/adaptiveService.ts)
- canonical curriculum sequences:
  - [src/lib/learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/src/lib/learningPaths.ts)
- dashboards and rationale display:
  - [src/components/Student/StudentDashboard.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/StudentDashboard.tsx)
  - [src/components/Parent/ParentDashboard.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Parent/ParentDashboard.tsx)

---

## 8. MVP For One Student

For a home-use first release, the best milestone is:

1. parent enters age and optional current grade
2. student takes Math diagnostic
3. student takes ELA diagnostic
4. system estimates different levels by subject if needed
5. first path reflects those subject levels
6. after a few lessons, the platform can make small deterministic changes

That is enough to create genuine value for one learner without overbuilding the system.

---

## 9. What To Defer

Do not prioritize these until the foundation above works:
- all-subject adaptive placement
- fully AI-generated diagnostics
- AI-only level placement
- deep analytics or reporting polish
- advanced experimentation frameworks

The next high-value step after this doc is to turn Phase 1 into:
- schema changes
- service changes
- UI flow updates
- acceptance tests

That Phase 1 detail now lives in:
- [adaptive-phase1-implementation-plan.md](/Users/drmixer/code/ElevatEDNEW/docs/adaptive-phase1-implementation-plan.md)

This file should be the source of truth for adaptive foundation sequencing.
