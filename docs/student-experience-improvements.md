# Student Experience Improvements (AI Tutor + Dashboard)

## Scope & intent
- Audience: product/design/eng working on learner-facing UX.
- Goal: outline targeted improvements that increase clarity, motivation, and safety for students, on top of the current platform.

---

## 1. Tutor persona onboarding

### Problem
- The tutor is powerful but “faceless” until customized; students may not immediately feel ownership or understand how to use it well.

### Proposal
- Introduce a “Meet your tutor” sequence for new or reset students:
  - Step 1: A short intro card (“I can help with lessons, study tips, and motivation—but I don’t replace your teacher.”).
  - Step 2: Choose a tutor avatar from the tutor-only set (calm, structured, bold, etc.).
  - Step 3: Optionally name the tutor, with examples and validation (e.g., “Coach Sky,” “Nova,” “Study Buddy”).
  - Step 4: Show 2–3 suggested questions to ask and one example of what the tutor won’t answer (e.g., “I can’t help you cheat on tests.”).

### Notes
- Ensure the flow is kid-friendly (short, low reading burden) and fully keyboard accessible.
- Allow students to revisit this setup from the dashboard (“Customize my tutor”) to tweak name/persona later.

---

## 2. Weekly plan & focus card

### Problem
- Students currently see activities, missions, and XP, but not a single, easy-to-understand plan for the week.

### Proposal
- Add a “This week’s plan” card on the student dashboard that:
  - Shows a simple plan like “5 lessons • 60 minutes • focus: Math.”
  - Tracks progress visually (e.g., small progress bar or checkmarks).
  - Links directly to the next recommended activity.
- Allow students to nudge the plan with simple controls:
  - “This week feels: Light / Normal / Challenge.”
  - Use this setting to slightly adjust recommended load and tutor encouragement tone (within safe bounds).

### Notes
- Coordinate with parent goals so the child’s plan doesn’t fight parent-set expectations.

---

## 3. Level-up and celebration moments

### Problem
- XP, streaks, and badges exist but may feel abstract without explicit “you did it” moments that explain why something unlocked.

### Proposal
- Introduce lightweight celebration modals or banners when:
  - A student levels up.
  - They unlock a new avatar or avatar accent.
  - They complete a key mission (daily/weekly) for the first time.
- Each celebration should:
  - Clearly state what behavior caused it (“You kept a 7-day streak!”).
  - Suggest one specific next goal (“Try to keep the streak for 3 more days to…“).

### Notes
- Keep celebrations short and dismissible; avoid blocking the flow into the next recommended activity.

---

## 4. Richer tutor personas

### Problem
- The tutor can adapt via prompts, but students currently have only a single “tone” in practice.

### Proposal
- Offer 3–4 preset tutor personas tied to the tutor avatar set:
  - Calm Coach: slower, patient explanations; extra reassurance.
  - Step-by-Step Guide: very structured; emphasizes small steps and checks understanding often.
  - Hype Coach: more energetic, with more motivational language.
  - Quiet Expert (optional for older students): minimal fluff; concise, technical help.
- Each persona:
  - Maps to tweaks in the system prompt (tone + style).
  - Is clearly described to the student in 1–2 sentences before selection.

### Notes
- Let students switch personas occasionally (e.g., via settings) but not mid-response.

---

## 5. Guardrails for open-ended chat

### Problem
- Free-text chat is powerful but can be overwhelming for younger learners and increases safety surface area.

### Proposal
- For younger grades (or when a parent enables it), add a “guided prompts only” mode:
  - Show pre-written question starters (e.g., “Explain this problem,” “Practice my weak area,” “Give me a study tip”).
  - Hide or de-emphasize the free-text input until a card is chosen.
  - Let the tutor ask clarifying questions after a card is selected.
- Maintain the normal free-text mode for older learners or when parents allow it.

### Notes
- Reuse the existing quick actions but expand the library based on lesson context and recent activity.

---

## 6. Study routine & focus modes

### Problem
- Students often don’t know whether they’re “catching up,” “keeping up,” or “getting ahead.” The experience feels same-y across these scenarios.

### Proposal
- Add a simple “Today I want to…” selector before a session:
  - Catch up on things I missed.
  - Keep up with my plan.
  - Get ahead for a challenge.
- Use this choice to:
  - Slightly bias recommendations (e.g., more remediation vs extension).
  - Adjust tutor copy (“Since you’re catching up today, let’s review…“).

### Notes
- Persist the last choice to avoid nagging; let the student adjust as needed from the dashboard.

---

## 7. Reflection prompts & metacognition

### Problem
- The tutor provides help but may not consistently prompt students to reflect on what they learned or how they approached problems.

### Proposal
- Occasionally (e.g., after a tricky lesson or several hints), have the tutor ask:
  - “What’s one thing you’d try differently next time?”
  - “What tip would you give a friend stuck on this?”
  - “How confident do you feel about this topic now? (Low / Medium / High)”
- Store reflections lightly:
  - Show a small “My takeaways” panel in the student dashboard.
  - Optionally surface anonymized patterns for parent or teacher coaching.

### Notes
- Make reflection optional and short; avoid turning it into a second homework assignment.

---

## 8. Transparency and expectations for students

### Problem
- Students may attribute too much “authority” to the AI tutor or misunderstand its role.

### Proposal
- Add a brief, student-facing explainer accessible from the tutor UI:
  - “I’m a learning assistant, not your teacher.”
  - “I can: explain things, give hints, help with practice.”
  - “I can’t: guarantee grades, replace your teacher, or decide your school work.”
  - “If something feels wrong, ask a trusted adult.”

### Notes
- Keep language simple and visually support with icons (checkmarks and Xs).

---

## 9. Suggested implementation order

1. Tutor persona onboarding (name + tutor avatar) — builds on the work already implemented.
2. Weekly plan card + small “Today I want to…” mode selector.
3. Level-up / celebration moments for streaks, XP, and avatar unlocks.
4. Tutor persona presets tied to avatars and prompt variants.
5. Guided prompt mode for young learners / parent-restricted accounts.
6. Reflection prompts and “My takeaways” section.
7. Student-facing “How this tutor works” explainer panel.

