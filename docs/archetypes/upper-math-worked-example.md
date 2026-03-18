# Upper Math Worked Example

Purpose: define the authoritative archetype spec for upper-math lessons that teach a formal concept or procedure through explicit setup, symbolic reasoning, worked examples, and controlled transfer into multi-step practice.

Status:
- `Candidate`

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

Use this archetype for math lessons in roughly grades 6-12 when the student needs to:
- understand a formal concept and when to use it
- work through symbolic or multi-step reasoning
- see a complete setup before solving
- transfer the same method into practice

Best-fit topics:
- ratios and proportional reasoning
- expressions and equations
- linear functions
- systems of equations
- geometry problem solving
- trigonometric setup
- algebraic manipulation
- calculus procedures

Do not use this archetype for:
- elementary concrete-concept lessons that need K-5 style scaffolding
- proof-heavy lessons where constructing an argument is the main instructional job
- non-math evidence or reading-analysis lessons
- open exploration lessons with no stable target method

---

## 2. Instructional Job

This archetype should help a student:
- identify the target concept or method
- understand the setup, notation, and assumptions
- follow the reasoning through each major step
- apply the same structure to a new problem

The lesson should feel:
- formal
- organized
- explainable
- purposeful

It should not feel:
- juvenile
- hand-wavey
- notation-heavy without explanation
- like a list of disconnected answer keys

---

## 3. Default Lesson Shell

Required top-level shape:

1. `## Learning Goal`
2. `## Introduction`
3. `## Key Vocabulary` when notation, terms, or assumptions need to be defined
4. one or more concept/example sections
5. `## Summary`

Preferred section sequence:

1. learning goal
2. introduction with problem type and why the method matters
3. vocabulary, notation, or assumptions
4. concept explanation or method setup
5. worked example 1
6. worked example 2, contrast example, or common-mistake section
7. summary

Allowed variation:
- some lessons may combine the concept explanation and first setup
- some lessons may need a dedicated graph, table, or diagram section
- some lessons may use a second worked example to show a different case instead of a contrast

Not allowed:
- symbolic manipulation with no explanation of what each step is doing
- a lesson that jumps straight to a final formula without setup
- answer-only examples that hide the intermediate reasoning
- elementary-style filler sections that dilute the formal math work

---

## 4. Writing Rules

Reading level:
- language should fit the student grade band without talking down to the student
- explanations should stay concise even when the math is multi-step

Tone:
- direct
- precise
- calm
- instruction-first

Use:
- explicit naming of variables, units, constraints, and assumptions
- grouped steps instead of one dense paragraph
- short explanations of why a step is valid
- consistent notation from start to finish

Avoid:
- cute framing that obscures the mathematics
- unexplained symbol changes
- jargon with no definition
- skipping from setup to answer because the algebra is "obvious"

---

## 5. Section Requirements

### Learning Goal

Must:
- state 2-3 clear outcomes
- describe both the concept and the procedure when both matter

Good pattern:
- `I can identify when to use slope-intercept form.`
- `I can solve a linear equation and explain each step.`

### Introduction

Must:
- name the type of problem the student is solving
- frame why this method is useful or necessary

Good pattern:
- tell the student what kind of quantity, relationship, graph, or expression they are about to analyze

Avoid:
- childish real-world hooks that do not support the formal task
- long motivational filler before the math begins

### Key Vocabulary

Must:
- define only the terms, symbols, or forms the student needs
- use parser-safe format: `**Term**: Definition`

Should:
- include notation or variable meaning when ambiguity would hurt the example
- keep each definition short and operational

Avoid:
- full glossary dumps
- symbols introduced in the example before they are named

### Concept Explanation / Method Setup

Must:
- explain when the method applies
- identify the starting information
- make the structure of the approach explicit

Good pattern:
- what is given
- what must be found
- which method or form to use
- why that method fits

Avoid:
- formula drops with no selection logic
- explanations that mix concept, setup, and answer into one blur

### Worked Examples

Must:
- show the setup clearly
- show the major algebraic or procedural steps in order
- include enough reasoning that a student can follow why the next step happens
- end with the final answer, interpretation, and unit when relevant

Should:
- move from a cleaner first case to a slightly more varied or constrained second case
- call out substitutions, transformations, or graph features explicitly
- separate the symbolic work from the interpretation when both are present

Avoid:
- unexplained jumps between lines
- solving multiple subproblems at once in one dense block
- examples where notation changes midway

### Common Mistake Contrast

Must when useful:
- surface a likely error pattern directly
- explain why the mistake fails
- redirect the student to the correct check or step

Good pattern:
- sign error
- using the wrong formula
- incorrect substitution
- misreading slope, intercept, angle, or domain information

### Summary

Must:
- restate the core method or concept
- remind the student what to check when solving a similar problem

Good pattern:
- one short paragraph plus a short checklist

---

## 6. Checkpoint Pattern

Checkpoint expectations for this archetype:
- checkpoints must be answerable from the section content
- checkpoints should move across concept, method choice, and solved interpretation
- checkpoints should test reasoning, not only arithmetic execution

Default rhythm:
- identify the concept, form, or next step
- choose the correct setup or method
- solve or interpret a result from a worked example

Good checkpoint types:
- Which form should be used here?
- What is the correct next step after simplifying?
- Which expression matches the graph or table?
- What does this solution mean in the context of the problem?

Bad checkpoint types:
- trivial arithmetic with no tie to the lesson method
- ambiguous method-selection items with multiple valid paths but one forced answer
- repeated "solve completely" prompts after every section
- wording tricks that hide the actual math target

---

## 7. Practice Pattern

Practice should feel like "solve the same class of problem with less support."

Must:
- match the lesson method directly
- preserve the same notation and conventions used in the lesson
- require at least one meaningful reasoning step beyond pure recall

Should:
- move from direct transfer to moderate variation
- use distractors based on real student mistakes
- include interpretation where the topic naturally requires it

Avoid:
- practice that demands a new method not introduced in the lesson
- distractors that are random computation errors with no diagnostic value
- over-scaffolded prompts that remove the actual mathematical decision
- answer choices that differ only by formatting noise

---

## 8. Visual Pattern

Visuals are selective in this archetype and should appear only when they clarify the mathematics.

Use visuals when they help the student:
- connect an equation to a graph
- interpret a table, diagram, or coordinate plane
- see a geometry setup or trigonometric relationship
- compare a correct setup with a mistaken one

Good visuals:
- labeled graphs
- tables
- coordinate planes
- geometry diagrams
- triangle labels
- step-aligned equation layouts

Visual requirements:
- labels and values match the text exactly
- graph scales are legible and not misleading
- the visual highlights the mathematical relationship being taught
- the diagram supports the worked example rather than duplicating decorative context

Bad visuals:
- decorative icons
- cluttered diagrams with irrelevant labels
- graphs with mismatched intercepts, scales, or units
- visuals that force the student to infer unstated numbers

---

## 9. Support Pattern

Hints:
- should point to the next valid step, relationship, or check
- should name the relevant form, definition, or substitution
- should not reveal the answer letter

Quick review:
- should restate the method in compact form
- should include one micro-example or step reminder when helpful
- should make the next checkpoint easier to parse

Challenge:
- should stay inside the same concept family
- may increase the number of steps, add a constraint, or ask for interpretation after solving
- should not switch into proof, derivation, or a different unit without setup

---

## 10. Banned Patterns

Do not allow these in this archetype:
- placeholder vocabulary
- template filler
- answer-only worked examples
- unexplained algebra jumps
- inconsistent notation
- decorative visuals with no mathematical role
- fake real-world framing that hides the actual task
- practice that depends on a method not taught in the lesson

---

## 11. Definition Of Done

A lesson using this archetype is ready to be called gold when:
- it follows the parser-safe shell
- notation and assumptions are defined when needed
- the concept explanation makes method choice clear
- worked examples show setup, steps, and reasoning
- checkpoints vary across concept, method, and interpretation
- practice aligns with the modeled method
- visuals are accurate and only used when helpful
- hints/review/challenge reinforce the same mathematical structure
- the lesson passes the rubric and checklist

---

## 12. Current Exemplar Notes

Current exemplar:
- none yet

Current reality:
- no upper-math guide lesson has been approved yet as the canonical worked-example exemplar
- this spec should still govern rewrites in grades 6-12 math before exemplar selection

The first approved exemplar should prove:
- formal notation can stay readable in the player
- worked solutions can show reasoning without becoming bloated
- checkpoints can test method choice and interpretation, not just final answers
- visuals are used selectively and accurately

Important boundary:
- this archetype is for formal upper-math concept and procedure lessons
- it is not the default pattern for proof-only lessons or elementary concrete-concept instruction

---

## 13. Future Implementation Use

This spec should eventually govern:
- lesson metadata tagging for `upper_math_worked_example`
- automated lesson audits for notation clarity, step completeness, and visual accuracy
- bulk rewrite templates for algebra, geometry, trigonometry, and calculus procedure lessons
- exemplar approval for upper-math lessons that should guide similar rewrites
