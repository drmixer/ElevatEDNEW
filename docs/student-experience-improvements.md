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
- Content guardrails: reinforce “helper, not teacher”; list 1–2 cannot-do items (no cheating, no personal data collection) on the intro and the final card.
- Keep copy at ~5th-grade reading level; lean on icons and short labels vs paragraphs.
- Avoid avatar styles that look like real people; stick to abstract/animal/robot to reduce safety risk.

### Goals & success signals
- Students complete setup in <60s and start a first tutor interaction within the same session.
- ≥80% keep the default persona/avatar or choose intentionally (drop-off <10% after Step 2).
- At least one suggested question is clicked/typed in the first session; track as `tutor_onboarding_question_used`.

### Flow (happy path)
1) Intro card: “I can help with lessons, study tips, and motivation—but I don’t replace your teacher.” CTA: `Meet my tutor`.
2) Avatar/persona pick: grid of 3–4 options; each shows a short trait (“Calm,” “Step-by-step,” “Hype,” “Quiet expert”) with 1-line description.
3) Name step (optional): text input with examples beneath; show validation inline (length 2–18 chars; block profanity/PII).
4) Starter prompts: 2–3 “Try asking” chips plus one “I can’t help you cheat on tests” note; CTA `Start chatting`.

### UX & accessibility requirements
- Fully keyboard accessible: arrow/Tab/Enter navigation for the grid; focus states visible; `aria-live` for validation errors.
- Progress indicator (dots or “Step X of 4”) visible; allow Back and Skip (for name).
- If the student closes, resume at last incomplete step on next load.
- Support screen readers with concise labels (“Calm Coach persona: patient and encouraging.”).

### Settings entrypoint
- Add “Customize my tutor” button on the dashboard near the tutor widget. Opens the same flow with current selections prefilled.
- Persist tutor persona/name to the student profile; reflect persona tone in tutor prompt for subsequent chats.

### Validation & guardrails
- Block names with profanity/PII patterns (email, phone, full names); show a friendly inline message.
- Limit avatar set to those tagged “tutor-safe”; prevent switching mid-response to avoid tone whiplash.
- If the student skips naming, fall back to the persona label (“Your Calm Coach”).

### Instrumentation (events/props)
- `tutor_onboarding_started` (props: source=new|reset, grade_band, locale).
- `tutor_onboarding_step_completed` (props: step=intro|persona|name|prompts, persona_id, avatar_id, provided_name=true|false).
- `tutor_onboarding_completed` (props: persona_id, avatar_id, name_set=true|false, duration_sec).
- `tutor_onboarding_question_used` (props: question_id, persona_id) when a suggested question is sent.
- `tutor_persona_changed` (props: persona_id, avatar_id, name_set) when edited from “Customize my tutor.”

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

### Goals & success signals
- Students can say “I know what to do this week” within 1 glance (<5s).
- Plan completion correlates with +10–15% lesson completion vs baseline.
- <10% of students change the “feels” setting more than once per week (avoid fiddly controls); drop-off after opening card <5%.

### Plan structure (card)
- Header: “This week’s plan” with “Why this” tooltip (links to parent goals logic).
- Summary line: `{N} lessons • {M} minutes • focus: {Subject}`; auto-pulls from parent goals if set, else system baseline (default: 5 lessons / 60 mins / subject=diagnostic focus or “balanced”).
- Progress: small bar or checkmarks for lessons and minutes (2 rows: Lessons, Minutes). Show counts like `2/5 lessons`, `25/60 min`.
- Next action button: `Start next lesson` (links to recommended lesson; disabled if none).
- Secondary CTA: `Do quick practice` (optional if practice available).
- Status chip: “On track” / “Almost there” / “Behind” based on pace vs day-of-week (see logic).

### Student controls
- “This week feels:” segmented control with `Light / Normal / Challenge`.
  - Light: -20% target load, gentler tutor encouragement.
  - Normal: baseline.
  - Challenge: +20% target load, more upbeat tone nudges.
- “Focus:” chip list `Math / ELA / Science / Balanced`; default from diagnostic or parent goal; disable/lock if parent has a conflicting goal (show tooltip “Set by your parent”).
- “Why this plan?” link opens explainer: shows parent-set goal if present, current streak, last week activity.

### Logic
- Targets derive from parent goals when present; otherwise:
  - Lessons: default 5/week; Light = 4, Challenge = 6 (round up for older grades).
  - Minutes: default 60; Light = 45; Challenge = 75.
  - Focus: if diagnostic subject exists, use it; else balanced.
- Status (On track/Almost/Behind):
  - Compute expected lessons completed by day: `ceil(target * (day_of_week/7))` where Monday=1.
  - On track if completed >= expected; Almost if within 1; Behind otherwise.
- Nudge tone to tutor: pass `planIntensity` flag (light/normal/challenge) to tutor prompt to adjust encouragement wording only (no new content unlocks).

### Persistence & safety
- Store student preference for feels + focus on profile (non-PII). If parent goal exists, store student choice but mark `overridden=true`.
- Resume state per week (reset Monday 00:00 local).
- Do not allow the student to reduce below parent-required minimums; show a short note if parent goals override.

### UX/accessibility
- Fully keyboard accessible (segmented controls, chips). Visible focus ring.
- Keep copy at ~5th-grade reading level; avoid jargon (“minutes,” “lessons,” “focus”).
- Show tooltips in <16 words; include aria-label for status chip explaining on-track math.

### Instrumentation
- `weekly_plan_viewed` (props: source=dashboard, grade_band, parent_goal=true|false).
- `weekly_plan_intensity_changed` (props: from, to, parent_override=true|false).
- `weekly_plan_focus_changed` (props: from, to, parent_override=true|false).
- `weekly_plan_started_next` (props: lesson_id, subject, plan_status).
- `weekly_plan_status` emitted daily (props: lessons_target, lessons_done, minutes_target, minutes_done, status).

### Edge cases
- No lessons available: show empty state “Ask your teacher or parent for a new lesson” and disable CTAs.
- Diagnostic incomplete: show “Finish your diagnostic to get a plan” CTA instead of targets.
- Offline: show last cached plan with “May be out of date” badge; queue events.

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

### Goals & success signals
- Students see a clear “why” + “what next” in <5 seconds after a milestone.
- +10% uplift in returning the same day after a streak/level-up celebration (vs control).
- Dismissal <2 taps/clicks; <5% drop-off in proceeding to next recommended activity.

### Triggers
- Level-up (level increase event).
- Streak milestone (7, 14, 30 days).
- Avatar/ accent unlocked (student avatar progress).
- Mission completion (first completion of daily/weekly).

### UX pattern
- Lightweight modal or banner with confetti burst and short text:
  - Title: “You leveled up to {level}!” / “7-day streak!” / “New avatar unlocked: {name}.”
  - Cause line: “Because you finished 5 lessons this week.” / “You kept your streak.” / “You finished the weekly mission.”
  - Next step CTA: “Start your next lesson” (primary) + “Change avatar” (if applicable).
- Dismissible: Close button and ESC; focus trap; return focus to previous control when closed.
- Keep copy at ~5th-grade reading level; use icons/emoji for quick recognition.

### Data & rules
- Celebration payload: { kind: level|streak|avatar|mission, title, description, occurredAt, studentId?, prompt?, notifyParent? }.
- Show each celebration once per session; store seen ids locally to avoid repeats.
- Streak celebrations only at milestones (7/14/30-day); level-up only when level increases vs previous session.
- Avatar celebration only if unlocked during this session; mission celebration only on first completion per cadence.

### Implementation sketch
- Frontend:
  - Add `celebrationQueue` to student dashboard state; populate from dashboard data + client-side events.
  - Component: `CelebrationToast` (banner) and `CelebrationModal` (optional larger view) with props above.
  - Insert near top of dashboard content; auto-dismiss after 6s if not modal; pause on hover; allow “View details” for avatar (opens Avatar Lab) or mission (opens Missions section).
  - Confetti: lightweight canvas/confetti burst once per celebration type to avoid performance hits.
  - Accessibility: focus trap in modal; aria-live polite for banners; ESC closes.
- Backend:
  - Extend dashboard response to include pending celebrations (level/streak/avatar/mission) with `occurredAt`.
  - Derive streak milestones from `streak_days`; level changes from current vs stored level; avatar unlocks from student avatar status; mission completion from mission state.
  - Optionally log a `celebration_enqueued` server-side for audit.

### Instrumentation
- `celebration_shown` (props: kind, id, level, streak_days, avatar_id, mission_id).
- `celebration_dismissed` (props: kind, id, reason=auto|close|cta).
- `celebration_cta_clicked` (props: kind, id, cta=start_lesson|avatar|missions).
- `celebration_next_activity_started` (props: kind, id, activity_type=lesson|practice|avatar).

### Edge cases
- No recommended lesson: CTA changes to “View my journey.”
- Multiple triggers at once: queue and show sequentially; cap to 2 per load.
- Offline/cached: show only client-computable (streak/level) and avoid outdated mission/avatar triggers.

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

### Goals & success signals
- Younger learners (or parent-locked profiles) stay in guided mode 90%+ of the time without confusion.
- Prompt misuse/off-topic requests drop measurably for guided-mode students.
- Time-to-first-help after opening chat ≤10s with guided mode.

### Modes
- `guided_only`: Cards only; free-text input hidden until a card is selected.
- `guided_preferred`: Cards prominent; free-text available but secondary.
- `free`: Current behavior.
- Auto-select mode by grade and parent setting; allow parent override to force guided.

### Guided prompt set
- Base starters: “Explain this problem,” “Practice my weak area,” “Give me a study tip,” “Check my steps,” “Ask me a quiz.”
- Contextual starters (if lesson context exists): “Help with {lessonTitle},” “Review {subject} basics,” “I’m stuck on step 2.”
- Safety cards: “Something feels off,” which routes to a safety-aware response + adult reminder.

### UX behavior
- Guided mode shows cards grid; selecting a card:
  - Pre-fills prompt and shows clarifying questions (chips).
  - Opens chat with the prompt sent; focuses follow-up input (or keeps it hidden if guided_only until clarifier answered).
- Free-text input:
  - Hidden for guided_only until first card submit; then shown as “Ask a follow-up” with a character limit.
  - Dimmed but available for guided_preferred; always visible in free.
- Keyboard accessibility: cards focusable, Enter to select, ESC to deselect, aria-live for confirmations.
- Copy: 4–8 words per card; use icons/emoji for quick scanning.

### Backend/prompt handling
- Tutor system prompt receives `chatMode` (guided_only | guided_preferred | free) and should:
  - In guided modes, ask 1–2 clarifying questions before long answers.
  - Decline off-topic/personal requests; remind student to pick another card.
  - Keep answers shorter (2–3 steps) in guided modes.
- Log selected card id and clarifier responses with the chat thread.

### Controls & persistence
- Student profile flag: `chat_mode` default from grade (<=5 => guided_preferred; <=3 => guided_only) unless parent override.
- Parent dashboard toggle: “Guided prompts only” per child; writes to student profile.
- In-session toggle: students can’t loosen a parent-enforced mode; can switch between guided_preferred and free if allowed.

### Instrumentation
- `chat_mode_set` (props: mode, source=parent|student|auto, grade_band).
- `chat_prompt_card_selected` (props: card_id, mode, has_context=true|false).
- `chat_prompt_card_sent` (props: card_id, mode, context_subject, lesson_id).
- `chat_free_text_used` (props: mode, length, after_card=true|false).
- `chat_guided_guardrail_triggered` (props: reason=off_topic|safety).

### Edge cases
- No lesson context: fall back to base starters; hide contextual chips.
- Offline: show cached starter set; disable mode toggles.
- Safety violation: guided card with safety intent routes to safety responder and surfaces “ask an adult” note.

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

### Goals & success signals
- Students choose a mode in <10s before a session; >70% keep the same mode for the session.
- Mode selection correlates with appropriate content bias (catch-up → more remediation; challenge → more extension).
- No increase in session drop-off after adding the selector.

### Entry points & flows
- Dashboard: chip row sits directly above “Start next lesson”/plan card; defaults to last used; hint copy “Pick how you want to study today.”
- Tutor launch: if no mode set in last 7 days, lightweight prompt before the first reply; otherwise show the current mode pill with a “Change” link.
- Post-change confirmation: aria-live “Mode set to Catch up” and a short line under the CTA explaining what will change (e.g., “More review tasks today.”).
- Mobile: chips collapse into a segmented control with short labels; keep description in a single-line helper text.

### UX
- Entry chip row before starting a session or opening the tutor: `Catch up`, `Keep up`, `Get ahead`.
- Short descriptions (≤10 words) under each chip; default preselected to last choice.
- Mode banner in dashboard/tutor header showing current selection with a small “change” link.
- Keyboard accessible chips; aria-live confirm “Mode set to Catch up.”

### Behavior
- Catch up: bias recommendations toward weaker skills/review; tutor tone adds reassurance and remediation steps.
- Keep up: balanced recommendations; standard tone.
- Get ahead: bias toward extension/advanced practice; tutor tone adds upbeat stretch goals.
- Persist per student (profile field `study_mode`) with timestamp; auto-expire after 7 days of inactivity to re-prompt lightly.

### Defaults & persistence
- Default to `Keep up` on first use; remember `study_mode`, `set_at`, and `source` (prompt|dashboard|auto) on the profile.
- Respect parent/teacher constraints: if a parent goal forces remediation, allow display but disable switching to `Get ahead` (tooltip: “Set by your parent/teacher”).
- Expiry logic: if `last_active_at` older than 7 days, prefill last mode but nudge with “Still good?” toast; retain until student confirms or picks a new mode.

### Backend/tutor prompt
- Pass `study_mode` into tutor system prompt to adjust tone and what to prioritize (remediation vs extension).
- Recommendation engine uses mode to tweak weights (e.g., more practice for weak areas when catch-up).
- Bias rules:
  - Catch up → prioritize unmastered skills, recent misses, lower difficulty practice; soften tone and add reassurance.
  - Keep up → normal recommendation weights; neutral tone.
  - Get ahead → surface stretch lessons/practice that stay within allowed scope; upbeat, short “challenge” framing.
- Do not unlock gated/unsafe content; mode only adjusts ordering/wording.

### Instrumentation
- `study_mode_set` (props: mode, source=prompt|dashboard, grade_band).
- `study_mode_applied` (props: mode, lesson_id?, subject, recommendation_bias=remediation|balanced|extension).
- `study_mode_expired` when auto-reset after inactivity.
- `study_mode_prompt_shown` (props: surface=dashboard|tutor, reason=first_time|expired|manual_change).
- `study_mode_banner_viewed` (props: mode, surface=dashboard|tutor, parent_locked=true|false).

### Edge cases
- If parent sets a fixed goal, keep mode visible but disabled with tooltip.
- Offline: use last saved mode; queue change event.
- No recommendation inventory for the chosen mode: fall back to balanced ordering but keep tone; log `study_mode_applied` with `recommendation_bias=fallback`.

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

### Goals & success signals
- 50%+ of prompted students submit at least one reflection per week.
- Reflections stay <45s to complete; no measurable drop in lesson completion.
- Parents see 1–2 surfaced takeaways in digest (where allowed).

### Triggers & entry points
- Automatic prompts fire on: `hint_count` > threshold, session length >15–20 mins, repeated “I’m confused” intents, or end-of-lesson completion.
- Manual entry: dashboard “My takeaways” tile has `Add a reflection` chip; tutor can ask “Want to add a takeaway?” after a tough exchange.
- Cooldown: one prompt per 30 mins; skip if the student declined in the last 3 prompts or is in timed test mode.

### UX
- Trigger lightweight reflection card after: tricky lesson (multiple hints), long session, or tutor detects confusion.
- Card includes 1–2 prompts (dropdown or quick chips) and a free-text box limited to ~200 chars.
- “Skip” always available; “Save” stores locally + server.
- Dashboard “My takeaways” panel shows last 3 reflections (title + short text); link to parent digest if permitted.
- Mobile: single-card modal with stacked fields; on desktop, inline card anchored near tutor/chat area.
- Accessibility: focus trap in modal; aria-live for save/skip confirmations; Tab order places “Skip” before “Save.”
- Copy: simple labels like “What did you learn?” / “What will you try next time?”; keep hints <8 words.

### Data & logic
- Reflection payload: { question_id, response_text, lesson_id?, subject?, sentiment? }.
- Store in student profile table or separate `student_reflections` table (with RLS).
- Tutor can reference recent reflection snippets to personalize future nudges (safe, non-PII).
- Soft validation: 10–200 chars; trim whitespace; block PII/profanity with the existing text filter; show inline error if blocked.
- Surfacing: dashboard shows last 3 entries with relative time; parent digest uses anonymized/opt-in flag.

### Persistence & privacy
- Respect sharing settings per student: `share_with_parent` boolean; default off unless parent-enabled.
- If sharing off, parent digest shows count only (“2 new reflections”) without text.
- Provide “Hide from parent” toggle per reflection where allowed; reflect this in stored record.
- Retention: keep 90 days client-side cache; server retention per policy (configurable).

### Instrumentation
- `reflection_prompt_shown` (props: reason=hint_count|long_session|confusion, lesson_id, subject).
- `reflection_submitted` (props: question_id, length, lesson_id, subject).
- `reflection_skipped` (props: reason=skip|timeout).
- `reflection_share_toggled` (props: shared=true|false, source=prompt|dashboard).
- `reflection_panel_viewed` (props: surface=dashboard|tutor, count_shown).
- `reflection_referenced_in_tutor` (props: lesson_id?, subject?) when tutor pulls a prior reflection into tone or suggestion.

### Edge cases
- Privacy: do not show reflections to other users without consent; respect parent sharing settings.
- Offline: queue submissions; cap retries.
- If validation fails (PII/profanity), show a friendly inline block and keep input local only.
- If no recent lesson context, default prompts to generic learning reflection; omit subject labels.

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

### Goals & success signals
- Students can answer “what the tutor can/can’t do” correctly after viewing the panel.
- Reduction in inappropriate asks (cheating, PII) after showing explainer.

### Surfaces & triggers
- First-run: show after first tutor open (once per student), before first free-text message; dismissible.
- Guardrail: auto-open inline when a student asks for disallowed help; anchors to the message with a gentle reminder.
- On-demand: info icon in tutor header; also link from parent dashboard “How the tutor works.”
- Cooldown: do not auto-trigger more than once per session; after a guardrail trigger, suppress for 10 mins.

### UX
- Add “How this tutor works” info sheet accessible from tutor header (info icon).
- Content blocks with checkmarks/Xs: “I can help with…,” “I can’t…,” “Ask an adult if…”
- Optional short quiz (2 tappable statements) to reinforce understanding for younger students.
- Keep copy ≤6th-grade reading level; icons for quick scan.
- Layout: hero title + 3 columns/sections with icon + 2–4 bullets each; sticky footer buttons `Got it` (primary) and `Ask an adult` (secondary link).
- Quiz variant: two statements with `True/False` chips; show inline correctness and a one-line explanation; never block closing.
- Mobile: full-screen sheet with swipe-to-close; desktop: modal or slideout anchored to tutor.
- Accessibility: focus trap in modal; ESC/Back closes; aria-live on quiz feedback; ensure icons have `aria-hidden=true` with text labels present.

### Behavior
- Show once on first tutor use; remember dismissal; allow re-open anytime.
- If a student asks for disallowed help, surface the panel inline as a reminder.
- If the student is in guided-only mode, keep the explainer concise and emphasize “Ask an adult” instead of free-text caution.
- Age-aware copy: for younger grades, simplify wording and add “Ask a trusted adult if something feels wrong.”
- Parent-locked accounts: add line “Some features are set by your parent/teacher.”
- Do not block core actions; closing returns focus to the prior control; remember `last_dismissed_at`.

### Instrumentation
- `tutor_explainer_viewed` (props: source=header|guardrail, grade_band).
- `tutor_explainer_quiz_answered` (props: correct=true|false).
- `tutor_explainer_completed` (props: source=header|guardrail|first_run, quiz_shown=true|false, quiz_correct=true|false, age_band).
- `tutor_explainer_closed` (props: source, reason=got_it|x|backdrop|guardrail_auto_close).

### Edge cases
- Parent-locked accounts: ensure wording emphasizes adult involvement.
- Offline: cache explainer content.
- If guardrail fires repeatedly in one session, add a one-line reminder instead of re-opening the full panel.
- If accessibility setting `reduced_motion` is on, disable entrance animations.

---

## 9. Suggested implementation order

1. Tutor persona onboarding (name + tutor avatar) — builds on the work already implemented.
2. Weekly plan card + small “Today I want to…” mode selector.
3. Level-up / celebration moments for streaks, XP, and avatar unlocks.
4. Tutor persona presets tied to avatars and prompt variants.
5. Guided prompt mode for young learners / parent-restricted accounts.
6. Reflection prompts and “My takeaways” section.
7. Student-facing “How this tutor works” explainer panel.
