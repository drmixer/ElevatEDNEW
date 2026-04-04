# Tutor Usefulness Hardening Plan

## Why this exists

The current AI tutor is stable enough to use, but it is still weak as a teaching tool. The main problem is not reliability anymore. The main problem is instructional quality.

Today the system is heavily optimized for:

- safety
- guardrails
- rate limits
- persona/tone shaping
- graceful failure

It is not yet strongly optimized for:

- grounding answers in the exact lesson or problem
- producing consistently useful hints
- verifying answer quality
- adapting response format to real learner state
- measuring whether answers helped

This document turns that diagnosis into an implementation plan for the next session.

## Current read

### What is working

- The tutor request path is operational end to end through [`/api/v1/ai/tutor`](/Users/drmixer/code/ElevatEDNEW/server/api.ts:881).
- The client/server pipeline has meaningful safety and ops instrumentation in [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts:1053) and [server/opsMetrics.ts](/Users/drmixer/code/ElevatEDNEW/server/opsMetrics.ts:1).
- The lesson player exposes the assistant in the right place for real use in [src/pages/LessonPlayerPage.tsx](/Users/drmixer/code/ElevatEDNEW/src/pages/LessonPlayerPage.tsx:773).
- Local browser checks now prove the supported tutor UX works.

### What is weak

1. The tutor is only lightly grounded.

- The backend mostly sees prompt text plus coarse learner metadata in [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts:743).
- It does not appear to receive the active lesson body, section text, worked example, practice item stem, correct answer, or rubric.
- As a result, the model often has to improvise from titles and subject labels instead of tutoring from the actual content.

2. Prompt construction is thin and lossy.

- The client compresses recent chat into a short text block in [src/components/Student/LearningAssistant.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/LearningAssistant.tsx:758).
- The server then wraps that text in system prompts in [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts:761).
- This loses structure, reduces context fidelity, and makes the model more likely to answer generically.

3. The current fallback is resilient but not very useful.

- When the model path fails, the UI falls back to canned profile-based responses in [src/components/Student/LearningAssistant.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/LearningAssistant.tsx:442).
- These are generic encouragement and topic heuristics, not lesson-grounded scaffolds.

4. The system prefers “safe and short” over “diagnostic and helpful.”

- The default prompts strongly bias toward concise safe hints in [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts:285).
- That is directionally right, but without stronger grounding it can produce bland, low-information answers.

5. There is no meaningful answer-quality evaluation loop.

- Ops tracks success/error/safety/limit counts.
- It does not track whether the answer was actually useful, whether the learner progressed, or whether the answer matched the lesson/problem.

6. The current model strategy is pragmatic, not pedagogy-driven.

- The primary model is `google/gemini-2.5-flash` via OpenRouter in [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts:115).
- That can be fine for latency/cost, but the current weakness is not just model choice. It is mostly lack of grounding and lack of evaluation.

## Root causes

The tutor feels weak because of four architectural gaps:

1. Missing content grounding.
2. Weak response shaping around actual lesson state.
3. Generic fallback behavior.
4. No usefulness measurement loop.

## Goal

Make the tutor reliably useful as a lesson-scoped hint tool.

Not the goal:

- open-ended companion chatbot
- full autonomous teacher
- free-form student counseling

Success target:

- a student asks for help inside a lesson
- the tutor responds using the actual lesson/problem context
- the answer gives a useful next step or hint
- the answer is short, safe, and demonstrably more helpful than the current generic behavior

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
- correct answer
- explanation/rubric if available
- current subject/module/lesson IDs

2. Update the tutor open event payload so [`learning-assistant:open`](/Users/drmixer/code/ElevatEDNEW/src/components/Student/LearningAssistant.tsx:447) carries structured lesson context instead of just title-level metadata.

3. Update the backend request contract in [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts:9) to accept structured lesson/problem context.

4. Build a dedicated grounding block on the server:
- active lesson facts
- current task
- allowed help mode
- known correct answer or rubric
- learner attempt state if available

#### Exit criteria

- The backend prompt contains the current question or section, not just the lesson title.
- The tutor can answer “help with this problem” using the actual problem text.

### Workstream B: Replace lossy chat serialization with structured messages

#### Objective

Stop flattening the conversation into a low-fidelity text blob.

#### Changes

1. Replace `promptForModel` string compression in [LearningAssistant.tsx](/Users/drmixer/code/ElevatEDNEW/src/components/Student/LearningAssistant.tsx:758) with a structured message array.

2. Send:
- recent user messages
- recent assistant messages
- explicit current learner intent
- explicit current help mode (`hint`, `break_down`, `another_way`, `solution`)

3. Update [server/ai.ts](/Users/drmixer/code/ElevatEDNEW/server/ai.ts:743) so `buildMessages()` consumes structured input rather than reconstructing context from one string.

#### Exit criteria

- Multi-turn conversations preserve turns cleanly.
- Hints and follow-ups are based on prior exchange content, not a lossy merged string.

### Workstream C: Make fallback actually instructional

#### Objective

Replace generic fallback copy with deterministic lesson-aware scaffolds.

#### Changes

1. Remove or sharply reduce reliance on [`getContextualResponse()`](/Users/drmixer/code/ElevatEDNEW/src/components/Student/LearningAssistant.tsx:442) for lesson tutoring.

2. Add deterministic fallbacks by subject/task type:
- math: next-step hint, worked-example template, error-check prompt
- reading/ELA: evidence prompt, sentence frame, summarize-and-cite prompt
- science: claim/evidence/reasoning prompt
- social studies: sourcing/timeline/cause-effect scaffold

3. When a correct answer/rubric exists, use rule-based scaffolds before generic motivational text.

4. Only use generic encouragement fallback when no lesson/problem context exists.

#### Exit criteria

- Model failure still yields useful help tied to the current lesson/problem.
- Fallback answers are instructional, not just encouraging.

### Workstream D: Tighten tutor UX around lesson use

#### Objective

Make the supported usage path obvious and coherent.

#### Changes

1. Treat the lesson page as the primary tutor surface.
2. On the student dashboard, avoid implying the tutor is a general-purpose chatbot if it is really lesson-scoped.
3. Add explicit help intents in-lesson:
- “Give me a hint”
- “Break this down”
- “Explain another way”
- “Check my thinking”

4. Pass those intents directly into tutor request metadata.

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

2. Add a lightweight thumbs-up/down or “Was this helpful?” signal on tutor answers.

3. Track whether a tutor answer was:
- AI direct
- deterministic fallback
- lesson-grounded
- problem-grounded

4. Add admin snapshot slices for tutor usefulness, not just tutor success/error counts.

#### Exit criteria

- We can see whether tutor answers help learners continue, not just whether the request returned 200.

### Workstream F: Create a real tutor eval set

#### Objective

Stop tuning blindly.

#### Changes

1. Build a curated prompt set from real expected usage:
- “I’m stuck”
- “Can you explain step 2?”
- “Why is this wrong?”
- “Give me a hint”
- “Explain another way”
- “Check my answer”

2. Cover at least:
- math practice
- reading/ELA evidence/writing
- science explanation
- safety/off-topic prompts

3. For each case, define desired behavior:
- grounded
- concise
- no answer leakage unless explicitly allowed
- no invented facts

4. Add a repo doc or fixture set for regression review.

#### Exit criteria

- We can compare tutor quality before and after prompt/grounding changes.

## Recommended implementation order

1. Workstream A: strong lesson grounding
2. Workstream B: structured messages
3. Workstream C: instructional fallback
4. Workstream D: lesson-first UX tightening
5. Workstream E: usefulness telemetry
6. Workstream F: eval set

## Next session starting point

If continuing in a fresh chat, start with:

1. Implement Workstream A request-shape changes from lesson player to tutor backend.
2. Keep the current guardrails and ops events intact.
3. Do not redesign the whole tutor UI first.
4. Prefer small vertical slices:
- lesson page payload
- backend contract
- prompt grounding
- one deterministic fallback improvement

## Definition of done for the first improvement slice

The first slice is done when:

- the lesson page sends structured current-problem context
- the tutor backend incorporates that context into model messages
- one subject path, ideally math practice, produces meaningfully more grounded hints
- a deterministic fallback exists for that same path
- tests cover the request shape and one grounded response path
