# ElevatED Product Polish Backlog
**Focus:** Make adaptivity, AI tutoring, and progress more visible and actionable for students and parents, building on the existing foundations.

---

## 1. Make the Personalized Path Feel Explicit

### 1.1 Diagnostic → Path narrative on Student Dashboard
**Goal:** Students understand that their path comes from their diagnostic, not a generic list.

**Implementation**
- In the student dashboard “Up Next” card, add a short, dynamic subtitle:
  - Example: “Built from your diagnostic results · start with this card.”
  - If strand/subject focus is known, include it: “Starting with Fractions because your diagnostic showed we can strengthen that area.”
- Use existing strand/weakness metadata from the placement and `student_paths.metadata` to populate a 1–2 phrase rationale.

**Acceptance criteria**
- After completing the diagnostic and landing on the dashboard, students see text that explicitly references “diagnostic” and at least one focus.
- Copy is present and accurate for all students with a generated path; falls back to a neutral line if data is missing.

### 1.2 “Why this next?” tooltip in Up Next
**Goal:** Explain why a specific entry is in Up Next.

**Implementation**
- On each Up Next card, add a small “Why this?” tooltip or info icon.
- Use entry metadata (`reason`, `target_standard_codes`, or `adaptive_state.misconceptions`) to show:
  - For placement entries: “From your placement – covers [strand/standard].”
  - For remediation: “Review on [standard/skill] based on recent misses.”
  - For stretch: “Stretch practice in [standard/skill] because you’ve been doing well.”

**Acceptance criteria**
- Every Up Next card has a “Why this?” explanation that varies based on entry reason (placement, remediation, stretch, baseline).
- Tooltip text never shows raw internal IDs; only user-facing labels.

---

## 2. Surface Adaptive Changes in Real Time

### 2.1 Inline “Plan updated” banners after events
**Goal:** Make adaptivity feel real right after lessons/quizzes/practice.

**Implementation**
- After `lesson_completed`, `practice_answered`, and `quiz_submitted` events:
  - When the dashboard reloads or path refetch completes, show a one-line banner near Up Next:
    - Example (high accuracy): “Nice work! We nudged your practice to a slightly harder level.”
    - Example (struggle): “We added a short review on [topic] to help you solidify that concept.”
- Use the `applyAdaptiveEvent` response (`misconceptions`, `targetDifficulty`, `next.reason`) to choose the copy variant.

**Acceptance criteria**
- After a meaningful event, at least one adaptive banner appears once (and then dismisses) for that page load.
- Banner references either difficulty change or review/stretch and does not repeat endlessly.

### 2.2 Adaptive difficulty indicator in lesson header
**Goal:** Make difficulty targeting visible during lessons.

**Implementation**
- In the lesson player header, add a small chip like:
  - “Difficulty: Gentle / Steady / Challenge (aiming for 65–80% correct).”
- Map `lessonDifficulty` and current adaptive difficulty (`targetDifficulty`) to one of 3 labels and update when practice completion syncs.

**Acceptance criteria**
- Lesson header shows a difficulty chip for students.
- Label updates on reload after difficulty changes; no hard refresh required.

---

## 3. Make Tutor Feel More Context-Aware

### 3.1 Tutor references current focus or struggle in answers
**Goal:** Tutor responses explicitly acknowledge strengths/weaknesses.

**Implementation**
- Extend the tutor system prompt to:
  - If `misconceptions[]` is non-empty, start with a short reference: “You’ve been working on [standard/skill]; let’s tackle it in small steps.”
  - If the learner has a clearly higher mastery subject, occasionally lean on it as an analogy: “You’re strong in reading – let’s use that to explain this math idea.”
- Keep references short and not overwhelming; at most 1 “you’ve been working on…” sentence per answer.

**Acceptance criteria**
- For a student with at least one tagged misconception, ~1 in 3 tutor replies includes a brief, accurate reference to that focus.
- No reply mentions internal IDs; only subjects/skills/standards that match what’s shown elsewhere in the UI.

### 3.2 Post-lesson tutor “summary” chip
**Goal:** Close the loop so the tutor feels like it’s tracking progress over a session.

**Implementation**
- After a lesson is marked complete, show a small summary card (e.g. on the dashboard or lesson completion screen):
  - “Today we practiced: [topic]. Next step: [review/stretch suggestion from adaptive context].”
- Generate the text from `adaptiveContext`: `recentAttempts` + `misconceptions` + `nextLesson`.

**Acceptance criteria**
- After a completed lesson with practice data, a summary appears once and references real topics/standards.
- For lessons without practice/standards, fall back to a generic compliment and next step.

---

## 4. Strengthen Parent Monitoring & Actions

### 4.1 Weekly “What changed this week?” per child
**Goal:** Give parents a simple snapshot instead of raw metrics only.

**Implementation**
- In the parent child card or a detail panel, add a weekly delta row:
  - “This week: +X lessons, +Y XP, Z min practice.”
  - If struggle flag is true: “Struggle flagged in [subject/standard].”
- Use existing weekly stats (`weekly_time_minutes`, lesson count, XP events) to compute changes vs previous week (even if approximate).

**Acceptance criteria**
- Each child with at least one week of data has a “This week” line with lessons, XP, and time.
- The presence of a struggle flag is clearly indicated in that summary.

### 4.2 One-click parent actions from struggle alerts
**Goal:** Let parents move from signal → action in one click.

**Implementation**
- On a child card with struggle alert, add small CTAs:
  - “Assign a review module” → opens prefiltered assignment dialog targeting subjects/standards in the alert.
  - “Encourage quick check-in” → triggers an email/tip or a simple recommendation snippet the parent can read to the child.
- Use existing assignment workflow and simply preselect subject/module suggestions.

**Acceptance criteria**
- For any child with a struggle flag, at least one actionable CTA is present near the alert.
- Clicking the CTA either opens the existing assignment flow prefilled, or presents a clear explanation if no matching content exists.

---

## 5. Tuning XP & Motivation

### 5.1 XP feel tuning via config presets
**Goal:** Make rewards feel satisfying with minimal engineering.

**Implementation**
- Define a few named config “profiles” for XP multipliers in `platform_config` (document them for admins):
  - “Conservative”, “Standard”, “Boosted”.
- In admin docs or UI helper text, explain how to set:
  - `xp.multiplier`, `xp.difficulty_bonus_multiplier`, `xp.accuracy_bonus_multiplier`, `xp.streak_bonus_multiplier`.
- Optionally, add a read-only “current XP profile” hint in Admin Ops panel (derived from current multipliers).

**Acceptance criteria**
- Admins can change XP feel by editing a small set of config keys, with understandable guidance.
- No code change is required to adjust XP intensity within reasonable bounds.

---

## 6. Small UX/Copy Enhancements for Perceived Adaptivity

### 6.1 Explain the loop in plain language (student + parent)
**Goal:** Make the adaptive loop explicit to users.

**Student dashboard copy**
- Add a short explainer line: “Your plan updates as you finish lessons and practice. Watch ‘Up Next’ change as you learn.”

**Parent dashboard copy**
- Add an explainer near the family overview: “The plan adapts based on your child’s quiz and practice—alerts show when it may be time to step in.”

**Acceptance criteria**
- Both student and parent surfaces include a one-sentence explanation of how the system adapts, without technical jargon.
- Copy mentions that the path and tutor respond to performance, not just time spent.
