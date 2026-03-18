# History / Social Studies Source Analysis

Purpose: define the authoritative archetype spec for history, civics, and social studies lessons that teach students to interpret sources, place evidence in context, and distinguish observation, fact, inference, and perspective.

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

Use this archetype for history, civics, and social studies lessons in roughly grades 4-12 when the student needs to:
- understand historical or civic context
- interpret a source, event, map, chart, or claim
- separate evidence from inference or opinion
- consider perspective, purpose, or reliability

Best-fit topics:
- primary source analysis
- secondary source interpretation
- historical causation
- compare perspectives
- chronology and context
- civic structures and documents
- map or chart interpretation in social studies
- evidence-based historical claims

Do not use this archetype for:
- reading lessons where literary or informational comprehension is the main instructional job
- current-events opinion prompts with no sourcing or evidence
- vocabulary-only social studies lessons
- science or math lessons where domain models or calculations are the main task

---

## 2. Instructional Job

This archetype should help a student:
- understand who created a source and in what context
- identify the evidence a source provides
- distinguish what the source directly shows from what can be inferred
- build a supported interpretation or claim

The lesson should feel:
- context-aware
- evidence-centered
- readable
- disciplined

It should not feel:
- like unsupported opinion sharing
- detached from time, place, or authorship
- vague
- overloaded with background that never connects to the source

---

## 3. Default Lesson Shell

Required top-level shape:

1. `## Learning Goal`
2. `## Introduction`
3. `## Key Vocabulary` when historical or civic terms need definition
4. one or more context/source-analysis sections
5. `## Summary`

Preferred section sequence:

1. learning goal
2. introduction with the historical question, issue, or context
3. vocabulary or source framing
4. context or source-focus section
5. evidence/example section
6. interpretation or perspective section
7. summary

Allowed variation:
- some lessons may combine context and first source analysis
- some lessons may compare two sources in separate sections before synthesis
- some lessons may use a timeline, map, or chart section before interpretation

Not allowed:
- source questions with no source framing
- opinion prompts before evidence is surfaced
- long background sections that never return to the source
- using a quote, image, or chart with no explanation of why it matters

---

## 4. Writing Rules

Reading level:
- instructions should fit the student grade band
- explanations should stay concise enough that context and evidence remain visible

Tone:
- direct
- precise
- context-aware
- supportive

Use:
- explicit sourcing language like `who`, `when`, `where`, and `why`
- plain verbs like `identify`, `compare`, `infer`, `support`, and `explain`
- clear separation between source detail and interpretation
- consistent naming for the document, speaker, leader, group, or institution

Avoid:
- vague prompts like "How do you feel about this?"
- present-day judgment with no historical context
- jargon with no definition
- treating inference as if it were directly stated fact

---

## 5. Section Requirements

### Learning Goal

Must:
- state 2-3 clear outcomes
- include both the evidence task and the interpretation task when both matter

Good pattern:
- `I can identify who created a source and why it was created.`
- `I can use evidence from a source to support a historical claim.`

### Introduction

Must:
- anchor the lesson in a historical question, event, issue, or civic problem
- tell the student what they should figure out from the source or evidence

Good pattern:
- name the event, time period, institution, or debate and the question students will investigate

Avoid:
- generic statements about why history matters
- long narration before the source or claim is introduced

### Key Vocabulary

Must:
- define only the terms needed for this lesson
- use parser-safe format: `**Term**: Definition`

Should:
- keep definitions tied to the lesson context
- define source-related terms like `primary source`, `perspective`, or `bias` only when the lesson uses them directly

Avoid:
- oversized glossary blocks
- abstract definitions that do not help interpret the evidence

### Context / Source Focus

Must:
- identify the source, event, map, chart, or document being analyzed
- surface the key contextual information the student needs
- make clear what kind of evidence the student should notice

Should:
- point to author, date, audience, place, or purpose directly
- separate multiple source details with bullets when that improves clarity

Avoid:
- dropping a quote or image with no context
- asking for interpretation before students know what the source is
- hiding the sourcing details inside dense prose

### Evidence / Example

Must:
- identify the specific detail, quote, map feature, or chart pattern that matters
- distinguish observation from interpretation
- connect the evidence to the historical or civic question

Good pattern:
- what the source directly shows
- what that detail suggests
- how it supports or limits a claim

Should:
- compare two pieces of evidence when that sharpens interpretation
- note when a source is limited, incomplete, or perspective-bound

Avoid:
- quote dumping with no explanation
- unsupported inference
- claiming certainty when the source only suggests a conclusion

### Interpretation / Perspective

Must:
- explain what conclusion can reasonably be drawn
- account for point of view, purpose, or reliability when relevant
- separate fact, evidence, and inference clearly

Good pattern:
- source detail
- likely meaning or perspective
- why that interpretation is reasonable

Avoid:
- unsupported moralizing
- modern assumptions presented as historical fact
- treating all sources as equally reliable without discussion

### Summary

Must:
- restate the historical or civic takeaway
- remind the student how sourcing and evidence support interpretation

Good pattern:
- one short paragraph plus a reminder list

---

## 6. Checkpoint Pattern

Checkpoint expectations for this archetype:
- checkpoints must be answerable from the section content
- checkpoints should move from sourcing to evidence to inference or claim
- checkpoints should reward careful reading of sources, not generic prior knowledge

Default rhythm:
- identify the source context
- choose the evidence that matters
- interpret the evidence or perspective

Good checkpoint types:
- Who created this source, and when?
- Which detail best supports the claim?
- What can you reasonably infer from this map, chart, or quote?
- Why might this author present the event this way?

Bad checkpoint types:
- unsupported opinion prompts
- outside-history trivia not taught in the lesson
- repeated date-recall items with no source analysis
- ambiguous inference questions with multiple equally reasonable answers because the prompt is underspecified

---

## 7. Practice Pattern

Practice should feel like "analyze a source or claim using the same moves with less support."

Must:
- stay tied to the same event, issue, or source-analysis skill
- require evidence-based reasoning
- align with the sourcing and interpretation moves modeled in the lesson

Should:
- move from direct sourcing to evidence selection to supported interpretation
- use distractors based on real historical misreadings or incomplete sourcing
- include a short response frame when younger students need support

Avoid:
- practice that can be answered from opinion alone
- unsupported "Which side is better?" prompts
- new source types that were not introduced at all in the lesson
- answer choices that blur fact and inference without the lesson teaching that distinction

---

## 8. Visual Pattern

Visuals are often useful in this archetype when they carry historical or civic evidence.

Use visuals when they help the student:
- place events in time
- locate places or regions
- inspect a source excerpt or artifact
- compare data, populations, votes, or changes over time

Good visuals:
- timelines
- maps
- source excerpts
- political cartoons
- charts and graphs
- document callouts
- institutional diagrams when civics structure matters

Visual requirements:
- dates, labels, captions, and locations match the text exactly
- the visual has one clear evidentiary job
- any excerpted source detail matches the lesson content exactly
- the image can be described in simple alt-text style language

Bad visuals:
- decorative patriotic or historical imagery with no lesson role
- maps with unclear labels or misleading boundaries
- charts with missing axes or vague captions
- source images shown with no context or explanation

---

## 9. Support Pattern

Hints:
- should point the student back to source, date, author, audience, map label, or quoted detail
- should narrow the interpretation move
- should not reveal the answer letter

Quick review:
- should restate the context, evidence, and interpretation in compact form
- should use one micro-example of sourcing plus evidence when helpful
- should make the next checkpoint easier to parse

Challenge:
- should stay inside the same event, issue, or source-analysis skill
- may ask the student to compare two perspectives, weigh evidence, or judge the stronger support
- should not jump into a full essay or debate unless the lesson already prepared for that

---

## 10. Banned Patterns

Do not allow these in this archetype:
- placeholder vocabulary
- template filler
- unsupported historical claims
- opinion prompts with no sourcing or evidence
- quote or image dumps with no explanation
- blurred fact/inference boundaries
- decorative visuals with no evidentiary role
- practice that depends on outside historical knowledge not taught in the lesson

---

## 11. Definition Of Done

A lesson using this archetype is ready to be called gold when:
- it follows the parser-safe shell
- the historical or civic context is clear
- sources are framed with enough sourcing information
- evidence and inference are distinguished explicitly
- checkpoints vary across sourcing, evidence, and interpretation
- practice aligns with the modeled source-analysis skill
- visuals are accurate and carry real evidentiary value
- hints/review/challenge reinforce the same context and analysis move
- the lesson passes the rubric and checklist

---

## 12. Current Exemplar Notes

Current exemplar:
- none yet

Current reality:
- no history or social studies guide lesson has been approved yet as the canonical source-analysis exemplar
- this spec should still guide history, civics, and social studies rewrites before exemplar selection

The first approved exemplar should prove:
- context and sourcing are explicit without becoming bloated
- the lesson distinguishes evidence, fact, and inference clearly
- maps, excerpts, charts, or documents do real teaching work
- support tools help students analyze sources instead of guessing from prior knowledge

Important boundary:
- this archetype is for source, evidence, and perspective analysis in history and social studies
- it is not the default pattern for generic reading comprehension or unsupported opinion discussion

---

## 13. Future Implementation Use

This spec should eventually govern:
- lesson metadata tagging for `history_source_analysis`
- automated lesson audits for sourcing clarity, evidence/inference separation, and visual evidence quality
- bulk rewrite templates for history, civics, and social studies source-analysis lessons
- exemplar approval for history/social studies lessons that should guide similar rewrites
