# Study Skills / Metacognitive Routine

Purpose: define the authoritative archetype spec for study-skills lessons that teach students a repeatable routine for planning, monitoring, checking, or reflecting on their work.

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

Use this archetype for lessons in roughly grades 3-12 when the student needs to:
- follow a study routine or checklist
- plan how to begin or finish a task
- check work for errors or completeness
- reflect on what strategy to use next
- practice self-monitoring during learning

Best-fit topics:
- note-taking
- previewing a lesson or text
- checking answers or solving steps
- reviewing for a quiz or test
- organizing materials or assignments
- setting a study plan
- tracking understanding during a task
- using a simple self-correction routine

Do not use this archetype for:
- subject-specific content lessons with a deep domain concept at the center
- generic motivation or habit talk with no routine to practice
- full writing lessons focused on drafting, revision, or composition
- counseling or social-emotional lessons that are not built around an academic routine

---

## 2. Instructional Job

This archetype should help a student:
- know what the routine is for
- see the steps in a usable order
- apply the routine in a simple scenario
- use the same routine again with less support

The lesson should feel:
- concrete
- repeatable
- practical
- student-facing

It should not feel:
- vague
- inspirational but unusable
- overloaded with general advice
- disconnected from a real school task

---

## 3. Default Lesson Shell

Required top-level shape:

1. `## Learning Goal`
2. `## Introduction`
3. `## Key Vocabulary` when the routine uses specific terms or labels
4. one or more routine/example sections
5. `## Summary`

Preferred section sequence:

1. learning goal
2. introduction with the study problem or task
3. vocabulary or routine names
4. routine explanation
5. worked model of the routine
6. self-application or scenario section
7. summary

Allowed variation:
- some lessons may combine the routine explanation and first model
- some lessons may use a checklist, planner, or self-rating tool as the main structure
- some lessons may use two short scenarios instead of one longer worked example

Not allowed:
- a lesson with no clear routine to practice
- a list of study tips that never becomes a method
- generic encouragement replacing the actual steps
- a scenario that is too open-ended to show the routine in action

---

## 4. Writing Rules

Reading level:
- instructions should fit the student grade band
- keep sentences short and task-focused

Tone:
- direct
- calm
- practical
- supportive

Use:
- explicit step language like `first`, `next`, `then`, and `check`
- plain verbs like `plan`, `organize`, `review`, `notice`, and `fix`
- short prompts that point to a next action
- consistent labels for the routine steps

Avoid:
- vague advice like "try your best"
- long reflection prompts before the routine is modeled
- adult-facing productivity language
- jargon that the lesson never defines

---

## 5. Section Requirements

### Learning Goal

Must:
- state 2-3 clear outcomes
- describe the routine and how it helps the student

Good pattern:
- `I can use a checklist to check my work.`
- `I can choose the next step when I get stuck.`

### Introduction

Must:
- name the school task the routine supports
- explain why the routine matters in that context

Good pattern:
- a quiz, homework page, reading assignment, notebook setup, or study session

Avoid:
- generic "being organized matters" filler
- long personal stories that do not lead into the routine

### Key Vocabulary

Must:
- define only the routine terms the student needs
- use parser-safe format: `**Term**: Definition`

Should:
- keep definitions short and operational
- name the step, tool, or habit in plain language

Avoid:
- lists of abstract self-management words that are not used later
- definitions that sound like a counselor note instead of a student tool

### Routine Explanation

Must:
- describe the steps in order
- explain what the student does at each step
- make the routine usable without extra teacher explanation

Good pattern:
- what to do before starting
- what to check while working
- what to do at the end

Avoid:
- tips without sequence
- instructions that assume the student already knows the routine
- multiple competing versions of the same routine

### Worked Model / Example

Must:
- show the routine in a real scenario
- make the steps visible one by one
- show the decision or check the student is supposed to make

Should:
- use one short model first, then a similar independent scenario
- include a checklist, organizer, or response frame when helpful

Avoid:
- abstract explanations with no scenario
- examples that are too broad to show the routine clearly
- solved self-checks that do all the thinking for the student

### Summary

Must:
- restate the routine and its use
- remind the student when to apply it

Good pattern:
- one short paragraph plus a short reminder list

---

## 6. Checkpoint Pattern

Checkpoint expectations for this archetype:
- checkpoints must be answerable from the section content
- checkpoints should move from identifying the routine to applying the next step
- checkpoints should reward the student for choosing a useful action

Default rhythm:
- identify the routine step
- choose the best next move
- apply the routine in a short scenario

Good checkpoint types:
- What should you do first in this routine?
- Which step helps you check for mistakes?
- What is the best next move if you are stuck?
- Which tool or habit fits this study problem?

Bad checkpoint types:
- generic opinion prompts
- self-esteem questions with no routine content
- repeated "why is studying important?" questions
- ambiguous prompts with no clear next step

---

## 7. Practice Pattern

Practice should feel like "use the same routine in a new situation."

Must:
- stay tied to the same study habit or self-monitoring move
- require the student to choose or apply a step
- show the routine working in context

Should:
- move from guided to more independent use
- use distractors based on common process mistakes
- include a checklist, planner, or reflection frame when useful

Avoid:
- unrelated advice prompts
- open-ended journaling that does not test the routine
- practice that asks the student to invent a routine from scratch
- scenarios that are so broad the routine does not matter

---

## 8. Visual Pattern

Visuals are often useful in this archetype when they function as tools.

Use visuals when they help the student:
- follow steps
- track progress
- compare done/not done
- plan a short routine
- check work against a list

Good visuals:
- checklists
- routine cards
- planners
- progress trackers
- simple decision trees
- self-rating scales

Visual requirements:
- labels match the routine steps exactly
- the visual has one clear use
- the design is easy to scan
- the visual can be used again outside the lesson

Bad visuals:
- decorative icons with no task role
- cluttered organizers with too many fields
- charts that do not map to the routine
- visuals that are cute but not reusable

---

## 9. Support Pattern

Hints:
- should point to the next routine step
- should narrow the decision
- should not reveal the answer letter

Quick review:
- should restate the routine in a compact sequence
- should use one example of the student applying the next step
- should make the next checkpoint easier to follow

Challenge:
- should stay inside the same routine family
- may add a new constraint, a second check, or a more independent scenario
- should not become a counseling prompt or a full planning project

---

## 10. Banned Patterns

Do not allow these in this archetype:
- placeholder vocabulary
- template filler
- generic life-advice language
- inspirational slogans without a routine
- self-reflection prompts with no academic task
- decorative planners or checklists with no instructional role
- practice that does not require the routine to be used

---

## 11. Definition Of Done

A lesson using this archetype is ready to be called gold when:
- it follows the parser-safe shell
- the routine is clear and repeatable
- the steps are in a useful order
- the model shows the routine in action
- checkpoints test next-step decisions
- practice applies the same routine in a new scenario
- visuals function as usable tools when included
- hints/review/challenge all support the same habit
- the lesson passes the rubric and checklist

---

## 12. Current Exemplar Notes

Current exemplar:
- none yet

Current reality:
- no study-skills guide lesson has been approved yet as the canonical routine exemplar
- this spec should still guide study-skills and metacognitive rewrites before exemplar selection

The first approved exemplar should prove:
- the routine is simple enough to use in the player
- the steps are concrete, not motivational filler
- the lesson makes the student choose the next action
- support tools help the student repeat the routine independently

Important boundary:
- this archetype is for academic routines and metacognitive habits
- it is not the default pattern for subject content lessons or counseling-style materials

---

## 13. Future Implementation Use

This spec should eventually govern:
- lesson metadata tagging for `study_skills_routine`
- automated lesson audits for routine clarity, step order, and scenario alignment
- bulk rewrite templates for note-taking, planning, checking work, and self-monitoring lessons
- exemplar approval for study-skills lessons that should guide similar rewrites
