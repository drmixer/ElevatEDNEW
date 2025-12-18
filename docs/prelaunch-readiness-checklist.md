# Pre-Launch Readiness Checklist (ElevatED)

## Scope & intent
- Audience: internal product, eng, data, and ops.
- Goal: define the minimum bar to move from “working prototype” to “confident beta for real families.”
- Focused on: AI tutor, lesson delivery, parent dashboards, billing, and safety.

## Readiness gates
- Product experience: first session is guided, purposeful, and understandable to a non-technical parent.
- Safety & trust: clear guardrails, visible safety affordances, and basic review loops for issues.
- Operational: known runbooks for the most likely failures; logs and metrics wired.
- Content: enough coverage to avoid obviously “empty” paths for in-scope grades/subjects.
- QA: a small set of critical end‑to‑end flows exercised before launch.

---

## 1. First-run & core UX

### 1.1 “Meet your tutor” onboarding
- [x] Add a first-run flow for new student profiles (or after a major reset) that:
  - [x] Introduces the AI tutor in one screen (purpose + what it can/can’t do).
  - [x] Asks the student to:
    - [x] Pick a tutor avatar (from the tutor-only set).
    - [x] Optionally name the tutor (with clear examples and safety checks).
    - [x] Confirm their own student avatar or pick one.
  - [x] Shows a short preview: “Try asking me…” with 2–3 good starter questions.
- [x] Ensure this flow is skippable but easily re-opened from the student dashboard (e.g., “Customize my tutor” entry).

### 1.2 Weekly plan & “what’s next”
- [x] Add a “My week” card on the student dashboard that:
  - [x] Summarizes a simple plan (e.g., “5 lessons • 60 minutes • focus: Math”).
  - [x] Shows current progress vs plan with very simple visuals.
  - [x] Links to the recommended next lesson/practice.
- [x] Confirm that, after login, the student can:
  - [x] Reach their next recommended learning activity in ≤2 clicks.
  - [x] See a clear “why this next” explanation.

---

## 2. Safety, guardrails, and reporting

### 2.1 Tutor behavior & prompts
- [x] Lock in a single primary system prompt for the learning assistant that enforces:
  - [x] Structure for responses: quick check → 2–3 steps → recap → “tiny next action.”
  - [x] Hints-first behavior unless the student explicitly asks for a full solution.
  - [x] Age-appropriate phrasing per grade band (already partially implemented; confirm it’s used consistently).
- [x] Validate that safety filters cover:
  - [x] Basic PII patterns (emails, phone numbers, addresses).
  - [x] Obvious unsafe topics and prompt-injection patterns.
  - [x] Under-13 specific topics (e.g., no social/dating advice).

### 2.2 “Report answer” + review loop
- [x] Add a visible “Report this answer” affordance to the tutor UI with:
  - [x] Simple reasons (e.g., “incorrect,” “confusing,” “not school-safe”).
  - [x] Optional free-text field (capped length; no PII requested).
- [x] On report:
  - [x] Log the conversation ID, student id, reason, and the model’s answer.
  - [x] Flag the conversation in a lightweight review queue (start with a simple admin table + filter).
  - [x] Show a confirmation to the student with a reassuring message (“Thanks for flagging, an adult will review this.”).

### 2.3 Visible safety & privacy messaging
- [ ] Add a short “Safety & Privacy” panel accessible from:
  - [x] The tutor panel itself.
  - [x] Parent account settings.
- [x] Include:
  - [x] What the tutor can and can’t do.
  - [x] What data are stored and why (high level).
  - [x] How to contact support or report broader issues.
- [x] Confirm alignment with `docs/compliance.md` and `docs/family-ready.md`.

---

## 3. Parent controls & transparency

### 3.1 AI controls per learner
- [x] Expose at least the following toggles in the parent dashboard, per learner:
  - [x] “Allow AI tutor chats” (On/Off).
  - [x] “Limit open chat to lesson context only” (On/Off).
  - [x] Optional: “Soft limit on chats/day” (e.g., 0–5, within plan cap).
- [x] Ensure server-side enforcement:
  - [x] Tutor endpoint checks the per-learner flags before serving responses.
  - [x] UI shows a friendly explanation if a parent has disabled or limited the tutor.

### 3.2 Progress & coaching clarity
- [x] Extend the parent dashboard to include:
  - [x] Clear subject status cards (on-track / at-risk / off-track) using shared logic with `docs/family-ready.md`.
  - [x] 1–2 suggested “conversation starters” per week based on a child’s weak areas.
- [x] Confirm that:
  - [x] Status labels seen in the parent view match the student experience (no conflicting messages).
  - [x] Weekly digest emails (if enabled) reuse the same status and coaching snippets.

---

## 4. Content readiness

### 4.1 Minimum content footprint
- [ ] For each in-scope grade/subject (per `docs/family-ready.md`):
  - [ ] Define a “minimum viable coverage” (e.g., N modules per strand).
  - [ ] Ensure the canonical path never surfaces obviously thin/empty strands.
- [ ] Hide or down-rank:
  - [ ] Strands or modules below the defined content bar.
  - [ ] Any lessons flagged as experimental or low-quality.

### 4.2 Diagnostics and adaptation
- [ ] Confirm that:
  - [ ] Diagnostics exist for each in-scope grade/subject.
  - [ ] Diagnostic results are reliably written to the student profile.
  - [ ] Adaptive pathing uses those signals in the dashboard today.
- [ ] Add quick QA scripts / checks to validate:
  - [ ] Diagnostic → recommended path → first lesson → updated path flows end-to-end.

---

## 5. Operational readiness & monitoring

### 5.1 Metrics & logs
- [x] Implement or verify metrics for:
    - [x] Tutor success/error rate (by route and model).
    - [x] Safety-blocked tutor requests (per reason).
    - [x] Plan-limit hits for tutor usage (per plan).
    - [x] Supabase function / API failures for core routes.
- [ ] Expose a simple internal “ops dashboard” or logs view that aggregates:
  - [ ] Error rate over time with alert thresholds.
  - [ ] Top safety-block reasons.
  - [ ] Top routes causing failures.

### 5.2 Runbooks
- [x] Define runbooks for:
    - [x] AI provider degradation/outage (e.g., switch to fallback model, show “assistant unavailable,” keep lesson content usable).
    - [x] Supabase connectivity issues (what’s read-only vs broken, and how the UI degrades).
    - [x] Stripe or billing webhook failures (how to reconcile, what the user sees).
- [x] Store runbooks in `docs/deployment-runbook.md` or a linked doc, with:
    - [x] Who is on point for each type of incident.
    - [x] Quick commands / dashboards to check.

---

## 6. QA & test coverage

### 6.1 Critical end-to-end flows
- [ ] Cover at least these flows in automated or scripted E2E tests:
  - [ ] Parent signup → add learner → learner completes first lesson → learner uses tutor once.
  - [ ] Subscription upgrade/downgrade and enforcement of new tutor limits.
  - [ ] Unsafe chat scenario that triggers safety guardrails and allows reporting.
- [ ] For each flow, verify:
  - [ ] Events and logs are emitted as expected.
  - [ ] UI states match expectations (limits, safety messages, etc.).

### 6.2 Smoke tests before releases
- [ ] Maintain a short manual smoke-test checklist to run on staging before each release:
  - [ ] Sign in (parent + student) and visit dashboards.
  - [ ] Start a lesson, complete at least one checkpoint.
  - [ ] Send a tutor question and receive a safe response.
  - [ ] Trigger a billing action (or use a sandbox flow).
  - [ ] Verify basic accessibility for core screens (keyboard tabbing, focus states).

---

## 7. Launch decision & sign-offs

- [ ] Product sign-off that the first-run experience, weekly value, and clarity for parents meet the bar.
- [ ] Safety/compliance sign-off that the assistant behavior and reporting paths align with policy.
- [ ] Eng/Ops sign-off that monitoring, runbooks, and E2E coverage are sufficient.
- [ ] Data sign-off that key activation and usage KPIs can be measured without schema churn.
