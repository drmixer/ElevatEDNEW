# Pilot Improvements Plan (Grade 2 Math — Perimeter)

Scope: implement the **easy + medium feasibility** items for the Perimeter pilot in a repeatable way (so the same pattern can be applied across other K–5 math lessons).

Pilot lesson: `Intro: Perimeter (intro) (Grade 2)` (e.g. `/lesson/848`)

Non-goals (for this pilot):
- drag-and-drop “draw the perimeter”
- fully animated tracing UI
- room-illustration “shape hunt”
- audio/TTS pipeline

---

## Success Criteria (Pilot)

The pilot is “good” when:
- Checkpoints are **relevant, varied, and stable** (no repeats, no 502 dead-ends).
- Practice questions are **specific, scaffolded, and show steps**.
- Visuals are present in the Learn and Practice phases when useful (SVG).
- If AI tutor is down or rate limited, the lesson still works with deterministic fallbacks.

---

## Phase 0 — Instrument + Guardrails (Easy)

1. Add basic client telemetry for lesson interactions:
   - checkpoint generated (ai vs fallback)
   - checkpoint passed/failed
   - practice correct/incorrect
   - “show steps” clicked
   - “hint” clicked

2. Add deterministic fallbacks for:
   - checkpoints (already present for perimeter)
   - practice questions (already present for perimeter)
   - hints (to implement in Phase 2)

Owner notes:
- Prefer `trackEvent(...)` where the app already uses it.

---

## Phase 1 — Visuals v1 (Easy → Medium)

Goal: add consistent, license-safe visuals without manual sourcing.

1. Expand SVG generator coverage for perimeter:
   - rectangle/square already supported
   - add triangle (labeled sides) as a simple static SVG

2. Display visuals in Learn phase:
   - already implemented for perimeter sections
   - ensure longer measurements map to longer sides (already fixed)

3. Add “visual cards” for Practice questions:
   - each practice question can optionally render an SVG above the prompt
   - for perimeter pilot: generate SVG matching the numbers in the question

Files to touch (likely):
- `src/lib/lessonVisuals.ts`
- `src/components/Lesson/phases/LearnPhase.tsx`
- `src/components/Lesson/phases/PracticePhase.tsx`

---

## Phase 2 — Practice v2 (Medium)

Goal: practice feels like “learn-by-doing”, not generic coaching prompts.

1. Scaffold practice sequence:
   - definition (what perimeter measures)
   - square (equal sides)
   - rectangle (two pairs)
   - triangle (three sides)

2. Add “Show steps” for perimeter questions:
   - reveal a step-by-step addition breakdown (e.g., `4+2=6 → 6+4=10 → 10+2=12`)
   - keep steps short (Grade 2)

3. Add hints before answering:
   - hint text is deterministic for perimeter:
     - “Perimeter means add all side lengths.”
     - “Count the sides, then add them.”
   - if tutor is available, optionally enhance with tutor hint (but never require it)

4. Ensure correct option is not always A:
   - shuffle options but keep `isCorrect` mapping

Acceptance checks:
- Practice questions always refer to the lesson concept and include numbers.
- Hints do not reveal the answer letter.
- “Show steps” helps without overwhelming.

Files to touch (likely):
- `src/pages/LessonPlayerPage.tsx` (pilot question generation and/or gating)
- `src/components/Lesson/phases/PracticePhase.tsx` (UI for hint/steps/visuals)

---

## Phase 3 — Checkpoints v2 (Medium)

Goal: checkpoints are relevant and non-repetitive.

1. Add “checkpoint intent” rotation per section:
   - `define` → `compute` → `scenario`

2. Improve AI prompt constraints:
   - enforce “must include numbers” for `compute` (when present in section)
   - forbid generic coaching content (“study strategies”, “ask for help”, etc.)

3. Add deterministic checkpoint variants for perimeter:
   - definition question
   - compute from the section’s concrete example
   - scenario (string/fence around an object)

4. Cache per-lesson checkpoints locally (per session):
   - avoid re-generating the same checkpoint on re-render

Files to touch (likely):
- `src/components/Lesson/phases/LearnPhase.tsx`

---

## Phase 4 — Light Adaptation (Medium)

Goal: if a student struggles, the experience responds without breaking flow.

1. Simple remediation trigger:
   - if checkpoint wrong twice OR practice misses ≥ 2
   - show a “Quick Review” card:
     - 1 sentence definition
     - 1 small visual
     - 1 easier question

2. Simple acceleration:
   - if perfect streak (e.g., 3/3 correct first-try)
   - offer 1 optional “challenge” question (still Grade 2 safe)

Files to touch (likely):
- `src/components/Lesson/phases/LearnPhase.tsx`
- `src/components/Lesson/phases/PracticePhase.tsx`

---

## Phase 5 — UX Readability (Easy)

Goal: reduce cognitive load for 2nd graders.

1. Increase whitespace and font sizing in practice/checkpoint cards
2. Keep option text short; break long prompts into 2 lines max
3. Consistent color coding for shapes:
   - square: green
   - rectangle: indigo
   - triangle: amber

---

## Rollout Strategy

1. Keep everything behind the existing pilot condition:
   - subject includes “math” AND grade band is `2` AND lesson title includes “perimeter”

2. When pilot is solid:
   - generalize to other Grade 2 math lessons (expand SVG/hints generators)
   - then broaden to `K–5` with pattern-based visuals (number lines, arrays, fractions)

---

## Next Pilot Candidates

After Perimeter:
- time & money (clock + coin SVGs)
- length/weight/capacity (ruler scale SVGs + measuring containers)

