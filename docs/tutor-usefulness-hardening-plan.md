# Tutor Usefulness Hardening Plan

## Purpose

The AI tutor is stable enough to expose to students, but it is not yet consistently useful as a teaching tool.

The main weakness is no longer reliability. The main weakness is instructional quality:

- answers are only lightly grounded in the active lesson/problem
- hint quality is inconsistent
- fallbacks are resilient but generic
- the system does not measure whether help actually helped

This document turns that diagnosis into an implementation plan that can be executed in small, testable slices.

## Product goal

Make the tutor reliably useful as a lesson-scoped hint tool.

Success looks like this:

1. A student asks for help inside a lesson.
2. The tutor sees the actual lesson or problem context.
3. The tutor gives a short, safe, instructionally useful next step.
4. If the model fails, the fallback is still lesson-aware and helpful.
5. We can measure whether the answer helped the student continue.

## Non-goals

This work is not intended to turn the tutor into:

- an open-ended companion chatbot
- a full autonomous teacher
- a free-form counseling surface
- a place to redesign the entire lesson UX

## Current state

### What is working

- The tutor request path is operational end to end through [`/api/v1/ai/tutor`](/Users/drmixer/code/ElevatEDNEW/server/api.ts:881).
- The client/server pipeline already has meaningful safety and ops instrumentation in [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts:1053) and [server/opsMetrics.ts](/Users/drmixer/code/ElevatEDNEW/server/opsMetrics.ts:1).
- The lesson player exposes the assistant in the primary learner flow in [src/pages/LessonPlayerPage.tsx](/Users/drmixer/code/ElevatEDNEW/src/pages/LessonPlayerPage.tsx:773).
- Local browser checks already show the supported tutor UX works mechanically.

### What is weak

1. The tutor is only lightly grounded.

- The backend mostly receives prompt text plus coarse learner metadata in [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts:743).
- It does not consistently receive the active lesson body, visible section text, worked example, practice item stem, answer choices, correct answer, or rubric.
- The model often has to infer from titles and subject labels instead of tutoring from the actual instructional artifact.

2. Prompt construction is thin and lossy.

- The client compresses recent chat into a short text block in [src/components/Student/LearningAssistant.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/LearningAssistant.tsx:758).
- The server then wraps that text in system prompts in [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts:761).
- This reduces turn fidelity and makes generic answers more likely.

3. The fallback path is resilient but not instructional enough.

- The UI falls back to canned profile-based responses in [src/components/Student/LearningAssistant.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/LearningAssistant.tsx:442).
- Those responses are encouragement-heavy and only weakly tied to the active task.

4. The current prompt strategy prefers "safe and short" over "diagnostic and useful."

- The default prompts strongly bias toward concise safe hints in [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts:285).
- That is directionally correct, but without stronger grounding it often yields bland low-information help.

5. There is no usefulness loop.

- Ops currently tracks success, error, safety, rate-limit, and latency outcomes.
- It does not track whether a response was grounded, whether the learner retried, or whether the answer helped them progress.

6. Model choice is not the primary bottleneck.

- The primary model is `google/gemini-2.5-flash` via OpenRouter in [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts:115).
- A model change may help later, but the main problem is weak context and no evaluation loop.

## Root causes

The tutor feels weak because of four architectural gaps:

1. Missing content grounding.
2. Weak response shaping around actual lesson state.
3. Generic fallback behavior.
4. No usefulness measurement loop.

## Principles

The implementation should follow these rules:

1. Lesson context beats prompt cleverness.
2. Structure beats lossy serialization.
3. Deterministic fallback is better than generic encouragement.
4. Hinting is the default; answer leakage must stay controlled.
5. Every quality improvement should be observable in telemetry or evals.

## Target request shape

The tutor request should move from a mostly free-text contract to a structured lesson-help contract.

Draft request shape for the first hardening pass:

```ts
type TutorHelpMode = 'hint' | 'break_down' | 'another_way' | 'check_thinking' | 'solution';

type TutorChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
};

type TutorProblemContext = {
  phase?: 'learn' | 'example' | 'practice' | 'review';
  subject?: string;
  moduleId?: string;
  lessonId?: string;
  sectionId?: string;
  sectionTitle?: string;
  visibleText?: string;
  questionStem?: string;
  answerChoices?: string[];
  learnerAnswer?: string | string[] | null;
  correctAnswer?: string | string[] | null;
  rubric?: string | null;
  workedExample?: string | null;
};

type TutorRequest = {
  helpMode: TutorHelpMode;
  messages: TutorChatMessage[];
  lessonContext: TutorProblemContext;
  learnerContext?: {
    gradeLevel?: string;
    readingLevel?: string;
    supportLevel?: 'default' | 'extra_scaffold';
  };
};
```

Notes:

- `correctAnswer` and `rubric` should only be supplied when the product already has them and when the prompt rules can still prevent answer leakage for hint-like modes.
- `visibleText` should be bounded. Send the current instructional slice, not the entire course.
- `helpMode` should be explicit and never inferred from prompt text when the UI already knows the intent.

## Workstreams

### Workstream A: Strong lesson grounding

#### Objective

Give the tutor the exact instructional artifact it is supposed to help with.

#### Changes

1. Expand lesson-context payloads from the lesson player to include:
- current phase
- current section title
- visible section text or summary
- current practice question stem
- answer choices
- learner answer if present
- correct answer
- explanation or rubric if available
- subject, module, lesson, and section IDs

2. Update the tutor open event payload so [`learning-assistant:open`](/Users/drmixer/code/ElevatEDNEW/src/components/Student/LearningAssistant.tsx:447) carries structured lesson context rather than only title-level metadata.

3. Update the tutor backend request contract in [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts:9) to accept structured lesson/problem context.

4. Build a dedicated grounding block on the server that separates:
- active lesson facts
- current task
- allowed help mode
- known correct answer or rubric
- learner attempt state

#### Dependencies

- Lesson player must expose the current instructional slice in a stable shape.
- Backend validation must tolerate partial context while still preferring structured fields over raw prompt text.

#### Exit criteria

- The backend prompt contains the current question or visible lesson section, not just the lesson title.
- The tutor can answer "help with this problem" using the actual problem text.
- Tests cover the new request shape and prompt-building path.

### Workstream B: Replace lossy chat serialization with structured messages

#### Objective

Stop flattening the conversation into a low-fidelity text blob.

#### Changes

1. Replace `promptForModel` string compression in [LearningAssistant.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/LearningAssistant.tsx:758) with a structured message array.

2. Send:
- recent user messages
- recent assistant messages
- explicit current learner intent
- explicit current help mode

3. Update [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts:743) so message construction consumes structured input rather than reconstructing turns from one merged string.

#### Dependencies

- Workstream A should land first so message structure and lesson context can be introduced together.

#### Exit criteria

- Multi-turn conversations preserve turns cleanly.
- Follow-up hints can reference prior exchange content without relying on lossy merged text.

### Workstream C: Make fallback actually instructional

#### Objective

Replace generic fallback copy with deterministic lesson-aware scaffolds.

#### Changes

1. Remove or sharply reduce reliance on [`getContextualResponse()`](/Users/drmixer/code/ElevatEDNEW/src/components/Student/LearningAssistant.tsx:442) for lesson tutoring.

2. Add deterministic fallbacks by subject/task type:
- math: next-step hint, worked-example template, error-check prompt
- reading/ELA: evidence prompt, sentence frame, summarize-and-cite prompt
- science: claim/evidence/reasoning scaffold
- social studies: sourcing, timeline, or cause/effect scaffold

3. When a correct answer or rubric exists, use rule-based scaffolds before motivational text.

4. Only use generic encouragement when no lesson/problem context exists.

#### Dependencies

- Best results depend on Workstream A. Fallback quality is still limited if the UI does not send actual lesson state.

#### Exit criteria

- Model failure still yields useful help tied to the current lesson/problem.
- Fallback responses are instructional, not just encouraging.

### Workstream D: Tighten tutor UX around lesson use

#### Objective

Make the supported usage path obvious and coherent.

#### Changes

1. Treat the lesson page as the primary tutor surface.
2. Avoid presenting the dashboard tutor as a general-purpose chatbot if the system is actually lesson-scoped.
3. Add explicit in-lesson help intents:
- Give me a hint
- Break this down
- Explain another way
- Check my thinking

4. Pass those intents directly into tutor request metadata.

#### Dependencies

- Depends lightly on Workstreams A and B so the new intents map to structured metadata.

#### Exit criteria

- Students use the tutor in clear lesson-linked ways.
- Fewer vague free-text prompts are needed to get a useful answer.

### Workstream E: Add usefulness telemetry

#### Objective

Measure helpfulness, not just uptime and safety.

#### Changes

1. Add tutor outcome events for:
- answered_in_lesson
- answer_reported
- learner_followed_hint
- learner_retried_after_hint
- learner_abandoned_after_hint

2. Add a lightweight thumbs-up/down or "Was this helpful?" signal on tutor answers.

3. Track whether a tutor answer was:
- AI direct
- deterministic fallback
- lesson-grounded
- problem-grounded

4. Add admin-facing snapshot slices for tutor usefulness, not just tutor success/error counts.

#### Dependencies

- Should align with the request metadata from Workstreams A, B, and D.

#### Exit criteria

- We can see whether tutor answers help learners continue, not just whether the request returned `200`.

### Workstream F: Create a real tutor eval set

#### Objective

Stop tuning blindly.

#### Changes

1. Build a curated prompt set from expected usage:
- I'm stuck
- Can you explain step 2?
- Why is this wrong?
- Give me a hint
- Explain another way
- Check my answer

2. Cover at least:
- math practice
- reading/ELA evidence or writing
- science explanation
- safety and off-topic prompts

3. For each case, define target behavior:
- grounded
- concise
- no answer leakage unless explicitly allowed
- no invented facts

4. Add a repo doc or fixture set that can be reused for regression review.

#### Dependencies

- Can begin in parallel with implementation, but should be finalized before any model or prompt comparison work.

#### Exit criteria

- We can compare tutor quality before and after grounding and fallback changes.

## Recommended implementation order

1. Workstream A: strong lesson grounding
2. Workstream B: structured messages
3. Workstream C: instructional fallback
4. Workstream D: lesson-first UX tightening
5. Workstream E: usefulness telemetry
6. Workstream F: eval set

## Phase plan

### Phase 1: Ground one path end to end

Scope:

- one lesson-player request shape
- one backend grounding path
- one subject-specific fallback path
- one test path

Recommended target:

- math practice, because it has clear question/answer structure and deterministic fallback options

Deliverables:

1. Lesson page sends structured current-problem context.
2. Backend validates and uses that context in model message construction.
3. Prompt rules preserve hint behavior without leaking full answers by default.
4. Deterministic math fallback exists for model failure.
5. Tests cover request shape and one grounded response path.

### Phase 2: Preserve conversation quality

Scope:

- replace string-compressed history with structured messages
- wire help-mode metadata explicitly
- ensure follow-up prompts remain grounded

Deliverables:

1. Structured message array from client to server.
2. Updated `buildMessages()` path for structured turns.
3. Regression checks for multi-turn hinting.

### Phase 3: Measure usefulness

Scope:

- user feedback
- learner behavior events
- admin reporting
- eval fixtures

Deliverables:

1. Helpfulness event taxonomy.
2. Lightweight response feedback control.
3. Tutor usefulness admin slice.
4. Repo-stored eval set for regression review.

## Risks and controls

### Risk: answer leakage

If correct answers or rubrics are passed to the model without tight mode rules, the tutor may reveal too much.

Control:

- gate answer exposure by `helpMode`
- default to hint-first prompts
- add eval cases for "student asks for full answer too early"

### Risk: oversharing lesson content

If the client sends whole lessons, payload size and prompt quality may degrade.

Control:

- send only the active instructional slice
- cap `visibleText`
- prefer focused summaries when the visible section is long

### Risk: fallback drift

Deterministic fallbacks can become stale or too generic if they are not tied to task type.

Control:

- keep fallbacks template-based and subject-specific
- reuse the same structured lesson context the model path receives

### Risk: telemetry without interpretation

Adding raw events alone will not tell us whether the tutor is better.

Control:

- pair event tracking with explicit grounded/fallback labels
- add a small eval set for before/after comparison

## Verification plan

For each slice, verify at three levels:

1. Contract tests
- client request shape
- backend validation
- prompt builder input/output expectations

2. Behavioral tests
- grounded hint for active problem
- no-answer-leak behavior for hint-like modes
- deterministic fallback tied to lesson context

3. Manual checks
- ask for a hint in a real lesson
- ask a follow-up question
- simulate model failure and confirm fallback quality

## First slice definition of done

The first slice is complete when:

- the lesson page sends structured current-problem context
- the tutor backend incorporates that context into model messages
- one subject path, ideally math practice, produces meaningfully more grounded hints
- a deterministic fallback exists for that same path
- tests cover the request shape and one grounded response path

## Next-session starting point

If continuing in a fresh chat, start here:

1. Implement Workstream A request-shape changes from lesson player to tutor backend.
2. Keep existing guardrails and ops events intact.
3. Do not redesign the whole tutor UI first.
4. Prefer a small vertical slice:
- lesson page payload
- backend contract
- prompt grounding
- one deterministic fallback improvement
