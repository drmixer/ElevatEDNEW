# Vision Implementation Plan

A concrete, phaseable plan to align the platform to the desired experience: personalized onboarding + adaptive learning + XP/rewards + parent visibility + avatar/tutor personalization.

---

## Phase 0: Foundations (data + services)
- **Status**: Completed. Core tables, catalogs, and service stubs are in place; subsequent phases build on them.

---

## Phase 1: Onboarding & Placement (make new students land on a personalized path)
- **UI flow**
  - Step 1: create/confirm account, collect name and grade_band, toggle AI opt-in.
  - Step 2: optional picks — avatar + tutor persona from catalogs (persist defaults if skipped).
  - Step 3: placement assessment launcher with resume support (save partial progress).
- **Backend**
  - `assessment/start`: return assessment id, items, and a token to resume.
  - `assessment/submit`: store responses, compute strand-level estimates, write a diagnostic event.
  - `PathBuilder`: generate `student_paths` + ordered `student_path_entries` immediately after submit.
  - Ensure student row is created/linked on first login and preferences are written.
- **Acceptance criteria**
  - A brand-new student finishes placement and immediately sees an “Up Next” list from their generated path.
  - Avatar/persona choices are persisted and retrievable.

---

## Phase 2: Adaptive Loop (lessons/practice/quizzes keep updating the path)
- **Instrumentation (frontend)**
  - Lessons: on complete → `student/event {lesson_completed, lesson_id, module_id, time_spent}`.
  - Practice: per answer → `practice_answered {question_id, correct, difficulty, standards[], time_spent}`.
  - Module quiz: on submit → `quiz_submitted {assessment_id, score, standard_breakdown}`.
- **Adaptive selection (backend)**
  - `AdaptiveSelector`: target accuracy band (e.g., 65–80%); pick next item using recent correctness, difficulty, and standard coverage.
  - Remediation: on two recent misses for a standard, insert a review entry (short lesson/snippet); on two consecutive correct at current difficulty, move difficulty up one notch.
- **Path maintenance**
  - Update entry status/attempts/time; append remediation/stretch entries; keep path ordered.
  - Prevent repeats: de-duplicate recently served items.
- **Tutor context**
  - Build prompt blocks: persona + last N attempts + misconceptions + target difficulty; include opt-in flag.
- **Acceptance criteria**
  - After practice/quiz, “Up Next” changes based on results.
  - Tutor feedback references current struggles or stretch goals (not static).

---

## Phase 3: XP, Streaks, Badges, Insights (make progress feel tangible)
- **XP/Badge rules**
  - Base XP per event type; bonuses for higher difficulty, streak continuation, first-try correct, no-hint completions.
  - Badges: first quiz passed, 3-day streak, 10 lessons completed, module mastery (avg score ≥ threshold).
  - Persist to `xp_ledger`; log `student_events` for awards.
- **Stats & insights**
  - Student stats: XP total, streak days, badges, avg accuracy, time on task per week, modules mastered, “focus standards.”
  - Parent overview: per child → progress %, latest quiz score, weekly time, alerts (struggle flag).
- **API surfaces**
  - `student/stats`, `parent/overview` return the above aggregates.
- **Acceptance criteria**
  - XP updates instantly after events; badges appear when criteria met.
  - Parent dashboard shows current progress/time/alerts without manual refresh.

---

## Phase 4: Personalization (avatars + tutor persona wired end-to-end)
- **Catalogs**: seed safe `avatars`; seed `tutor_personas` with tone, constraints, prompt snippets, sample replies.
- **Settings UI**: student can pick/update avatar/persona; writes to `student_preferences`.
- **Tutor integration**: `TutorContextBuilder` injects persona constraints and tone into system prompts; avatar drives UI only.
- **Acceptance criteria**
  - Changing persona changes subsequent tutor tone; avatar shows consistently in student UI.

---

## Phase 5: Frontend integration & polish (experience surfaces)
- **Lesson/Practice Player**
  - Render “Up Next” from `student/path`; drive navigation.
  - On completion/answer, POST `student/event`, refetch path, update XP/streak widget inline.
  - Tutor UI uses persona + shows avatar; offers hints aligned to difficulty targeting.
- **Dashboards**
  - Student: path progression, XP/streak/badges, “focus areas” insight chips, recent wins.
  - Parent: per-child cards (progress %, last quiz, weekly time, alerts); drill-down to module detail.
- **Hooks/services**
  - `useStudentPath`, `useXP`, `useTutorPersona`, `useParentOverview`, `useStudentStats` with proper caching/invalidation.
- **Acceptance criteria**
  - Refresh shows consistent path/XP state; no stale data after events.

---

## Phase 6: AI guardrails & adaptivity tuning
- **Difficulty control**: maintain rolling accuracy; bound difficulty jumps; cap repeats.
- **Misconception tagging**: classify common errors (per standard/question) and store in events; feed into next-item selection and tutor hints.
- **Safety**: enforce persona constraints; refusal patterns for unsafe/off-topic; rate-limit tutor calls; add timeouts/fallbacks.
- **Performance**: cache short-term context; bound prompt size.
- **Acceptance criteria**
  - Accuracy band stays near target; tutor refuses unsafe/off-topic asks; response latency within SLA.

---

## Phase 7: Observability & quality
- **Metrics**: path progression time per entry, drop-off points, XP accrual rate, tutor usage/latency.
- **Alerts**: flag “struggle” when consecutive misses exceed threshold; surface in parent/teacher dashboards.
- **Config/A-B**: config table for XP multipliers, difficulty targets, and hint policies to tune without redeploy.
- **Acceptance criteria**
  - Basic monitoring dashboards exist; struggle alerts visible; knobs adjustable via config.

---

## Quick checklist for implementation handoff
- [ ] (Phase 1) Build onboarding UI + placement API wiring; ensure path creation on submit.
- [x] (Phase 2) Instrument events; implement AdaptiveSelector; update path entries dynamically; wire tutor context.
- [ ] (Phase 3) Implement XP/badge rules, student/parent stats endpoints, and dashboards.
- [x] (Phase 4) Seed avatars/personas; add settings UI; inject persona into tutor prompts.
- [ ] (Phase 5) Integrate “Up Next” flow, XP widgets, and dashboards with new APIs/hooks.
- [ ] (Phase 6) Add guardrails, difficulty band tuning, misconception tagging, and rate limits.
- [ ] (Phase 7) Add observability, struggle alerts, and config-driven tuning.

Use this file as the source of truth; in a new chat you can hand me phases/items to implement, and I’ll execute against this plan. 
