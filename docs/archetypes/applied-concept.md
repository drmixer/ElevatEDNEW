# Specials / Applied Concept Lesson

Purpose: define the authoritative archetype spec for specials and applied-domain lessons that teach a concrete concept, skill, or practice through a short explanation, a model or demonstration, and guided application.

Status:
- `Future`

Primary exemplar:
- none yet

Related docs:
- [lesson-archetypes.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-archetypes.md)
- [gold-lesson-rubric.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-rubric.md)
- [gold-lesson-review-checklist.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-review-checklist.md)
- [content-style-guide.md](/Users/drmixer/code/ElevatEDNEW/docs/content-style-guide.md)
- [lessonContentParser.ts](/Users/drmixer/code/ElevatEDNEW/src/lib/lessonContentParser.ts)

---

## 1. When To Use This Archetype

Use this archetype for lessons in applied or specials domains when the student needs to:
- learn a concrete concept and see it used in context
- follow a brief model, demonstration, or example before trying it
- apply a skill to a scenario, artifact, routine, or media example
- connect the concept to a real-world or performance-based task

Best-fit topics:
- arts
- music
- health
- PE
- computer science
- media or digital literacy
- maker or design lessons
- applied safety, technique, or routine lessons

Do not use this archetype for:
- pure reading comprehension lessons
- source-analysis lessons in history or civics
- science phenomenon lessons centered on evidence and explanation
- math procedure lessons centered on symbolic solving
- broad inspirational or advisory content with no concrete skill target

---

## 2. Instructional Job

This archetype should help a student:
- understand the core concept or technique being taught
- see what it looks like in a real task or product
- follow a simple model before trying it independently
- apply the same move in a safe, bounded context

The lesson should feel:
- practical
- concrete
- example-driven
- usable

It should not feel:
- vague
- overly philosophical
- disconnected from the actual craft, movement, or tool
- like a generic classroom pep talk

---

## 3. Default Lesson Shell

Required top-level shape:

1. `## Learning Goal`
2. `## Introduction`
3. `## Key Vocabulary` when technique, tools, or safety terms need definition
4. one or more concept/model/application sections
5. `## Summary`

Preferred section sequence:

1. learning goal
2. introduction with the task, skill, or product in view
3. vocabulary, tools, or technique context
4. concept explanation or demonstration
5. model example or guided walk-through
6. guided application or contrast example
7. summary

Allowed variation:
- some lessons may combine the explanation and demonstration in one section
- some lessons may need a materials, setup, or safety section
- some lessons may use a short compare/contrast section to show better and weaker examples

Not allowed:
- a lesson with no concrete task or technique
- a long motivational opener that delays the skill
- vocabulary lists that never connect to the technique
- examples that are only decorative or aspirational

---

## 4. Writing Rules

Reading level:
- instructions should fit the student grade band
- keep language short enough that the skill or technique stays visible

Tone:
- direct
- clear
- practical
- supportive

Use:
- explicit names for tools, materials, steps, and observable outcomes
- plain verbs like `build`, `move`, `practice`, `compare`, `create`, and `adjust`
- short step sequences when procedure matters
- consistent terminology after it is introduced

Avoid:
- vague creativity language that does not help the student do the work
- jargon with no definition
- long reflections before the technique appears
- hidden assumptions about prior tool knowledge

---

## 5. Section Requirements

### Learning Goal

Must:
- state 2-3 clear outcomes
- describe what the student will do, make, perform, or apply

Good pattern:
- `I can use line and shape to create contrast in a composition.`
- `I can explain how to warm up before physical activity and why it matters.`
- `I can trace a simple program flow using a conditional statement.`

### Introduction

Must:
- name the task, product, performance, or routine the student is learning
- show why the skill matters in the actual domain

Good pattern:
- tell the student what they will make, do, or manage in the lesson

Avoid:
- abstract encouragement with no technique
- broad life advice that never returns to the lesson task

### Key Vocabulary

Must:
- define only the terms the student needs to complete the task
- use parser-safe format: `**Term**: Definition`

Should:
- keep definitions tied to the technique, tool, or routine
- define safety or process terms when needed

Avoid:
- oversized glossary blocks
- definitions that are not used later in the lesson

### Concept / Technique Explanation

Must:
- explain the core rule, technique, or process
- show how the concept appears in the domain
- identify what the student should look for or do first

Good pattern:
- what the technique is
- when to use it
- what result it should create

Avoid:
- general statements like "be creative" without a method
- technique described without an example
- process steps that skip the first action

### Model / Demonstration

Must:
- show the concept in action
- connect the steps to an observable result
- make the model short and easy to follow

Should:
- use before/after, good/better, or step-by-step contrast when helpful
- include setup notes when tools or materials matter

Avoid:
- demo content that is impossible to reproduce in the lesson flow
- examples with hidden steps
- performance or product samples with no explanation of why they work

### Guided Application

Must:
- ask the student to try the same technique in a bounded way
- keep the task aligned with the lesson model
- be answerable from the lesson content

Good pattern:
- choose the better example
- complete the next step
- identify which move fits the scenario
- apply the routine to a small case

Avoid:
- open-ended tasks with no success criteria
- practice that assumes tools or skills not introduced
- choices that depend on external domain knowledge

### Summary

Must:
- restate the technique or concept
- remind the student what to check or do next

Good pattern:
- one short paragraph plus a short reminder list

---

## 6. Checkpoint Pattern

Checkpoint expectations for this archetype:
- checkpoints must be answerable from the section content
- checkpoints should move from concept to model to application
- checkpoints should reward recognition of the right technique or next step

Default rhythm:
- identify the concept or tool
- recognize the modeled move
- choose the next correct action

Good checkpoint types:
- Which tool or step should be used first?
- Which example shows the stronger technique?
- What should happen next in this process?
- Which choice best fits the lesson rule?

Bad checkpoint types:
- vague preference questions
- prompts that can be answered without the technique
- repeated "what do you think" questions with no domain anchor
- multiple-choice items with more than one equally valid answer because the task is underspecified

---

## 7. Practice Pattern

Practice should feel like "apply the same technique in a small, realistic task."

Must:
- stay tied to the same concept, tool, or routine
- require a visible decision or next step
- align with the model or demonstration from the lesson

Should:
- move from recognition to short application
- use distractors based on common misuse or weaker technique
- include a frame or checklist when the domain needs procedural support

Avoid:
- open-ended practice with no criteria
- tasks that need equipment or context the lesson never introduced
- practice that turns into unrelated reflection
- answer choices that are purely decorative or subjective

---

## 8. Visual Pattern

Visuals are often useful in this archetype when they clarify the technique or product.

Use visuals when they help the student:
- see a composition, layout, or sequence
- identify the next movement or step
- compare a model with a weaker attempt
- follow a tool, interface, or routine

Good visuals:
- labeled diagrams
- step cards
- screenshots or interface callouts
- composition examples
- movement or posture diagrams
- before/after comparisons
- simple process flow charts

Visual requirements:
- labels and callouts match the lesson text exactly
- the visual has one clear instructional purpose
- the image can be described briefly in alt-text style language
- the visual supports the technique instead of replacing the explanation

Bad visuals:
- decorative stock art with no instructional role
- screenshots that include unexplained UI noise
- diagrams that imply a technique the lesson does not teach
- visuals that are too busy to support the task

---

## 9. Support Pattern

Hints:
- should point the student to the next step, tool, or rule
- should narrow the choice without revealing the answer letter
- should stay in the same domain language as the lesson

Quick review:
- should restate the technique in compact form
- should use one short example or reminder when helpful
- should make the next checkpoint easier to follow

Challenge:
- should stay inside the same skill family
- may add one constraint, compare two techniques, or ask for a better choice
- should not switch into a different unit without setup

---

## 10. Banned Patterns

Do not allow these in this archetype:
- placeholder vocabulary
- template filler
- generic motivational content
- unsupported creative prompts
- examples with no technique or success criteria
- decorative visuals with no role in the lesson
- practice that assumes equipment or background not introduced
- questions that cannot be answered from the lesson model

---

## 11. Definition Of Done

A lesson using this archetype is ready to be called gold when:
- it follows the parser-safe shell
- the skill or technique is concrete
- the model or demonstration shows the move clearly
- checkpoints lead from recognition to application
- practice aligns with the same domain technique
- visuals are accurate and instructionally useful
- hints/review/challenge reinforce the same action or routine
- the lesson passes the rubric and checklist

---

## 12. Current Exemplar Notes

Current exemplar:
- none yet

Current reality:
- no specials/applied-concept guide lesson has been approved yet as the canonical exemplar
- this spec should still guide arts, music, health, PE, CS, and similar rewrites before exemplar selection

The first approved exemplar should prove:
- the lesson centers a real skill, technique, or routine
- examples and visuals do actual instructional work
- the student can transfer the move to a bounded application
- support tools help the student perform the task, not just talk about it

Important boundary:
- this archetype is for applied-domain lessons with a concrete skill or concept
- it is not the default pattern for pure discussion, inspiration, or open-ended project briefs

---

## 13. Future Implementation Use

This spec should eventually govern:
- lesson metadata tagging for `applied_concept`
- automated lesson audits for task clarity, technique modeling, and visual utility
- bulk rewrite templates for specials and applied-domain lessons
- exemplar approval for arts, music, health, PE, computer science, and similar lessons
