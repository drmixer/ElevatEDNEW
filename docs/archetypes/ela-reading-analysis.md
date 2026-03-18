# ELA Reading / Analysis

Purpose: define the authoritative archetype spec for ELA lessons that teach students to read closely, identify relevant evidence, and turn that evidence into a supported claim or interpretation.

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

Use this archetype for ELA lessons in roughly grades 3-12 when the student needs to:
- read a passage or excerpt with a clear purpose
- identify relevant details from the text
- connect those details to a claim, idea, or interpretation
- practice evidence-based responses

Best-fit topics:
- main idea and supporting details
- theme or central idea
- character analysis
- point of view
- author's purpose
- vocabulary in context
- compare/contrast across passages
- informational text analysis

Do not use this archetype for:
- phonics or decoding lessons
- isolated grammar lessons with no shared text analysis
- writing-only lessons centered on drafting or revision
- history or science lessons where sourcing, chronology, or domain evidence is the main instructional job

---

## 2. Instructional Job

This archetype should help a student:
- understand what the reading task is asking them to notice
- locate the details in the text that matter most
- distinguish between summary, evidence, and interpretation
- build a short supported response

The lesson should feel:
- text-anchored
- specific
- readable
- structured

It should not feel:
- vague
- discussion-only
- filler-heavy
- detached from the passage

---

## 3. Default Lesson Shell

Required top-level shape:

1. `## Learning Goal`
2. `## Introduction`
3. `## Key Vocabulary` when the passage or task needs it
4. one or more reading/analysis sections
5. `## Summary`

Preferred section sequence:

1. learning goal
2. introduction with reading purpose and what to notice
3. vocabulary or text context
4. excerpt or text-focus section
5. model analysis or worked response
6. contrast, second example, or compare-text section when needed
7. summary

Allowed variation:
- short lessons may combine text focus and the first model analysis
- younger-grade lessons may include a response frame earlier
- paired-text lessons may use one section per text before a synthesis section

Not allowed:
- a long passage dump with no guidance about what matters
- an interpretation prompt before the lesson surfaces any evidence
- vocabulary lists that never connect back to the text
- generic discussion questions standing in for the lesson arc

---

## 4. Writing Rules

Reading level:
- instructions should read at or below the student grade band
- default to short, concrete sentences even when the source text is more complex

Tone:
- direct
- precise
- text-centered
- supportive

Use:
- explicit references to `the text`, `the paragraph`, `the line`, or `the excerpt`
- short quoted details only when they are instructionally necessary
- sentence frames when they clearly support the task
- consistent naming for the speaker, narrator, character, or author

Avoid:
- vague prompts like "What do you think?" with no evidence requirement
- long plot summary that replaces analysis
- literary jargon with no explanation
- teacher-facing meta directions inside the lesson body

---

## 5. Section Requirements

### Learning Goal

Must:
- state 2-3 clear reading or analysis outcomes
- use student-friendly language

Good pattern:
- `I can find details that support the main idea.`
- `I can explain what a character learns using evidence from the text.`

### Introduction

Must:
- identify the reading purpose
- name what the student should watch for while reading

Good pattern:
- tell the student to notice a character change, repeated detail, key claim, or author choice

Avoid:
- generic statements about why reading matters
- long background information that delays the actual task

### Key Vocabulary

Must:
- define only the terms the student truly needs for this text or task
- use parser-safe format: `**Term**: Definition`

Should:
- keep definitions short
- explain the term in the context of this reading task when possible

Avoid:
- large word banks that do not affect the analysis work
- dictionary-style definitions with no lesson role

### Text Focus

Must:
- identify the part of the passage or excerpt the student should focus on
- surface the details that matter for the target reading move
- keep the text reference readable and scannable

Should:
- point to paragraph, line, stanza, scene, or section when relevant
- use bullets if several details need to be separated clearly

Avoid:
- copying long chunks of text with no instructional framing
- asking for a claim before the student has seen the evidence
- hiding the relevant text detail inside a dense paragraph

### Model Analysis / Worked Response

Must:
- show the relationship between claim, evidence, and reasoning explicitly
- model what a supported answer sounds like
- distinguish between what the text says and what the student can infer from it

Good pattern:
- claim
- text detail
- explanation of what the detail shows

Should:
- include one short sentence frame when that helps transfer
- contrast a strong answer with a weaker unsupported answer when useful

Avoid:
- answer-only models
- quote dumping with no explanation
- unsupported interpretation

### Summary

Must:
- restate the reading move
- remind the student how to support an answer with the text

Good pattern:
- one short paragraph plus a reminder list

---

## 6. Checkpoint Pattern

Checkpoint expectations for this archetype:
- checkpoints must be answerable from the section content
- checkpoints should move from understanding to evidence to interpretation
- checkpoints should reward returning to the text, not guessing from vibes

Default rhythm:
- literal meaning or vocabulary in context
- identify the best evidence or relevant detail
- interpret what the evidence shows

Good checkpoint types:
- Which detail best shows the main idea?
- What does this line suggest about the character?
- Which sentence from the text best supports the claim?
- Why does the author include this detail?

Bad checkpoint types:
- opinion prompts with no text basis
- trivia outside the passage
- ambiguous questions with multiple equally defensible answers
- repeated near-identical evidence questions in every section

---

## 7. Practice Pattern

Practice should feel like "use the same reading move on your own."

Must:
- stay tied to the lesson text, excerpt, or a clearly introduced paired text
- require evidence-based reasoning
- have one defensible best answer when the task is multiple choice

Should:
- move from evidence identification to explanation or comparison
- use distractors based on plausible misreadings, not nonsense options
- include a response frame for younger students or remediation when useful

Avoid:
- generic reflection prompts as the main practice
- questions answerable without reading the text
- distractors that all seem correct because the lesson never modeled the distinction
- practice that depends on teacher explanation not present in the lesson

---

## 8. Visual Pattern

Visuals are optional in this archetype, but they should do specific literacy work when used.

Use visuals when they help the student:
- track evidence
- annotate a short excerpt
- compare ideas across texts
- organize character, theme, or main-idea relationships

Good visuals:
- excerpt callouts
- paragraph or stanza labels
- annotation models
- story maps
- main-idea/detail organizers
- compare/contrast charts

Visual requirements:
- labels match the text and task
- any quoted detail matches the lesson content exactly
- the organizer has one clear instructional purpose
- the visual supports the reading move instead of replacing it

Bad visuals:
- decorative stock images
- character art that adds facts not in the text
- dense infographics with no direct lesson role
- visuals that replace the passage instead of helping the student read it

---

## 9. Support Pattern

Hints:
- should point the student back to a specific paragraph, line, or detail
- should narrow the reading move
- should not reveal the answer letter

Quick review:
- should restate the reading move simply
- should use one micro-example of claim + evidence when helpful
- should make the next checkpoint easier to interpret

Challenge:
- should deepen the same text-analysis skill
- may ask the student to compare two details, justify the strongest evidence, or extend the interpretation
- should not jump to a full essay or an unrelated writing task

---

## 10. Banned Patterns

Do not allow these in this archetype:
- placeholder vocabulary
- template filler
- unsupported claims
- plot summary presented as analysis
- quote dumping with no explanation
- opinion prompts that do not require text evidence
- multiple-choice items with more than one equally valid answer
- decorative visuals with no instructional role

---

## 11. Definition Of Done

A lesson using this archetype is ready to be called gold when:
- it follows the parser-safe shell
- the reading purpose is clear
- the text focus is explicit
- the model analysis shows claim, evidence, and reasoning
- checkpoints are varied and text-anchored
- practice aligns with the same reading move
- visuals are useful when included
- hints/review/challenge all push the student back toward the text
- the lesson passes the rubric and checklist

---

## 12. Current Exemplar Notes

Current exemplar:
- none yet

Current reality:
- no ELA guide lesson has been approved yet as the canonical reading-analysis exemplar
- this spec should still guide ELA rewrites before exemplar selection

The first approved exemplar should prove:
- claims are tied to text evidence
- vocabulary is contextualized
- checkpoints and practice stay anchored to the same reading task
- support tools help the student return to the text instead of guessing

Important boundary:
- this archetype is for reading and analysis lessons
- it is not the default pattern for grammar drills, phonics, or standalone writing workshops

---

## 13. Future Implementation Use

This spec should eventually govern:
- lesson metadata tagging for `ela_reading_analysis`
- automated lesson audits for evidence grounding and parser-safe structure
- bulk rewrite templates for main idea, theme, character, and author's purpose lessons
- exemplar approval for ELA lessons that should guide similar rewrites
