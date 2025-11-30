# Parent Experience Improvements (Controls, Coaching, Transparency)

## Scope & intent
- Audience: product/design/eng working on the parent dashboard and communications.
- Goal: make ElevatED feel trustworthy, understandable, and actionable for families by improving the parent-side experience.

---

## 1. AI controls per learner

### Problem
- Parents may want different levels of AI usage for different children and ages (or time windows), but today controls are mostly at the plan level.

### Proposal
- Add per-learner AI controls in the parent dashboard:
  - Toggle: “Allow AI tutor chats” (On/Off).
  - Toggle: “Limit tutor to lesson context only” (On/Off).
  - Optional slider or input: “Max tutor chats per day” (capped by plan settings).
- Server-side enforcement:
  - Tutor API checks these flags along with plan limits.
  - When disabled, the student sees a friendly message explaining that their grown-up has turned the feature off and what to do if they have questions.

### Notes
- Keep defaults aligned with plan promises but allow parents to be stricter.

---

## 2. Progress clarity & status labels

### Problem
- Parents get numbers and charts, but may not have a clear “so what?” for each child and subject.

### Proposal
- Use a consistent trio of status labels per subject:
  - On-track, At-risk, Off-track (as defined in `docs/family-ready.md`).
- On the parent dashboard:
  - Show a small card per subject with status + 1–2 key drivers (e.g., pacing, mastery, diagnostic freshness).
  - Include a short explanation (“On-track: they’re completing recommended lessons and scoring well on checkpoints.”).
- Ensure:
  - The same status logic drives student and parent views (no mismatches).
  - Weekly digests and dashboards reuse the same labels and explanations.

### Notes
- Avoid overly granular labels; clarity beats precision for parents.

---

## 3. Actionable coaching for parents

### Problem
- Parents often ask what they should *do* with the information; dashboards alone don’t give concrete, low-friction actions.

### Proposal
- For each child, surface 1–2 “coaching suggestions” per week on the parent dashboard:
  - Based on weak areas and recent activity (e.g., “fractions” and “nonfiction reading”).
  - Examples:
    - “Ask them to explain one fractions problem they got right this week.”
    - “Read a short article together and ask them to summarize the main idea.”
- Reuse this content in:
  - Weekly digest emails.
  - A “This week’s nudge” box alongside status cards.

### Notes
- Keep copy short and non-judgmental. Make actions feel doable in 5–10 minutes.

---

## 4. Assignment & pacing controls

### Problem
- Some parents want more control over what their child works on next (within reason) without breaking the adaptive path.

### Proposal
- Enhance existing assignment tools so parents can:
  - Assign a recommended module/lesson directly from a subject card.
  - Adjust the weekly lesson target for each subject.
  - See whether assignments were started/completed and when.
- Guardrails:
  - Keep assignments near the recommended path (e.g., limit how far ahead they can push).
  - Show warnings if over-assigning might overload the learner.

### Notes
- Surface any conflicts clearly (e.g., “We’ll still respect the diagnostic path, but this assignment will show up as a priority for your child.”).

---

## 5. Safety & transparency surfaces

### Problem
- Parents may not fully understand how the AI tutor works, what data is stored, or how safety is enforced.

### Proposal
- Add a “Safety & Privacy” section in the parent dashboard that:
  - Summarizes what the AI tutor does and doesn’t do.
  - Explains the main safety rules (e.g., “no personal contact info,” “no social/dating advice for under-13s”).
  - States what data is stored and for how long at a high level.
  - Links to more detailed policy docs (e.g., privacy policy, `docs/compliance.md`).
- Provide a clear “Report a concern” path:
  - For issues with content or behavior.
  - For account/data concerns (e.g., deletion, export).

### Notes
- Use plain language and avoid technical acronyms.

---

## 6. Notifications & weekly digests

### Problem
- Parents may not log into the dashboard regularly; email or push is often the primary touchpoint.

### Proposal
- Strengthen weekly digest emails and in-app summaries to:
  - Highlight status per subject (“On-track in math, at-risk in reading.”).
  - Share 1–2 key wins (e.g., new badge, completed module).
  - Include one small coaching action (see Section 3).
  - Include a quick view of tutor usage (e.g., “3/3 chats used” for capped plans).
- In the app:
  - Mirror digest content in a “This week at a glance” card.
  - Make status and suggestions clickable, jumping into relevant child views.

### Notes
- Keep frequency reasonable and let parents tune notification preferences.

---

## 7. Parent onboarding & education

### Problem
- New parents need clarity about what ElevatED is and how to use it with their child (without reading long docs).

### Proposal
- On first visit to the parent dashboard:
  - Show a short “tour” (1–3 steps) explaining:
    - Where to see progress and status.
    - Where to set weekly expectations/goals.
    - Where to manage AI controls and safety settings.
  - Offer an optional “Parent guide” link that:
    - Explains key concepts (diagnostic, adaptive path, tutor).
    - Reassures around safety, data, and how to get help.

### Notes
- Ensure the tour is skippable and easily re-opened from settings.

---

## 8. Suggested implementation order

1. Basic AI controls per learner (on/off + lesson-only mode) with server enforcement.
2. Subject status cards with on-track/at-risk/off-track labels aligned to `docs/family-ready.md`.
3. Simple weekly coaching suggestions surfaced in dashboard + digest.
4. Safety & privacy section with clear language and a “Report a concern” path.
5. Enhanced assignments and pacing controls with guardrails.
6. Strengthened weekly digests and “This week at a glance” card.
7. Parent onboarding micro-tour and short “Parent guide.”

