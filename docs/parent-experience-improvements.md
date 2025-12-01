# Parent Experience Improvements (Controls, Coaching, Transparency)

## Scope & intent
- Audience: product/design/eng working on the parent dashboard and communications.
- Goal: make ElevatED feel trustworthy, understandable, and actionable for families by improving the parent-side experience.

---

## 1. AI controls per learner

### Problem
- Parents may want different levels of AI usage for different children and ages (or time windows), but today controls are mostly at the plan level.

### Proposal
- Add per-learner AI controls in the parent dashboard (on each learner tile and in a dedicated “Tutor settings” modal):
  - Toggle: “Allow AI tutor chats” (On/Off) — default On, constrained by plan.
  - Toggle: “Limit tutor to lesson context only” (On/Off) — default On for <13.
  - Input: “Max tutor chats per day” (number stepper; upper bound = plan limit).
- Server-side enforcement:
  - Extend tutor session creation to read the three flags per learner and hard-fail with a typed error (e.g., `tutor_disabled_by_parent`). Enforce age/consent gates defined in `docs/family-ready.md` (under-13 requires consent).
  - Log enforcement decisions for audit (`learner_id`, flag state, timestamp, request source).
  - Return a copy string for students: “Your grown-up turned off tutor chats for now. Ask them if you need it back on.”
- Visibility & feedback:
  - Show current limits and last changed timestamp in the parent UI.
  - Add a small “Saved” toast and inline error states for failed saves.

### Notes
- Keep defaults aligned with plan promises but allow parents to be stricter; never allow settings to exceed plan caps.

---

## 2. Progress clarity & status labels

### Problem
- Parents get numbers and charts, but may not have a clear “so what?” for each child and subject.

### Proposal
- Use a consistent trio of status labels per subject: On-track, At-risk, Off-track (as defined in `docs/family-ready.md`).
- On the parent dashboard:
  - Show a subject card with status, color chip, and 1–2 drivers (e.g., pacing deficit of -1.2 lessons/week; mastery <80% on checkpoints; diagnostic >45 days old).
  - Include a short inline explanation and a “See how we calculate this” tooltip that links to `docs/family-ready.md`.
- Alignment & validation:
  - Copy alignment: surface the same thresholds as `docs/family-ready.md` — baseline diagnostic ≤90 days; pacing: Math/ELA ≥2 lessons/week, Science ≥1/week; mastery: rolling ≥70%; At-risk if pacing missed 2 consecutive weeks or mastery <70% twice; Off-track if no lesson in 3+ weeks or diagnostic expired.
  - Centralize status computation in a shared service used by student and parent views; add a snapshot test to prevent divergence.
  - Reuse the same status text in weekly digest emails and push notifications.
  - Add analytics event `parent_status_card_viewed` with subject + status to measure comprehension experiments.

### Notes
- Avoid overly granular labels; clarity beats precision for parents.

---

## 3. Actionable coaching for parents

### Problem
- Parents often ask what they should *do* with the information; dashboards alone don’t give concrete, low-friction actions.

### Proposal
- For each child, surface 1–2 “coaching suggestions” per week on the parent dashboard:
  - Generate from weak skills and recent activity tags (e.g., “fractions,” “nonfiction main idea”); keep a max of 4 live suggestions per learner and rotate weekly.
  - Each suggestion should have: a 1-line action, estimated time (5–10 min), and a “Why” tooltip tied to a recent metric (e.g., “Checkpoint score: 62% on fractions”).
- Content reuse:
  - Insert the top suggestion into weekly digest emails and the “This week’s nudge” card.
  - Allow parents to mark “Done” or “Not relevant”; log response for future ranking.
- Ops/quality:
  - Maintain a vetted library of 50+ suggestions per subject/grade band; flag unvetted content.
  - Add a safety review checklist (no blaming tone, privacy-safe phrasing).

### Notes
- Keep copy short and non-judgmental. Make actions feel doable in 5–10 minutes.

---

## 4. Assignment & pacing controls

### Problem
- Some parents want more control over what their child works on next (within reason) without breaking the adaptive path.

### Proposal
- Enhance existing assignment tools so parents can:
  - Assign a recommended module/lesson directly from a subject card (pre-filtered to next 3 recommended items).
  - Adjust the weekly lesson target for each subject with a stepper (min 1, max plan cap).
  - See assignment states (Not started / In progress / Completed) with timestamps and completion evidence (checkpoint score or tutor chat count).
- Guardrails:
  - Keep assignments within one unit ahead of the adaptive path; show an inline warning and block anything further.
  - Warn if weekly targets exceed 125% of recommended pace and require explicit confirm.
- Mechanics:
  - Backend enforces guardrails and stores parent overrides with user and timestamp.
  - Add an audit trail of assignment actions and a parent-visible “Last updated by” line item.

### Notes
- Surface any conflicts clearly (e.g., “We’ll still respect the diagnostic path, but this assignment will show up as a priority for your child.”).

---

## 5. Safety & transparency surfaces

### Problem
- Parents may not fully understand how the AI tutor works, what data is stored, or how safety is enforced.

### Proposal
- Add a “Safety & Privacy” section in the parent dashboard that:
  - Summarizes what the AI tutor does and doesn’t do (bulleted, plain language).
  - Explains the main safety rules (e.g., “no personal contact info,” “no social/dating advice for under-13s”) with a link to the full policy.
  - States what data is stored and for how long at a high level, with a link to `docs/compliance.md`.
  - Links to detailed policy docs (privacy policy, data export/deletion steps).
- Provide a clear “Report a concern” path:
  - Inline button that opens a lightweight form (category, description, optional screenshot).
  - Routes safety issues to the trust queue and account/data concerns to support; send confirmation email with case ID.
  - Add an SLA note (“We respond within 1 business day.”).

### Notes
- Use plain language and avoid technical acronyms.

---

## 6. Notifications & weekly digests

### Problem
- Parents may not log into the dashboard regularly; email or push is often the primary touchpoint.

### Proposal
- Strengthen weekly digest emails and in-app summaries to:
  - Highlight status per subject (“On-track in math, At-risk in reading”) with the same explanations as dashboard.
  - Share 1–2 key wins (badge earned, module completed) with timestamp.
  - Include one small coaching action (see Section 3) with a “Mark as done” link that feeds back into ranking.
  - Include a quick view of tutor usage (e.g., “3/3 chats used; limit is 3”).
- In the app:
  - Mirror digest content in a “This week at a glance” card, refreshable without page reload.
  - Make status and suggestions clickable, deep-linking into the relevant child + subject view.
- Deliverability & preferences:
  - Add a notification preferences panel for email/push with per-channel toggles and preview text.
  - Track open/click and store per-parent “last sent” to avoid duplicate sends.

### Notes
- Keep frequency reasonable and let parents tune notification preferences.

---

## 7. Parent onboarding & education

### Problem
- New parents need clarity about what ElevatED is and how to use it with their child (without reading long docs).

### Proposal
- On first visit to the parent dashboard:
  - Show a short “tour” (3 steps) explaining:
    - Where to see progress and status (subject cards).
    - Where to set weekly expectations/goals (targets + assignments).
    - Where to manage AI controls and safety settings.
  - Store completion in local + server state to avoid re-showing unless “Replay tour” is clicked.
- Offer an optional “Parent guide” link that:
  - Explains key concepts (diagnostic, adaptive path, tutor) with 2–3 sentence blurbs.
  - Reassures around safety, data, and how to get help (links to Support and “Report a concern”).
  - Includes a 60–90 second video or GIF showing the dashboard basics.

### Notes
- Ensure the tour is skippable and easily re-opened from settings.

---

## 8. Suggested implementation order

1. Basic AI controls per learner (on/off + lesson-only + per-day cap) with server enforcement and student-facing copy.
2. Subject status cards with shared service for on-track/at-risk/off-track plus tooltip copy aligned to `docs/family-ready.md`.
3. Weekly coaching suggestions surfaced in dashboard + digest with “Done/Not relevant” feedback loop.
4. Safety & privacy section, policy links, and end-to-end “Report a concern” workflow with confirmations.
5. Enhanced assignments and pacing controls with guardrails and audit trails.
6. Strengthened weekly digests and “This week at a glance” card, plus notification preferences.
7. Parent onboarding micro-tour and short “Parent guide” with replay and guide link.

---

## API sizing notes (draft)
- Tutor enforcement (AI controls):
  - Extend tutor session creation endpoint to accept `allow_tutor`, `lesson_only`, `max_chats_per_day`, `age`, and `consent_state`.
  - Add plan-aware limiter to cap per-day chats; reuse existing rate-limit infra.
  - Emit typed errors for UI (“disabled_by_parent”, “plan_cap_reached”, “consent_required”) and include suggested copy tokens.
  - Add audit table or log stream for overrides and enforcement decisions (learner, parent, setting, timestamp, request_id).
- Assignment guardrails:
  - Assignment creation endpoint validates `target_lesson_id` is within 1 unit of adaptive path; rejects with “too_far_ahead”.
  - Weekly target update endpoint enforces plan cap and 125% pace warning flag.
  - Store parent overrides with `updated_by`, `updated_at`, `source` (web/app) for “Last updated” rendering and analytics.
  - Add state endpoints that return assignment status (not_started/in_progress/completed) plus evidence fields (checkpoint_score, tutor_chat_count).

---

## Coaching suggestion library (starter set)
- Math (grades 3–5):
  - “Fractions: Ask them to explain how they knew 3/4 is larger than 2/3. Time: 5 min. Why: Recent checkpoint 62% on fractions.”
  - “Word problems: Pick one word problem from today’s homework and have them underline the numbers and units. Time: 5 min. Why: Missed 2 story problems this week.”
  - “Multiplication facts: Race them on a 10-problem facts sheet; swap roles so they quiz you too. Time: 5 min. Why: Fluency speed slowed this week.”
- Math (grades 6–8):
  - “Ratios: Ask them to set up a proportion for a real scenario (e.g., doubling a recipe). Time: 7 min. Why: Ratio unit checkpoint at 68%.”
  - “Linear equations: Have them graph y = 2x + 1 on paper and label slope/intercept. Time: 8 min. Why: Missed slope questions in last lesson.”
  - “Integers: Practice adding a positive and negative number using a number line you draw together. Time: 6 min. Why: Tutor chats show confusion on negatives.”
- ELA (grades 3–5):
  - “Main idea: Read a short paragraph together and ask for a 1-sentence main idea. Time: 5 min. Why: Nonfiction main idea score dipped.”
  - “Vocabulary: Pick 3 new words from a book/article and have them create a quick sketch for each. Time: 7 min. Why: Low retention on vocab this week.”
- ELA (grades 6–8):
  - “Claim and evidence: After a short article, ask them to state the claim and 2 pieces of evidence. Time: 8 min. Why: Missed evidence questions.”
  - “Summaries: Have them text you a 2-sentence summary of what they read today. Time: 5 min. Why: Tutor chats show long answers without focus.”
- Science (grades 6–8):
  - “Experiments: Ask them to identify the variable and control in a simple scenario (e.g., growing plants). Time: 7 min. Why: Misidentified variables on quiz.”
  - “Data reading: Look at a simple chart (weather, sports stats) and ask what trend they see. Time: 6 min. Why: Recent chart-reading errors.”
  - “Vocabulary: Pick 2 key terms from the current unit and have them match term → definition → example. Time: 7 min. Why: Missed term definitions.”
