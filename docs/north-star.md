# ElevatED North Star (Source of Truth)

Last updated: January 2026

This document is the product + implementation “north star” for ElevatED: a guided, adaptive learning experience that requires demonstrated understanding (not passive reading).

If anything in the codebase conflicts with this doc, treat the code as “current state” and this doc as “target state”, then create an explicit migration plan rather than silently drifting.

Related source docs:
- `docs/north-star-v1.md` (high-level philosophy)
- `docs/north-star-v2.md` (implementation specification)

---

## 0) How To Use These Docs (Governance)

### 0.1 Source-of-Truth Hierarchy

When making product/engineering decisions, use this hierarchy:

1. `docs/north-star.md` (THIS FILE) — **repo-fit source of truth**
2. `docs/north-star-v2.md` — reference implementation spec (idealized)
3. `docs/north-star-v1.md` — vision + principles (high-level guardrails)
4. Code + DB schema — current state (what exists today)

If there’s a conflict:
- V1 vs V2: prefer V1 for “what should be true”, V2 for “one way to implement”.
- V2 vs our actual DB/app: adapt V2 and record the adaptation here (Section 7–8), rather than silently improvising in code.

### 0.2 Change Control (Prevent Drift)

Any meaningful change to the learning loop, step schemas, gating rules, or storage should:
- Update this doc first (or in the same PR) with a short Decision Log entry.
- Prefer incremental migrations over table replacements unless there’s a measured need.
- Keep backwards compatibility during rollouts (feature flags / dual-read where needed).

---

## 1) Core Philosophy

ElevatED is an AI-assisted learning platform built around **guided understanding**, not passive consumption. Learning is modeled as an **interactive teaching conversation** that continuously checks, responds, and adapts to the learner.

The goal of every session is simple:
**ensure the learner actually understands before moving on.**

Principles:
1. Teaching always comes first — but only in small, purposeful doses.
2. Understanding must be demonstrated, not assumed.
3. Practice is not separate from learning — it *is* learning.
4. Adaptation happens in real time, based on learner responses.
5. Progress is gated by understanding, not by reading or time spent.

ElevatED does not deliver lectures. It delivers **guided learning experiences**.

---

## 2) Learning Loop (Conceptual Model)

Learning is driven by a Session Engine and repeated micro-cycles until mastery:

1. **Teach** (micro-teaching)
2. **Check** (immediate understanding check)
3. **Respond** (feedback + re-teaching if needed)
4. **Adapt** (decision engine chooses next action)
5. **Apply** (deeper use; confirms durable understanding)

Implementation note: in the detailed spec, **Respond** and **Adapt** are handled as logic within “check/apply” steps rather than separate learner-visible steps.

---

## 3) Session Engine (Detailed Model)

### 3.1 Step Types (Learner-visible)

To keep authoring and rendering simple, the engine uses three learner-visible step types:
- `teach`: introduce exactly one concept (3–6 sentences + one concrete example)
- `check`: verify understanding of the preceding teach step (multiple choice, true/false, or short answer) with embedded feedback + adaptation rules
- `apply`: application / transfer task (word problem, explain-your-thinking, comparison) with feedback and light adaptation

### 3.2 State Machine (Engine-internal)

`INITIALIZED → TEACHING → CHECKING → ADAPTING → [APPLYING] → COMPLETE`

With failure paths:
- `RETEACHING` (variation teach content, then retry check)
- `TUTOR_INTERVENTION` (mandatory help when stuck threshold is hit)

### 3.3 Adaptation Rules (Default Policy)

For a `check` step:
- Correct on first attempt → advance (`next_concept` or `apply_step`)
- Incorrect on first attempt → reteach/hint and retry
- Incorrect on second attempt → tutor intervention (or simplify / skip-with-flag)
- Correct after reteach → advance (`next_concept` or `apply_step`)

For an `apply` step:
- Correct → `next_concept`
- Incorrect → provide hint / simplify / optionally escalate to tutor (depending on subject + grading type)

### 3.4 Tutor Role (Proactive)

The tutor is not “a chatbot on the side”. It is a proactive instructor that:
- intervenes when confusion is detected (attempt thresholds, hesitation, repeated misconception patterns)
- re-explains concepts in different styles
- answers “why/what-if” contextually
- accelerates confident learners (skip-ahead/challenge mode)

---

## 4) Content Standards (Authoring)

### 4.1 Teach Step

Rules:
- 3–6 sentences (≈ 75–150 words)
- exactly one core concept
- one concrete example
- conversational tone; no hidden prerequisites

Recommended content fields:
- `text` (micro-teaching)
- `example` (concrete)
- optional `key_terms` (vocabulary)
- optional `visual_aid_url`

### 4.2 Check Step

Rules:
- directly tests only what was just taught
- minimal cognitive load; no trick questions
- diagnostic wrong answers (when multiple choice)
- always required (never skippable)

Must include:
- the question (and options / validation rules)
- feedback for correct and incorrect responses
- adaptation rules for first/second attempts

### 4.3 Apply Step

Rules:
- tests transfer and reasoning (not recognition)
- can include open-ended explanation (prefer a rubric)
- if subjective grading is required, use an LLM rubric grader with a robust fallback path

---

## 5) Progress, Mastery, and Gating

- Learners progress only after reaching a mastery threshold.
- Mastery is determined by consistent correct reasoning, not a single answer.
- There is no “read and move on” path.

Minimum mastery heuristics (initial defaults):
- Concept mastered when `check` is correct on first attempt, or correct after a single reteach + retry.
- Flag “needs review” when:
  - repeated incorrect attempts (≥ 2) *or*
  - apply step shows weak reasoning even if answer is correct.

---

## 6) Current Content Setup (Jan 2026) vs Target

### 6.1 Current State (in this repo)

Today the app is primarily:
- Lesson bodies stored in Supabase `public.lessons.content` as markdown-ish text and rendered as markdown in the “Learn” phase.
- Practice questions pulled from `question_bank` when available; many lessons can end up effectively read-only if there are no aligned questions.
- `public.lesson_steps` exists in the database but is not the primary driver of the lesson player UI yet.

### 6.2 Target State

Target is a server-driven session engine that renders typed steps (`teach`/`check`/`apply`) and gates progress on demonstrated understanding, using persisted step/session state so learners can resume.

### 6.3 Migration Approach (Recommended)

1. **Guarantee checks**: add required checkpoints per learn section even when no authored questions exist (generated or templated).
2. **Introduce typed steps**: expand `lesson_steps` (or add a new table) to store JSON content for teach/check/apply; keep markdown as a legacy input that can be transformed.
3. **Session persistence**: introduce session + per-step progress storage (either new tables or mapping to existing events/progress tables).
4. **Adaptation policy**: implement a small deterministic decision tree first; add LLM-powered grading only where needed.

---

## 7) Repo-Fit Schema Mapping (V2 → Our Current DB)

This section is the explicit “fit V2 to our setup” layer.

### 7.1 Sessions

V2 concept: `lesson_sessions` (resume state, status, current step).

Repo-fit approach:
- Use `public.practice_sessions` as the session record for lesson playback (it already includes `lesson_id`, timestamps, and `metadata jsonb`).
- Store session engine fields inside `practice_sessions.metadata` (example keys):
  - `engine_version` (number)
  - `current_step_id` (bigint)
  - `state` (`initialized|teaching|checking|reteaching|applying|tutor_intervention|complete`)
  - `variant` (A/B bucket), `flags` (array), `last_step_started_at` (timestamp)

Create a dedicated `lesson_sessions` table only if practice-only sessions and lesson-engine sessions must diverge strongly (different RLS, different lifecycle, different analytics).

### 7.2 Steps (teach/check/apply)

V2 concept: `lesson_steps` with `step_type`, `content jsonb`, `metadata`, `dependencies`, `micro_concept_id`, global order.

Current repo state:
- We already have `public.lesson_steps (lesson_id, step_number, prompt_text, expected_answer jsonb, ...)` but it does not encode teach/check/apply or rich JSON content.

Repo-fit approach:
- Evolve `public.lesson_steps` in-place instead of replacing it:
  - Treat `step_number` as the global `order_index`.
  - Add fields needed for V2 step types and content:
    - `step_type` (`teach|check|apply`)
    - `content jsonb` (typed payload per step type)
    - `micro_concept_id` (int)
    - `dependencies bigint[]` (optional)
    - `metadata jsonb` (estimated seconds, difficulty, tags)
- Keep `prompt_text`/`expected_answer` temporarily for backward compatibility (or migrate them into `content` and deprecate).

### 7.3 Per-step progress (gating + resume)

V2 concept: `learner_step_progress` (attempts, response history, completion).

Repo-fit approach:
- Keep `public.practice_events` as the append-only event log for analytics/debugging.
- Add a step-level summary table for fast gating/resume (recommended), e.g.:
  - `student_lesson_step_progress (student_id, lesson_id, step_id, attempt_count, responses, is_complete, completed_at, confidence_level, updated_at)`
- Alternatively, derive everything from events, but it will be harder to gate reliably and more expensive to query at runtime.

### 7.4 Legacy lesson content (markdown)

Keep `public.lessons.content` as:
- legacy display fallback (if no typed steps exist yet)
- migration input (transform markdown sections → initial teach/check/apply steps)

Do not delete until all content is migrated and the player no longer reads it.

---

## 8) Decision Log (Template)

Add a new entry whenever we change learning behavior, schemas, or gating rules.

### Decision YYYY-MM-DD: <short title>

- **Status**: proposed | accepted | shipped | reverted
- **Context**: what problem are we solving; what data/feedback triggered this
- **Decision**: what we’re doing (specific, testable)
- **Options considered**: 2–3 bullets (include “do nothing”)
- **Consequences**:
  - **Pros**
  - **Cons / Risks**
  - **Rollout plan** (flag, migration, backfill)
- **Success metrics**: which KPIs move and how we’ll measure
- **Owner**: <name>

---

## 9) Working Workflow (How We Implement Against This)

When building a feature in the learning engine:
1. Confirm it aligns with Core Philosophy (Section 1) and learning loop (Sections 2–5).
2. Update `docs/north-star.md` first with any new rules/schemas and add a Decision Log entry (Section 8).
3. Implement in small increments:
   - start with deterministic logic; add LLM grading only where required
   - preserve backwards compatibility while content migrates
4. Instrument the key events/metrics listed in Section 10.

---

## 10) Success Metrics (Initial Targets)

Learning effectiveness:
- Mastery rate (concepts mastered vs flagged): target > 85%
- First-attempt accuracy on checks: target > 70%
- Reteach effectiveness (success after reteach): target > 80%
- Tutor intervention rate: target < 20%
- Session completion rate: target > 75%
- Time to mastery vs estimate: within 20%

Engagement:
- Active learning time: target > 80% of session time
- 48h return rate: target > 60%

---

## 11) Non-Goals (Guardrails)

ElevatED is not:
- a markdown reader
- a slide deck
- “lesson first, quiz later”
- optional practice
- passive learning
