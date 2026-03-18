# Lesson Audit Pipeline

Purpose: define the operational audit path for lesson quality in this repo, using the existing scripts, review checklist, archetype specs, and governance docs as one pipeline instead of disconnected spot checks.

Status:
- `Draft`

Related docs:
- [lesson-source-of-truth.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-source-of-truth.md)
- [gold-lesson-rubric.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-rubric.md)
- [gold-lesson-review-checklist.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-review-checklist.md)
- [lesson-archetypes.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-archetypes.md)
- [lesson-exemplar-approval.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-approval.md)
- [lesson-exception-review-workflow.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exception-review-workflow.md)
- [lesson-source-of-truth-ownership.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-source-of-truth-ownership.md)

Primary implementation references:
- [audit_content_quality.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_content_quality.ts)
- [audit_lesson_content.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_lesson_content.ts)
- [audit_completeness.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_completeness.ts)
- [audit_practice_coverage.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_practice_coverage.ts)
- [analyze_practice_gap.ts](/Users/drmixer/code/ElevatEDNEW/scripts/analyze_practice_gap.ts)
- [check_missing_practice.ts](/Users/drmixer/code/ElevatEDNEW/scripts/check_missing_practice.ts)
- [audit_visual_needs.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_visual_needs.ts)
- [validate_content.ts](/Users/drmixer/code/ElevatEDNEW/scripts/validate_content.ts)
- [sample_content_review.ts](/Users/drmixer/code/ElevatEDNEW/scripts/sample_content_review.ts)
- [contentQualityService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/contentQualityService.ts)

---

## 1. Pipeline Goal

The audit pipeline should answer four questions in a repeatable order:

1. Is this the canonical lesson record we actually intend to serve?
2. Does the lesson body meet baseline structure and content quality requirements?
3. Do practice, visuals, and runtime behavior support the same instructional job?
4. Is the lesson good enough to be marked `gold`, `near_gold`, `needs_rewrite`, or `exception_review`?

This pipeline is not just a content lint pass.

It is the decision path that decides:
- whether a lesson can stay in normal cleanup
- whether it belongs in exemplar review
- whether it must go to exception review
- whether it is blocked on product/runtime issues

---

## 2. Source Of Truth Inputs

Every audit should be grounded in the same authority stack:
- [gold-lesson-rubric.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-rubric.md)
- [gold-lesson-review-checklist.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-review-checklist.md)
- the relevant archetype spec in [`docs/archetypes/`](/Users/drmixer/code/ElevatEDNEW/docs/archetypes)
- [lessonContentParser.ts](/Users/drmixer/code/ElevatEDNEW/src/lib/lessonContentParser.ts) and related runtime constraints
- [lesson-exception-review-workflow.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exception-review-workflow.md) when the lesson does not fit normal cleanup

If an audit script produces a result that conflicts with the rubric or archetype spec, the script output is evidence, not the final authority.

---

## 3. Audit Stages

Run audits in stages. Do not jump straight to human review if the lesson still fails basic machine checks.

### Stage 0. Inventory / Completeness

Goal:
- verify the lesson is linked, publishable, and not structurally orphaned

Current script references:
- [audit_completeness.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_completeness.ts)
- [audit_database.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_database.ts)

Checks:
- module linkage exists
- published/public lesson coverage is visible
- baseline assessment / standards / asset gaps are known

Failure examples:
- no module linkage
- no public lesson in a module
- lesson exists in a module with no surrounding content structure

### Stage 1. Lesson Body / Structure Audit

Goal:
- catch missing shell sections, placeholder text, generic template content, or obviously weak lesson bodies

Current script references:
- [audit_lesson_content.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_lesson_content.ts)
- [audit_content_quality.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_content_quality.ts)
- [validate_content.ts](/Users/drmixer/code/ElevatEDNEW/scripts/validate_content.ts)

Checks already present in repo:
- title / learning goals / introduction / summary presence
- placeholder and template pattern detection
- minimum content length heuristics
- vocabulary / example / resource presence
- grade-inappropriate terms
- obvious teacher-facing template residue

Primary output:
- `data/audits/content_quality_report.json`

### Stage 2. Practice Coverage / Practice Quality

Goal:
- verify that lessons expected to use native practice actually have concept-aligned questions and usable lesson-skill-question links

Current script references:
- [audit_practice_coverage.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_practice_coverage.ts)
- [analyze_practice_gap.ts](/Users/drmixer/code/ElevatEDNEW/scripts/analyze_practice_gap.ts)
- [check_missing_practice.ts](/Users/drmixer/code/ElevatEDNEW/scripts/check_missing_practice.ts)
- [verify_practice_coverage.ts](/Users/drmixer/code/ElevatEDNEW/scripts/verify_practice_coverage.ts)

Checks:
- lesson has `lesson_skills` linkage
- linked skills have usable `question_skills` coverage
- question bank coverage exists by subject / grade / skill / standard
- practice gaps are distinguishable from "lesson intentionally does not use native practice"

Primary outputs already used by scripts:
- `data/audits/content_quality_report.json`
- `data/audits/lessons_needing_practice.json`

### Stage 3. Visual Need / Visual Quality

Goal:
- distinguish lessons that merely could use visuals from lessons whose current visuals are wrong, misleading, or missing for the archetype

Current script references:
- [audit_visual_needs.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_visual_needs.ts)
- [lessonVisuals.ts](/Users/drmixer/code/ElevatEDNEW/src/lib/lessonVisuals.ts)
- [lessonVisuals.test.ts](/Users/drmixer/code/ElevatEDNEW/src/lib/__tests__/lessonVisuals.test.ts)

Checks:
- visual-benefit priority by subject/topic keywords
- presence or absence of image/media links
- known visual mismatch risks
- whether visuals are teaching aids or just decorative assets

Important rule:
- "needs visuals" and "visual is wrong" are not the same severity

### Stage 4. Human Spot Review

Goal:
- apply the actual lesson standard, not just script heuristics

Current references:
- [gold-lesson-review-checklist.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-review-checklist.md)
- [sample_content_review.ts](/Users/drmixer/code/ElevatEDNEW/scripts/sample_content_review.ts)

Required review focus:
- canonical lesson choice
- coherent Learn arc
- checkpoint relevance and variation
- practice concept alignment
- hint / quick review / challenge coherence
- subject-specific addendum for the archetype

### Stage 5. Exemplar / Exception Routing

Goal:
- decide whether the lesson is a normal cleanup case, an exemplar candidate, or an exception case

Current references:
- [lesson-exemplar-approval.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-approval.md)
- [lesson-exception-review-workflow.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exception-review-workflow.md)

Rules:
- if a lesson fits an archetype and can be repaired normally, keep it in the rewrite queue
- if it is strong enough to guide similar lessons, move it to exemplar review
- if it does not fit safely into the archetype path, move it to exception review

---

## 4. Automatic Vs Human Audit Boundary

### Safe To Automate

These checks can be automated reliably enough to gate queue formation:
- missing section headers
- missing learning goals or summary
- placeholder text and template residue
- obvious content-length failures
- lesson / skill / question linkage gaps
- broad visual-need scoring
- canonical data completeness checks

### Requires Human Review

These checks should not be decided by scripts alone:
- whether the lesson truly matches an archetype
- whether examples are instructionally strong
- whether a checkpoint is genuinely answerable from the section content
- whether visuals clarify or mislead in context
- whether a lesson is safe to use as an exemplar

### Hybrid Zone

These should be machine-flagged first, then human-confirmed:
- grade appropriateness
- teacher-facing language
- content correctness
- visual mismatch
- weak but not obviously broken practice

---

## 5. Audit Status Outputs

Use these statuses at the end of an audit pass:

- `gold`
  The lesson meets the current standard for its archetype and runtime context.
- `near_gold`
  The lesson is close, but still has non-blocking issues that make it risky as a template.
- `needs_rewrite`
  The lesson does not meet the standard and should re-enter the rewrite pipeline.
- `exception_review`
  The lesson cannot be handled safely by normal archetype-based cleanup.

Useful queue tags:
- `missing_practice`
- `needs_visuals`
- `canonical_choice_unresolved`
- `template_cleanup`
- `runtime_blocked`
- `exemplar_candidate`

These tags are queue aids, not substitutes for the top-level status.

---

## 6. What Counts As A Blocker

A lesson should be blocked from approval when any of these are true:
- the canonical lesson choice is unresolved
- parser-safe structure is missing
- placeholder / template content remains
- checkpoints or practice contradict the lesson content
- visuals are misleading
- runtime behavior breaks the intended lesson flow
- the lesson cannot be classified cleanly enough to rewrite safely

A blocker should route the lesson to:
- rewrite
- exception review
- or product/runtime backlog

It should not be hidden inside a generic low-score summary.

---

## 7. Queue Formation Rules

The audit pipeline should form queues in this order:

1. `canonical_choice_unresolved`
2. `exception_review`
3. `needs_rewrite`
4. `near_gold`
5. `exemplar_candidate`

Reason:
- the team should not polish practice or visuals on the wrong lesson row
- exception cases should be resolved before bulk rewrite rules are applied
- `near_gold` lessons can wait until blockers and structural failures are handled

---

## 8. Minimum Audit Record

Every lesson that leaves a human audit should have:
- lesson ID
- lesson title
- subject
- grade band
- archetype
- audit status
- blocker tags
- short rationale
- next owner or next queue

If that record does not exist, the audit is not operationally complete.

---

## 9. Current Repo Reality

What already exists:
- multiple audit scripts across structure, quality, practice, visuals, and completeness
- dashboard support for content quality metrics through [contentQualityService.ts](/Users/drmixer/code/ElevatEDNEW/src/services/contentQualityService.ts)
- JSON audit outputs already used by downstream scripts
- a clear rubric, checklist, and archetype stack

What does not exist yet:
- one unified audit runner that emits final archetype-aware statuses
- stored lesson-level archetype tags and audit statuses in metadata
- a single queue system that merges script outputs with human review decisions

This doc defines the target pipeline the repo should move toward.

---

## 10. Recommended Next Implementation Step

The first implementation step after this doc should be:
- add lesson-level archetype and audit-status metadata
- make the audit scripts emit queue tags in a consistent shape
- define one batch report that merges structure, practice, visual, and exception signals

Without that layer, the repo has audit ingredients but not a single operational audit system.
