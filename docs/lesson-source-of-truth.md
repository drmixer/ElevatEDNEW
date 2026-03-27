# Lesson Source Of Truth

Purpose: define which lesson-quality docs are authoritative, how they relate to each other, and what still needs to be written so ElevatED can improve lesson quality systematically instead of through ad hoc edits.

This document is the entry point for lesson architecture, lesson quality standards, and lesson rewrite planning.

---

## Why This Exists

The repo already has useful lesson/content docs, but they are spread across:
- pilot-specific plans
- content-model notes
- style guidance
- cleanup plans
- execution logs

That is enough to make progress, but not enough to make the lesson system easy to govern.

The goal now is to make the repo itself the source of truth for:
- what a good lesson is
- what lesson types exist
- how they differ by grade and subject
- how lessons should be audited
- how lessons should be improved in bulk

---

## Active Focus Window

Current priority window:
- grades `3-8`
- all major subject areas covered by the current archetype catalog

Current execution docs for that window:
- [grades-3-8-content-plan.md](/Users/drmixer/code/ElevatEDNEW/docs/grades-3-8-content-plan.md)
- [grades-3-8-exemplar-shortlist.md](/Users/drmixer/code/ElevatEDNEW/docs/grades-3-8-exemplar-shortlist.md)

Current deprioritized ranges:
- K-2
- 9-12 outside urgent or exemplar-driven work

How to interpret this:
- the full lesson-spec stack still describes the platform broadly
- active audit, rewrite, and exemplar-approval work should focus first on grades `3-8`
- K-5 math still provides the strongest current guide exemplar, but the operational push is no longer "elementary math first only"

---

## Source Of Truth Hierarchy

Use the following hierarchy when there is ambiguity.

### 1. Product-Level Lesson Standard

These docs define what a "good" lesson means at the platform level.

Authoritative docs:
- [gold-lesson-rubric.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-rubric.md)
- [gold-lesson-review-checklist.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-review-checklist.md)

Purpose:
- define the universal lesson contract
- define what varies by subject and grade
- define "gold" vs "near gold" vs "not gold"

### 2. Platform Constraints

These docs and code define what the lesson player can actually parse and render.

Authoritative references:
- [lessonContentParser.ts](/Users/drmixer/code/ElevatEDNEW/src/lib/lessonContentParser.ts)
- [content-model-phase3.md](/Users/drmixer/code/ElevatEDNEW/docs/content-model-phase3.md)
- [content-style-guide.md](/Users/drmixer/code/ElevatEDNEW/docs/content-style-guide.md)

Purpose:
- define parser-safe markdown structure
- define metadata model
- define style and readability constraints

### 3. Archetype Specs

These should become the primary docs for lesson rewriting at scale.

Status:
- defined at the catalog level
- archetype specs now exist for every archetype in the current catalog
- governance and operational docs now exist in repo
- actual exemplar approvals and implementation wiring are still needed

These docs should eventually answer:
- what lesson archetypes exist
- what each archetype requires
- what examples/checkpoints/visuals fit that archetype
- what should never appear in that archetype

Current and planned source-of-truth docs:
- [lesson-archetypes.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-archetypes.md)
- [k5-math-concept-procedure.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/k5-math-concept-procedure.md)
- [upper-math-worked-example.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/upper-math-worked-example.md)
- [ela-reading-analysis.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/ela-reading-analysis.md)
- [science-phenomenon.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/science-phenomenon.md)
- [history-source-analysis.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/history-source-analysis.md)
- [study-skills-routine.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/study-skills-routine.md)
- [applied-concept.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/applied-concept.md)

### 4. Governance / Exemplar Control

These docs define who can update the lesson-spec stack, how guide lessons are approved, how exemplar coverage is tracked, and when a lesson should leave the normal archetype path.

Authoritative docs:
- [lesson-source-of-truth-ownership.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-source-of-truth-ownership.md)
- [lesson-exemplar-approval.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-approval.md)
- [lesson-exemplar-coverage.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-coverage.md)
- [lesson-exception-review-workflow.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exception-review-workflow.md)

Purpose:
- define change authority for standards, archetypes, exemplars, and audit outputs
- define how a lesson becomes an approved exemplar
- track which archetypes already have approved guide lessons
- define when lessons require exception handling instead of normal archetype cleanup

### 5. Exemplar Lessons

These are concrete model lessons used to guide rewrites inside an archetype.

Current exemplars:
- [perimeter-launch-gold.md](/Users/drmixer/code/ElevatEDNEW/docs/perimeter-launch-gold.md)
- [lesson-232-upper-math-rereview-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-232-upper-math-rereview-2026-03-25.md)
- [lesson-148-ela-rereview-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-148-ela-rereview-2026-03-25.md)
- [lesson-4648-science-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-4648-science-2026-03-25.md)
- [lesson-331-history-rereview-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-331-history-rereview-2026-03-25.md)
- [lesson-648-applied-concept-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-648-applied-concept-2026-03-25.md)

Current recommendation:
- treat lesson `1437` as the elementary math guide lesson
- treat lesson `232` as the current upper-math guide lesson
- treat lesson `148` as the current ELA guide lesson
- treat lesson `4648` as the current science guide lesson
- treat lesson `331` as the current history/social-studies guide lesson
- treat lesson `648` as the current applied-concept guide lesson
- do not treat any one exemplar as the universal template for every subject and grade

Purpose:
- show what the archetype looks like in practice
- validate the rubric against real lesson content

### 6. Execution / Remediation Plans

These docs explain how the team is improving content over time.

Important references:
- [lesson-audit-pipeline.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-audit-pipeline.md)
- [lesson-rewrite-pipeline.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-rewrite-pipeline.md)
- [grades-3-8-content-plan.md](/Users/drmixer/code/ElevatEDNEW/docs/grades-3-8-content-plan.md)
- [grades-3-8-exemplar-shortlist.md](/Users/drmixer/code/ElevatEDNEW/docs/grades-3-8-exemplar-shortlist.md)
- [pilot-improvement.md](/Users/drmixer/code/ElevatEDNEW/docs/pilot-improvement.md)
- [IMPROVEMENTS.md](/Users/drmixer/code/ElevatEDNEW/IMPROVEMENTS.md)
- `CONTENT_QUALITY_PLAN.md`

Purpose:
- capture sequencing
- track implementation progress
- record past cleanup and hardening work
- define the operational audit and rewrite path

These are operationally useful, but they should not outrank the rubric or future archetype specs.

---

## Current Recommended Canon

If someone asks "what doc should I follow when improving lessons?", the answer should be:

1. Start with [lesson-source-of-truth.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-source-of-truth.md)
2. Use [gold-lesson-rubric.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-rubric.md) for standards
3. Use [gold-lesson-review-checklist.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-review-checklist.md) for auditing
4. Use the relevant archetype spec once archetype docs exist
5. Use the exemplar approval and coverage docs when choosing or reviewing guide lessons
6. For grades `3-8`, use [grades-3-8-exemplar-shortlist.md](/Users/drmixer/code/ElevatEDNEW/docs/grades-3-8-exemplar-shortlist.md) and [grades-3-8-content-plan.md](/Users/drmixer/code/ElevatEDNEW/docs/grades-3-8-content-plan.md) for order of operations
7. Use the exemplar lesson for concrete modeling
8. Use the audit and rewrite pipeline docs for operational flow
9. Use execution plans and scripts for rollout
10. When authored lesson/practice source files exist under `data/lessons/*authored_launch_lessons.json` or `data/practice/*authored_practice_items.json`, treat the whole discovered file set as canonical rather than only the default shared file

---

## What Is Still Missing

At the documentation layer, the core lesson-spec stack now exists.

The governance and exemplar-control layer exists in:
- [lesson-source-of-truth-ownership.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-source-of-truth-ownership.md)
- [lesson-exemplar-approval.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-approval.md)
- [lesson-exemplar-coverage.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-coverage.md)
- [lesson-exception-review-workflow.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exception-review-workflow.md)

The operational layer exists in:
- [lesson-audit-pipeline.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-audit-pipeline.md)
- [lesson-rewrite-pipeline.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-rewrite-pipeline.md)

The remaining work is not more core docs.

The remaining work is:
- approving exemplar lessons beyond K-5 math
- executing the grades `3-8` exemplar order in [grades-3-8-exemplar-shortlist.md](/Users/drmixer/code/ElevatEDNEW/docs/grades-3-8-exemplar-shortlist.md)
- executing the grades `3-8` subject plan in [grades-3-8-content-plan.md](/Users/drmixer/code/ElevatEDNEW/docs/grades-3-8-content-plan.md)
- tagging lessons with archetypes in metadata
- connecting audit scripts to archetype-aware statuses and queue tags
- connecting rewrite scripts to those same archetype and queue decisions

---

## Recommended Documentation Order

This is the sequence I would use to finish the lesson-spec system.

### Phase 1

Complete the standards layer:
- [x] gold rubric
- [x] review checklist
- [x] source-of-truth map

### Phase 2

Define the archetype layer:
- [x] lesson archetype catalog
- [x] K-5 math archetype specs
- [x] upper math archetype spec
- [x] ELA reading-analysis archetype spec
- [x] science phenomenon archetype spec
- [x] history/social studies source-analysis archetype spec
- [x] study skills / metacognitive routine archetype spec
- [x] applied concept archetype spec

### Phase 3

Define the governance layer:
- [x] exemplar approval workflow
- [x] exception review workflow
- [x] source-of-truth ownership doc
- [x] exemplar coverage ledger

### Phase 4

Define the operational layer:
- [x] lesson audit pipeline spec
- [x] lesson rewrite pipeline spec

### Phase 5

Tie docs to implementation:
- [ ] tag lessons with archetypes in metadata
- [ ] connect audit scripts to archetype expectations
- [ ] connect rewrite scripts to archetype transforms

---

## Repository Reality Check

This repo already has many of the raw ingredients:
- lesson audits in `scripts/`
- content cleanup scripts in `scripts/`
- practice generation scripts in `scripts/`
- visual/checkpoint/practice runtime support in `src/`

What is missing is not raw capability.

What is missing is a clean spec stack that turns those tools into a coherent lesson-improvement system.

That is why the next step should be actual exemplar approvals and implementation wiring, not more isolated lesson edits.

---

## Current Recommendation

Use this as the working standard:

- the repo should have one clear lesson-quality spec hierarchy
- lesson `1437` should remain the elementary-math guide exemplar
- active lesson-quality work should prioritize grades `3-8` across subjects
- future lesson improvement should be organized by archetype, not by random lesson-by-lesson cleanup
- the archetype layer is now defined enough to govern audit and rewrite pipeline planning
- governance for ownership, exemplar approval, and exceptions now exists in repo docs
- execution scripts and audits should eventually point back to archetype specs as their governing source
