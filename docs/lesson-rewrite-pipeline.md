# Lesson Rewrite Pipeline

Purpose: define the operational rewrite path for lessons in this repo, using the existing classification heuristics, cleanup scripts, metadata seeders, practice generators, and governance docs as one controlled rewrite system.

Status:
- `Draft`

Related docs:
- [lesson-source-of-truth.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-source-of-truth.md)
- [lesson-archetypes.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-archetypes.md)
- [lesson-audit-pipeline.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-audit-pipeline.md)
- [lesson-exemplar-approval.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-approval.md)
- [lesson-exception-review-workflow.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exception-review-workflow.md)
- [pilot-improvement.md](/Users/drmixer/code/ElevatEDNEW/docs/pilot-improvement.md)

Primary implementation references:
- [seed_lesson_metadata.ts](/Users/drmixer/code/ElevatEDNEW/scripts/seed_lesson_metadata.ts)
- [improve_lesson_content.ts](/Users/drmixer/code/ElevatEDNEW/scripts/improve_lesson_content.ts)
- [cleanup_content_issues.ts](/Users/drmixer/code/ElevatEDNEW/scripts/cleanup_content_issues.ts)
- [final_content_cleanup.ts](/Users/drmixer/code/ElevatEDNEW/scripts/final_content_cleanup.ts)
- [generate_practice_for_all_lessons.ts](/Users/drmixer/code/ElevatEDNEW/scripts/generate_practice_for_all_lessons.ts)
- [generate_remaining_practice.ts](/Users/drmixer/code/ElevatEDNEW/scripts/generate_remaining_practice.ts)
- [import_authored_practice.ts](/Users/drmixer/code/ElevatEDNEW/scripts/import_authored_practice.ts)
- [add_lesson_visuals.ts](/Users/drmixer/code/ElevatEDNEW/scripts/add_lesson_visuals.ts)
- [add_lesson_images.ts](/Users/drmixer/code/ElevatEDNEW/scripts/add_lesson_images.ts)

---

## 1. Pipeline Goal

The rewrite pipeline should take a lesson from:
- "audited and classified"

to:
- "rewritten under the correct archetype"
- "linked to the right metadata, practice, and visual support"
- "ready for re-audit and possible exemplar review"

The rewrite pipeline is not one giant AI rewrite command.

It is the sequence that decides:
- which lesson row is the real target
- which archetype governs the rewrite
- which fixes are deterministic cleanup versus full content rewrite
- when practice, visuals, and metadata should be attached
- when the lesson is ready to re-enter audit

---

## 2. Entry Conditions

A lesson should enter the rewrite pipeline only after:
- the canonical lesson choice is known
- an initial audit status exists
- a working archetype assignment exists, or the lesson is explicitly routed to exception review

Do not start a rewrite if:
- there are competing lesson variants and no canonical choice
- the lesson is blocked on runtime/product constraints
- the archetype fit is so unclear that the rewrite would be guesswork

Those cases go to:
- canonical resolution
- exception review
- or product backlog

---

## 3. Step 1: Classify The Lesson

Every rewrite begins by classifying the lesson into an archetype.

Current repo support:
- [lesson-archetypes.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-archetypes.md) gives first-pass mapping heuristics
- [seed_lesson_metadata.ts](/Users/drmixer/code/ElevatEDNEW/scripts/seed_lesson_metadata.ts) already seeds subject, difficulty, skills, and standards metadata that can support later archetype tagging

Current practical rule:
- use subject + grade band + instructional job to assign the archetype
- if two archetypes appear plausible, stop and use [lesson-exception-review-workflow.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exception-review-workflow.md)

Future target:
- store the archetype directly in lesson metadata so downstream scripts do not re-guess it

---

## 4. Step 2: Choose The Rewrite Lane

Not every lesson needs the same level of rewrite.

### Lane A. Deterministic Cleanup

Use when the lesson structure is mostly sound, but there are known fixable issues.

Current script examples:
- [cleanup_content_issues.ts](/Users/drmixer/code/ElevatEDNEW/scripts/cleanup_content_issues.ts)
- `fix_*` scripts in [`scripts/`](/Users/drmixer/code/ElevatEDNEW/scripts)

Typical problems:
- placeholder text
- teacher-facing residue
- grade-inappropriate terms or images
- small structural fixes

### Lane B. Full Lesson Rewrite

Use when the lesson is too generic, template-driven, or weak to repair with narrow edits.

Current script examples:
- [improve_lesson_content.ts](/Users/drmixer/code/ElevatEDNEW/scripts/improve_lesson_content.ts)
- [final_content_cleanup.ts](/Users/drmixer/code/ElevatEDNEW/scripts/final_content_cleanup.ts)
- [generate_student_content.ts](/Users/drmixer/code/ElevatEDNEW/scripts/generate_student_content.ts)

Typical problems:
- generic intros and goals
- missing or weak examples
- template lesson shell with no real instructional content
- no visible fit to the archetype spec

### Lane C. Practice / Support Repair

Use when the lesson body is acceptable or nearly acceptable, but practice support is missing or weak.

Current script examples:
- [generate_practice_for_all_lessons.ts](/Users/drmixer/code/ElevatEDNEW/scripts/generate_practice_for_all_lessons.ts)
- [generate_remaining_practice.ts](/Users/drmixer/code/ElevatEDNEW/scripts/generate_remaining_practice.ts)
- [import_authored_practice.ts](/Users/drmixer/code/ElevatEDNEW/scripts/import_authored_practice.ts)
- [verify_practice_coverage.ts](/Users/drmixer/code/ElevatEDNEW/scripts/verify_practice_coverage.ts)

Typical problems:
- no lesson-skill linkage
- no question-bank linkage
- practice exists but is generic or weak

### Lane D. Visual Repair

Use when the archetype expects visuals or when the current lesson is visually misleading.

Current script examples:
- [add_lesson_visuals.ts](/Users/drmixer/code/ElevatEDNEW/scripts/add_lesson_visuals.ts)
- [add_lesson_images.ts](/Users/drmixer/code/ElevatEDNEW/scripts/add_lesson_images.ts)
- [audit_visual_needs.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_visual_needs.ts)

Typical problems:
- no visuals where the archetype expects them
- incorrect or misleading visuals
- weak alignment between lesson numbers/text and diagrams

### Lane E. Metadata / Tagging Repair

Use when the lesson content exists but downstream systems cannot classify or support it cleanly.

Current script examples:
- [seed_lesson_metadata.ts](/Users/drmixer/code/ElevatEDNEW/scripts/seed_lesson_metadata.ts)
- [seed_practice_questions.ts](/Users/drmixer/code/ElevatEDNEW/scripts/seed_practice_questions.ts)

Typical problems:
- missing difficulty / standards / skills metadata
- no reliable lesson-skill-practice bridge
- missing future archetype tag

---

## 5. Rewrite Order Inside A Batch

Use this order for a controlled rewrite batch:

1. resolve canonical lesson choice
2. assign archetype
3. run deterministic cleanup
4. decide whether the lesson still needs a full rewrite
5. repair or generate metadata
6. repair or generate practice
7. repair or generate visuals
8. re-run audits
9. route the lesson to `gold`, `near_gold`, `needs_rewrite`, `exception_review`, or exemplar review

This order matters.

For example:
- do not generate practice before the lesson’s instructional job is stable
- do not approve visuals before the rewritten text is final
- do not send a lesson to exemplar review before post-rewrite audit

---

## 6. Rewrite Rules By Archetype

The rewrite pipeline should not treat every subject the same.

Use the archetype spec to decide:
- required section shell
- checkpoint pattern
- practice pattern
- visual expectations
- banned patterns

Operational rule:
- rewrite to the archetype spec first
- then compare the result to the exemplar for that archetype, if one exists

Do not rewrite toward:
- a generic house style with no instructional pattern
- a different subject’s exemplar
- the perimeter lesson as if it were a universal template

---

## 7. Allowed Outputs

A rewrite pass may produce one or more of these outputs:
- updated lesson body content
- updated lesson metadata
- new or repaired lesson-skill links
- new or repaired question-bank links
- new or repaired visuals
- queue notes for exception or exemplar review

It should not silently produce:
- a lesson rewritten against the wrong archetype
- practice that teaches a different concept than the lesson body
- visuals that were never checked against the text

---

## 8. When To Stop Rewriting

Stop rewriting and re-audit when:
- the lesson matches the relevant archetype spec
- the main blockers from the last audit are resolved
- the support layers no longer contradict the lesson body
- the remaining questions are about approval, not basic lesson repair

Do not keep rewriting indefinitely to chase taste.

At that point the lesson should move to:
- audit
- exemplar review
- or exception review

---

## 9. Rewrite Failure Conditions

Stop and escalate instead of continuing the rewrite when:
- the lesson’s archetype fit collapses during rewrite
- the lesson needs player behavior the current runtime cannot support
- the canonical choice becomes unclear
- the rewrite would effectively create a new lesson rather than repair the current one

Those cases should move to:
- [lesson-exception-review-workflow.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exception-review-workflow.md)

---

## 10. Current Repo Reality

What already exists:
- multiple cleanup and generation scripts
- metadata seeding for skills, standards, and difficulty
- practice generation and practice-gap analysis
- visual generation / visual-need auditing
- a K-5 math pilot pattern already validated around lesson `1437`

What does not exist yet:
- stored archetype metadata
- one orchestrated rewrite runner that chooses the correct lane automatically
- a shared batch report that says which rewrite lane each lesson entered and why

This doc defines the target pipeline the repo should move toward.

---

## 11. Recommended Next Implementation Step

The first implementation step after this doc should be:
- store archetype tags in lesson metadata
- make audit outputs assign rewrite lanes explicitly
- run deterministic cleanup before any AI or generated rewrite step
- require post-rewrite re-audit before a lesson can move to exemplar review

Without that sequencing, the repo can rewrite lessons, but it cannot yet govern rewrites consistently.
