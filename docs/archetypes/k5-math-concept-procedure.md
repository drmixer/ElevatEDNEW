# K-5 Math Concept / Procedure

Purpose: define the authoritative archetype spec for elementary math lessons that teach a concrete concept or procedure through direct explanation, worked examples, guided transfer, and scaffolded support.

Status:
- `Live`

Primary exemplar:
- lesson `1437`
- [perimeter-launch-gold.md](/Users/drmixer/code/ElevatEDNEW/docs/perimeter-launch-gold.md)

Related docs:
- [lesson-archetypes.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-archetypes.md)
- [gold-lesson-rubric.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-rubric.md)
- [gold-lesson-review-checklist.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-review-checklist.md)
- [lessonContentParser.ts](/Users/drmixer/code/ElevatEDNEW/src/lib/lessonContentParser.ts)

---

## 1. When To Use This Archetype

Use this archetype for math lessons in roughly grades K-5 when the student needs:
- a direct concept explanation
- one or more concrete worked examples
- visible numbers and units
- scaffolded transfer into practice

Best-fit topics:
- perimeter
- area
- place value
- fractions
- measurement
- addition/subtraction
- multiplication/division foundations
- data interpretation at an elementary level

Do not use this archetype for:
- upper-math symbolic derivation lessons
- math lessons that are primarily proofs or abstract reasoning
- non-math reading/evidence lessons

---

## 2. Instructional Job

This archetype should help a student:
- understand what the concept means
- see a small number of clear models
- understand the steps for solving the type of problem
- transfer that understanding into short practice

The lesson should feel:
- concrete
- readable
- structured
- supportive

It should not feel:
- abstract
- verbose
- generic
- overloaded

---

## 3. Default Lesson Shell

Required top-level shape:

1. `## Learning Goal`
2. `## Introduction`
3. `## Key Vocabulary` when the topic benefits from explicit terms
4. one or more concept/example sections
5. `## Summary`

Preferred section sequence:

1. learning goal
2. introduction with real-world or concrete framing
3. vocabulary
4. direct explanation of the concept
5. worked example 1
6. worked example 2 or contrast example
7. worked example 3 if needed
8. summary

Allowed variation:
- some simpler lessons may only need one or two worked examples
- some topics may use a lighter vocabulary block
- some lessons may combine the concept explanation and first example

Not allowed:
- no clear learning goal
- no worked example for a topic that obviously needs one
- a fake practice section that already gives away the answer
- giant prose blocks with no visible structure

---

## 4. Writing Rules

Reading level:
- at or below the student grade band
- default to short, concrete sentences

Tone:
- direct
- clear
- calm
- supportive

Use:
- explicit nouns
- visible units
- plain verbs like `add`, `count`, `compare`, `measure`
- consistent terminology after vocabulary is introduced

Avoid:
- abstract motivational filler
- adult-facing meta commentary
- unnecessary jargon
- long multi-clause explanations

---

## 5. Section Requirements

### Learning Goal

Must:
- state 2-3 clear outcomes
- be written in student-friendly language

Good pattern:
- `I can explain what perimeter means.`
- `I can add side lengths to find perimeter.`

### Introduction

Must:
- say why the topic matters
- anchor the concept in something concrete

Good pattern:
- ribbon around a frame
- border around a garden
- measuring a side or total around a shape

Avoid:
- vague "math is important" filler
- long story setup unrelated to the lesson work

### Key Vocabulary

Must:
- define only the terms the student truly needs
- use parser-safe format: `**Term**: Definition`

Should:
- keep definitions short
- avoid dictionary-style overexplaining

### Concept Explanation

Must:
- explain the rule directly
- tell the student what to look for and what to do

Good pattern:
- what the concept measures
- what counts
- what does not count
- the basic solving steps

### Worked Examples

Must:
- use concrete numbers
- show the numbers the student is expected to use
- show the operation or reasoning explicitly
- end with the final answer and unit

Should:
- progress from easier to more varied examples
- include more than one shape/model when that helps transfer

Avoid:
- examples with hidden numbers
- examples that skip directly to the answer
- examples that are too visually or numerically dense

### Summary

Must:
- restate the big idea
- tell the student what to remember

Good pattern:
- one short paragraph plus a short reminder list

---

## 6. Checkpoint Pattern

Checkpoint expectations for this archetype:
- checkpoints must be answerable from section content
- checkpoints should vary across the Learn flow
- checkpoints should reinforce concept, computation, and transfer

Default rhythm:
- concept / definition
- compute from a worked example
- short real-world or scenario application

Good checkpoint types:
- what does this measure?
- what should you add?
- what is the total?
- what would you measure in this real-world situation?

Bad checkpoint types:
- generic study advice
- questions unrelated to the current section
- trick wording that exceeds the grade level
- repeated near-identical prompts across multiple sections

---

## 7. Practice Pattern

Practice should feel like "now you try the kind of work we just modeled."

Must:
- match the lesson concept directly
- use concrete, legible numbers
- stay close to the example pattern before increasing variation

Should:
- move from simple to slightly more varied
- include plausible distractors
- support show-steps or hints when available

Avoid:
- generic prompts disconnected from the lesson
- distractors that are obviously silly
- answer choices that make the correct choice visually obvious for the wrong reason

---

## 8. Visual Pattern

Visuals are expected often in this archetype.

Use visuals when they help the student:
- see the quantities
- identify the relevant parts
- connect the prompt to the example

Good visuals:
- labeled shapes
- number lines
- arrays
- fraction bars
- charts or simple data visuals
- measurement models

Visual requirements:
- labels match the text
- numbers match the prompt
- shape/proportion is not misleading
- the image teaches something specific

Bad visuals:
- decorative images with no instructional role
- unrelated stock images
- shape mismatches
- visuals that contradict the prompt

---

## 9. Support Pattern

Hints:
- should help the student choose the right process
- should not reveal the answer letter
- should be one small step, not a full re-teach unless quick review is triggered

Quick review:
- should restate the concept simply
- should use one small visual or micro-example when helpful
- should make the next checkpoint easier to understand

Challenge:
- should remain grade-safe
- should extend the same concept, not switch topics

---

## 10. Banned Patterns

Do not allow these in this archetype:
- placeholder vocabulary
- template filler
- generic coaching prompts
- solved practice disguised as student work
- incorrect or mismatched visuals
- long dense prose with no visible structure
- examples without units when units matter
- abrupt jumps in difficulty without scaffolding

---

## 11. Definition Of Done

A lesson using this archetype is ready to be called gold when:
- it follows the parser-safe shell
- the language fits elementary learners
- the concept explanation is direct
- the worked examples are concrete and correct
- checkpoints are varied and relevant
- practice aligns with the modeled work
- visuals are accurate and useful
- hints/review/challenge all reinforce the same concept
- the lesson passes the rubric and checklist

---

## 12. Current Exemplar Notes

Current exemplar:
- `Perimeter (intro) Launch Lesson` (`1437`)

Why it is the exemplar:
- it is the strongest current elementary-math guide lesson in the repo
- it demonstrates direct explanation plus worked examples
- it now aligns with the current lesson-player checkpoint/practice/visual stack

Important boundary:
- this lesson is the reference for elementary math formatting and support patterns
- it is not the universal template for upper math or non-math subjects

---

## 13. Future Implementation Use

This spec should eventually govern:
- lesson metadata tagging for `k5_math_concept_procedure`
- automated lesson audits
- bulk rewrite templates for elementary math lessons
- exemplar approval for similar K-5 math lessons

When the rewrite pipeline exists, this archetype should be the first one wired into it because it already has:
- a real exemplar
- strong runtime support
- existing visual/checkpoint/practice infrastructure
