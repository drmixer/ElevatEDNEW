# Gold Lesson Rubric

Purpose: define what a "finished" lesson means in ElevatED, using the Grade 2 perimeter launch lesson as the elementary math reference implementation, without forcing every subject and grade band into the same exact instructional pattern.

Status:
- Current elementary math guide lesson: `Perimeter (intro) Launch Lesson` (`lesson 1437`)
- Current scope of this rubric: all lessons
- Current strongest exemplar pattern: K-5 math

---

## Core Principle

All lessons should share the same platform contract:
- clear goal
- readable introduction
- parser-friendly markdown
- section-based Learn flow
- usable checkpoints and practice
- support for hints, quick review, and challenge
- clean summary

Not all lessons should share the same teaching rhythm.

Use the same shell across the platform, but adapt the internal lesson pattern by:
- grade band
- subject
- task type
- cognitive load

---

## Universal Requirements

Every lesson should meet these requirements before it is treated as "gold."

### 1. Canonical Lesson Choice

The lesson chosen as the model should be the version the product actually wants to serve by default.

Pass criteria:
- it is the lesson variant the app should prefer in normal playback
- it is not an outdated draft or deprecated intro variant
- there is one obvious canonical row to improve, not multiple competing versions

### 2. Clean Content

The lesson body must read like finished instructional writing, not generated filler.

Pass criteria:
- no placeholder vocabulary
- no template filler
- no contradictory phrasing
- no solved "practice" that undermines the real practice phase
- no irrelevant visuals or examples

### 3. Parser-Friendly Structure

The lesson must be shaped so the current markdown parser can turn it into a stable lesson flow.

Preferred headings:
- `## Learning Goal`
- `## Introduction`
- `## Key Vocabulary`
- one or more concept/example sections
- `## Summary`

Pass criteria:
- objectives parse cleanly from a list
- vocabulary parses cleanly from `**Term**: Definition`
- learn sections split cleanly by `##` headers
- summary is recognizable as a summary section

Reference:
- [lessonContentParser.ts](/Users/drmixer/code/ElevatEDNEW/src/lib/lessonContentParser.ts)

### 4. Clear Learn Arc

The Learn phase should have a visible progression, not a pile of disconnected text.

Pass criteria:
- the lesson opens with context or purpose
- the core idea is explained plainly
- at least one worked example is included when the topic benefits from it
- the summary restates the big idea and what to remember next

### 5. Practice Compatibility

The lesson must work with the actual practice/checkpoint system, not only look good as markdown.

Pass criteria:
- section content supports meaningful checkpoints
- practice questions are concept-aligned
- hints do not reveal answer letters
- quick review and challenge remain coherent with the lesson topic

### 6. Visual Quality

Visuals should clarify the concept, not decorate it.

Pass criteria:
- visuals match the text and numbers shown
- visuals are age-appropriate
- visuals reinforce the correct concept
- no misleading shape/diagram mismatch

### 7. Audit Cleanliness

A gold lesson should pass both human review and automated checks.

Pass criteria:
- no placeholder or structure warnings
- no missing-practice linkage for lessons expected to use native practice
- no obvious runtime regressions in the player

---

## Required Shell

This is the default lesson shell to preserve across subjects unless there is a strong reason not to.

1. Learning goal
2. Introduction / why it matters
3. Vocabulary or key terms when needed
4. Main teaching sections
5. Summary

What can vary:
- number of teaching sections
- number of examples
- whether vocabulary is explicit or lightweight
- whether visuals are always present
- whether the lesson emphasizes explanation, computation, evidence, or interpretation

---

## K-5 Math Pattern

This is the current best reference pattern and the one lesson `1437` should anchor.

Best for:
- perimeter
- area
- fractions
- place value
- measurement
- basic operations

Recommended shape:
1. short intro grounded in a concrete real-world situation
2. short vocabulary block
3. direct concept explanation
4. worked examples with labeled numbers
5. short summary

Required qualities:
- short sections
- concrete numbers
- explicit steps
- visuals where useful
- checkpoints that alternate between concept, compute, and scenario
- support that feels scaffolded, not abstract

Do:
- show the model before expecting transfer
- keep language below or at the grade band
- keep units visible
- make examples easy to verify

Do not:
- overload with long prose
- hide the concept in a story without a direct explanation
- include fake "try it" sections that already reveal the answer
- rely on generic coaching prompts

Current exemplar:
- `Perimeter (intro) Launch Lesson` (`1437`)

---

## Upper Math Pattern

Upper math should keep the same shell, but not the same elementary pacing.

Best for:
- Algebra I/II
- geometry proofs
- trigonometry
- precalculus
- calculus

Recommended changes from K-5 math:
- fewer "kid scaffold" moments
- more emphasis on derivation and reasoning
- more multi-step worked solutions
- stronger symbolic notation
- more explicit common-error contrast

Required qualities:
- assumptions and notation are defined
- worked examples show reasoning, not only the final answer
- steps are grouped logically
- the lesson separates concept, procedure, and interpretation

Do:
- use worked examples that show the full setup
- call out why a method works
- surface common mistakes directly

Do not:
- force every section into tiny elementary-style chunks
- overuse cute real-world framing when the topic needs formal structure

---

## Non-Math Pattern

Non-math lessons should still obey the platform shell, but the center of gravity changes.

### ELA

Emphasize:
- text-based claims
- cited evidence
- vocabulary in context
- response frames where useful

Good section pattern:
1. reading purpose
2. key vocabulary or text context
3. passage or excerpt focus
4. analysis/example response
5. summary

### Science

Emphasize:
- phenomenon or observation
- evidence to reasoning
- diagrams, models, or labeled visuals
- measurement and cause/effect where relevant

Good section pattern:
1. observable question
2. concept explanation
3. evidence/model/example
4. conclusion
5. summary

### Social Studies / History

Emphasize:
- sourcing
- chronology
- perspective
- evidence vs inference

Good section pattern:
1. historical context
2. key terms or source framing
3. evidence/example
4. interpretation
5. summary

Non-math warning:
- do not force all checkpoints into compute-style logic just because the platform supports it

---

## What Must Stay Constant

These should stay consistent across all subjects and grades:
- markdown must be parser-safe
- the lesson must have a clear goal
- the lesson must have a readable introduction
- the lesson must have a coherent Learn flow
- the lesson must end with a summary
- checkpoints and practice must match the lesson content
- hints and remediation must support the lesson, not contradict it

---

## What Should Vary

These should vary by grade and subject:
- sentence length
- amount of vocabulary scaffolding
- number of examples
- amount of symbolism
- amount of real-world framing
- number and type of visuals
- checkpoint style
- challenge difficulty

---

## Definition Of Done

A lesson can be called a gold-standard guide lesson when:
- it is the canonical version the app should serve
- it reads like finished instructional content
- it parses cleanly into the player structure
- it supports stable checkpoints and practice
- its visuals are accurate
- its support flows are coherent
- it passes automated checks
- a human reviewer would be comfortable using it as the model for rewriting similar lessons

---

## Recommendation

Use this rubric in two ways:

1. As the approval checklist for any lesson proposed as a "gold" exemplar
2. As the rewrite target for the next batch of lessons

Current recommendation:
- use lesson `1437` as the elementary math guide lesson
- do not use its exact structure as the universal template for every grade and subject
- use the same platform shell across all lessons, with domain-specific instructional patterns inside that shell
