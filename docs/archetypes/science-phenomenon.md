# Science Phenomenon / Evidence

Purpose: define the authoritative archetype spec for science lessons that teach students to explain an observable phenomenon, system, or process by connecting evidence, models, and reasoning.

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

Use this archetype for science lessons in roughly grades 3-12 when the student needs to:
- notice or interpret an observation, phenomenon, or system
- connect evidence to a scientific explanation
- use a model, diagram, chart, or measured example to understand the concept
- apply the same cause/effect or system reasoning in practice

Best-fit topics:
- ecosystems
- weather and climate
- forces and motion
- matter and energy
- life cycles
- body systems
- plate tectonics
- Earth and space systems

Do not use this archetype for:
- vocabulary-only science lessons
- standalone lab procedures where following directions is the main task
- math procedure lessons centered on symbolic solving
- history or civics lessons where sourcing and perspective are the main instructional job

---

## 2. Instructional Job

This archetype should help a student:
- identify what is happening in a phenomenon or system
- notice which evidence matters
- explain the cause, pattern, or mechanism
- transfer that explanation to a similar case

The lesson should feel:
- inquiry-anchored
- concrete
- readable
- explanatory

It should not feel:
- like a vocabulary worksheet
- detached from evidence
- decorative
- overloaded with facts that never connect

---

## 3. Default Lesson Shell

Required top-level shape:

1. `## Learning Goal`
2. `## Introduction`
3. `## Key Vocabulary` when scientific terms are truly needed
4. one or more phenomenon/evidence sections
5. `## Summary`

Preferred section sequence:

1. learning goal
2. introduction with an observation, question, or phenomenon
3. vocabulary or system context
4. phenomenon or observation focus
5. concept explanation
6. evidence, model, or worked example
7. summary

Allowed variation:
- some lessons may combine the phenomenon and first concept explanation
- some lessons may need a dedicated diagram, chart, or model section
- some lessons may use a second evidence section to compare two conditions or outcomes

Not allowed:
- a science lesson with no clear phenomenon, question, or observable anchor
- a large vocabulary dump before the lesson explains anything
- data or diagrams presented with no explanation of what they show
- decorative science images standing in for actual evidence

---

## 4. Writing Rules

Reading level:
- instructions should read at or below the student grade band
- explanations should stay short enough that the science logic remains visible

Tone:
- direct
- precise
- evidence-centered
- supportive

Use:
- explicit cause/effect language
- plain verbs like `observe`, `compare`, `explain`, `predict`, and `measure`
- named variables, labels, and units when measurements appear
- short links between evidence and explanation

Avoid:
- vague phrases like "science shows" with no evidence
- jargon that is never defined
- fact lists with no reasoning
- hiding the mechanism inside dense prose

---

## 5. Section Requirements

### Learning Goal

Must:
- state 2-3 clear outcomes
- include both the science idea and the explanation move when both matter

Good pattern:
- `I can explain why seasons change using Earth's tilt and sunlight.`
- `I can use evidence from a model to explain how energy moves in a food chain.`

### Introduction

Must:
- anchor the lesson in an observation, system, or guiding question
- tell the student what they should try to figure out

Good pattern:
- ask what causes a visible pattern, change, or result

Avoid:
- generic "science is everywhere" filler
- long background before the student knows what problem they are solving

### Key Vocabulary

Must:
- define only the terms needed for this lesson
- use parser-safe format: `**Term**: Definition`

Should:
- keep definitions operational and tied to the phenomenon
- introduce units or model labels when they matter

Avoid:
- glossary-style lists that do not affect the explanation
- definitions that are more complex than the lesson itself

### Phenomenon / Observation Focus

Must:
- describe what is being observed
- surface the details, measurements, or pattern the student should notice
- make the target question visible

Should:
- use bullets when multiple observations or conditions need to be separated
- point to parts of the diagram, chart, or model directly

Avoid:
- unexplained scenario setup
- asking for an explanation before the evidence or pattern is clear
- hiding the important observation in a long paragraph

### Concept Explanation

Must:
- explain the mechanism, relationship, or system behavior
- connect the key terms to what is happening
- clarify what causes what, or what evidence supports which conclusion

Good pattern:
- what is observed
- what scientific idea explains it
- how the evidence supports that explanation

Avoid:
- facts with no link back to the phenomenon
- jumping from observation to answer with no reasoning
- treating the model as self-explanatory when it is not

### Evidence / Model / Worked Example

Must:
- connect evidence, model details, or measured data to the explanation
- show the reasoning step, not just the observation
- keep labels, values, arrows, and units consistent

Should:
- separate evidence from conclusion clearly
- use a CER-like pattern when helpful: claim, evidence, reasoning
- include one worked example of how to interpret a diagram, chart, or model

Avoid:
- data dumps with no interpretation
- diagrams with unlabeled parts that matter to the answer
- charts or visuals that contradict the text

### Summary

Must:
- restate the key scientific explanation
- remind the student what evidence or pattern supports it

Good pattern:
- one short paragraph plus a short reminder list

---

## 6. Checkpoint Pattern

Checkpoint expectations for this archetype:
- checkpoints must be answerable from the section content
- checkpoints should move from observation to evidence to explanation
- checkpoints should reward scientific reasoning, not memorized isolated facts

Default rhythm:
- identify the observation or pattern
- choose the evidence that matters
- explain or predict using the concept

Good checkpoint types:
- What pattern do you notice in this model or chart?
- Which evidence best supports the explanation?
- Why does this change happen?
- What would likely happen if one condition changed?

Bad checkpoint types:
- vocabulary-only recall with no concept application
- outside-knowledge trivia not taught in the lesson
- repeated definition questions across multiple sections
- ambiguous prompts with more than one scientifically valid answer because the stem is underspecified

---

## 7. Practice Pattern

Practice should feel like "use the same science reasoning with less support."

Must:
- stay tied to the same concept, system, or process
- require evidence-based explanation or prediction
- align with the model, diagram, or pattern already taught

Should:
- move from direct transfer to moderate variation
- use distractors based on real misconceptions
- include a CER frame or explanation frame when useful

Avoid:
- opinion prompts that can be answered without science content
- unrelated calculations that were not taught in the lesson
- practice that introduces a new model type without setup
- answer choices where several are true because the question is too broad

---

## 8. Visual Pattern

Visuals are often important in this archetype and should do real teaching work.

Use visuals when they help the student:
- see a system or process
- interpret data
- track inputs, outputs, or forces
- compare two conditions or outcomes

Good visuals:
- labeled diagrams
- food webs
- life-cycle diagrams
- force arrows
- particle models
- charts and graphs
- cross-sections

Visual requirements:
- labels, arrows, scales, and units match the text exactly
- the image highlights the relationship being taught
- the visual can be described in simple alt-text style language
- the diagram supports the explanation rather than replacing it

Bad visuals:
- decorative stock photos
- inaccurate anatomy, system layout, or process flow
- graphs with misleading scales or unlabeled axes
- complex visuals with no guidance about what to notice

---

## 9. Support Pattern

Hints:
- should point the student back to a relevant observation, label, or measurement
- should narrow the reasoning move
- should not reveal the answer letter

Quick review:
- should restate the phenomenon, evidence, and explanation in compact form
- should use one micro-example or diagram reminder when helpful
- should make the next checkpoint easier to interpret

Challenge:
- should stay inside the same concept family
- may ask the student to predict, compare conditions, or explain a related case
- should not jump into full experiment design unless the lesson already set that up

---

## 10. Banned Patterns

Do not allow these in this archetype:
- placeholder vocabulary
- template filler
- vocabulary-only science lessons
- unsupported explanations
- data or diagram dumps with no reasoning
- misleading or inaccurate visuals
- decorative science imagery with no instructional role
- practice that depends on outside knowledge not taught in the lesson

---

## 11. Definition Of Done

A lesson using this archetype is ready to be called gold when:
- it follows the parser-safe shell
- the phenomenon or guiding question is clear
- the concept explanation connects evidence to reasoning
- checkpoints vary across observation, evidence, and explanation
- practice aligns with the modeled science reasoning
- visuals are accurate and instructionally necessary
- hints/review/challenge reinforce the same phenomenon and concept
- the lesson passes the rubric and checklist

---

## 12. Current Exemplar Notes

Current exemplar:
- none yet

Current reality:
- no science guide lesson has been approved yet as the canonical phenomenon/evidence exemplar
- this spec should still guide science rewrites before exemplar selection

The first approved exemplar should prove:
- the lesson is anchored in a real observation, phenomenon, or model
- evidence and reasoning stay connected throughout the lesson
- diagrams, charts, or models do real teaching work
- support tools help students interpret evidence instead of guessing

Important boundary:
- this archetype is for science explanation lessons centered on evidence
- it is not the default pattern for pure lab-procedure lessons or isolated vocabulary drills

---

## 13. Future Implementation Use

This spec should eventually govern:
- lesson metadata tagging for `science_phenomenon_evidence`
- automated lesson audits for phenomenon anchoring, evidence/reasoning linkage, and diagram quality
- bulk rewrite templates for life science, Earth science, and physical science explanation lessons
- exemplar approval for science lessons that should guide similar rewrites
