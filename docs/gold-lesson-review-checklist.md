# Gold Lesson Review Checklist

Use this checklist when reviewing a lesson against the standard in [gold-lesson-rubric.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-rubric.md).

This is meant to be fast to use during audits. Mark each item:
- `Pass`
- `Partial`
- `Fail`
- `N/A`

Suggested rule:
- a lesson is not "gold" if any core item is `Fail`
- a lesson is not ready to serve as a guide lesson if more than 2 core items are `Partial`

---

## Review Metadata

- Lesson ID:
- Lesson title:
- Subject:
- Grade band:
- Canonical variant:
- Reviewer:
- Date:

---

## Core Review

### 1. Canonical Choice

- `Pass / Partial / Fail / N/A` The lesson is the version the app should serve by default.
- `Pass / Partial / Fail / N/A` There is no competing draft or deprecated sibling that should be the real target instead.

Notes:

### 2. Content Quality

- `Pass / Partial / Fail / N/A` No placeholder vocabulary or filler text.
- `Pass / Partial / Fail / N/A` No contradictory instructions or misleading examples.
- `Pass / Partial / Fail / N/A` No solved "practice" section that gives away the actual practice answers.
- `Pass / Partial / Fail / N/A` The lesson reads like finished instructional content, not a rough generation.

Notes:

### 3. Parser-Friendly Markdown

- `Pass / Partial / Fail / N/A` Uses stable `##` section headings.
- `Pass / Partial / Fail / N/A` Objectives parse cleanly from a list.
- `Pass / Partial / Fail / N/A` Vocabulary parses cleanly from `**Term**: Definition`.
- `Pass / Partial / Fail / N/A` Summary is clearly marked and recognized as a summary.

Notes:

### 4. Learn Arc

- `Pass / Partial / Fail / N/A` Introduction explains why the lesson matters.
- `Pass / Partial / Fail / N/A` The core concept is explained directly and clearly.
- `Pass / Partial / Fail / N/A` At least one worked example is present when the topic needs one.
- `Pass / Partial / Fail / N/A` Sections build logically instead of feeling repetitive or disconnected.
- `Pass / Partial / Fail / N/A` Summary reinforces the main takeaway.

Notes:

### 5. Checkpoints And Practice

- `Pass / Partial / Fail / N/A` Checkpoints are answerable from the section content.
- `Pass / Partial / Fail / N/A` Checkpoints are varied and not repeating the same question pattern.
- `Pass / Partial / Fail / N/A` Practice questions match the lesson concept.
- `Pass / Partial / Fail / N/A` Hints help without revealing the answer letter.
- `Pass / Partial / Fail / N/A` Quick review and challenge are coherent with the lesson topic.

Notes:

### 6. Visual Quality

- `Pass / Partial / Fail / N/A` Visuals match the prompt text and numbers.
- `Pass / Partial / Fail / N/A` Visuals clarify the concept instead of distracting from it.
- `Pass / Partial / Fail / N/A` Visuals are age-appropriate and instructionally relevant.
- `Pass / Partial / Fail / N/A` No diagram/shape mismatch or misleading rendering.

Notes:

### 7. Audit And Runtime Cleanliness

- `Pass / Partial / Fail / N/A` No placeholder or structure issues remain.
- `Pass / Partial / Fail / N/A` Practice linkage is present if the lesson is expected to use native practice.
- `Pass / Partial / Fail / N/A` The lesson behaves correctly in the player.
- `Pass / Partial / Fail / N/A` No obvious rendering or interaction regressions remain.

Notes:

---

## Subject-Specific Addendum

Only fill out the section that applies.

### K-5 Math

- `Pass / Partial / Fail / N/A` Language is concrete and age-appropriate.
- `Pass / Partial / Fail / N/A` Numbers and units are visible and easy to follow.
- `Pass / Partial / Fail / N/A` Steps are explicit and short.
- `Pass / Partial / Fail / N/A` Worked examples make the rule easy to transfer.
- `Pass / Partial / Fail / N/A` Support feels scaffolded rather than abstract.

### Upper Math

- `Pass / Partial / Fail / N/A` Notation and assumptions are defined.
- `Pass / Partial / Fail / N/A` Worked examples show reasoning, not just answers.
- `Pass / Partial / Fail / N/A` The lesson distinguishes concept, procedure, and interpretation.
- `Pass / Partial / Fail / N/A` The level of formality fits the grade and topic.

### ELA

- `Pass / Partial / Fail / N/A` Claims are tied to text evidence.
- `Pass / Partial / Fail / N/A` Vocabulary is contextualized, not dumped.
- `Pass / Partial / Fail / N/A` Response modeling supports the actual task.

### Science

- `Pass / Partial / Fail / N/A` The lesson is anchored in an observation, model, or phenomenon where appropriate.
- `Pass / Partial / Fail / N/A` Evidence and reasoning are clearly connected.
- `Pass / Partial / Fail / N/A` Diagrams or models support understanding when needed.

### Social Studies / History

- `Pass / Partial / Fail / N/A` Context and sourcing are clear.
- `Pass / Partial / Fail / N/A` Fact and inference are not blurred together.
- `Pass / Partial / Fail / N/A` Perspective and interpretation are handled responsibly.

---

## Final Decision

- Overall status: `Gold / Near Gold / Not Gold`
- Can this lesson be used as a guide exemplar for similar lessons? `Yes / No`
- Highest-priority fixes:
- Follow-up owner:

---

## Quick Heuristic

If you need a fast answer, ask:

1. Is this the canonical lesson we actually want to serve?
2. Does it read like finished instructional content?
3. Does it parse and behave cleanly in the player?
4. Do checkpoints, visuals, and practice all reinforce the same concept?
5. Would I be comfortable telling someone to copy this pattern for the next 10 lessons in the same domain?

If the answer to any of those is "no," it is not a gold guide lesson yet.
