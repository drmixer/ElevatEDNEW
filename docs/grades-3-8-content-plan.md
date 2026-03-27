# Grades 3-8 Content Plan

Purpose: define the practical operating plan for the current grades `3-8` content push, including what "nailing down" grades `3-8` means in this repo, which subject lanes go first, and how exemplar approval connects to audit and rewrite work.

Status:
- `Draft`

Related docs:
- [lesson-source-of-truth.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-source-of-truth.md)
- [grades-3-8-exemplar-shortlist.md](/Users/drmixer/code/ElevatEDNEW/docs/grades-3-8-exemplar-shortlist.md)
- [lesson-exemplar-coverage.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-coverage.md)
- [lesson-audit-pipeline.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-audit-pipeline.md)
- [lesson-rewrite-pipeline.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-rewrite-pipeline.md)
- [lesson-exemplar-approval.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-approval.md)

Primary implementation references:
- [seed_lesson_metadata.ts](/Users/drmixer/code/ElevatEDNEW/scripts/seed_lesson_metadata.ts)
- [audit_content_quality.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_content_quality.ts)
- [validate_content.ts](/Users/drmixer/code/ElevatEDNEW/scripts/validate_content.ts)
- [audit_visual_needs.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_visual_needs.ts)
- [analyze_practice_gap.ts](/Users/drmixer/code/ElevatEDNEW/scripts/analyze_practice_gap.ts)
- [cleanup_content_issues.ts](/Users/drmixer/code/ElevatEDNEW/scripts/cleanup_content_issues.ts)
- [improve_lesson_content.ts](/Users/drmixer/code/ElevatEDNEW/scripts/improve_lesson_content.ts)
- [final_content_cleanup.ts](/Users/drmixer/code/ElevatEDNEW/scripts/final_content_cleanup.ts)

---

## 1. What "Nailing Down Grades 3-8" Means

For the current repo phase, grades `3-8` are "nailed down" only when all of these are true:
- grades `3-5` math keeps an approved exemplar and grades `6-8` math has its own approved upper-math exemplar
- ELA, science, and history/social studies each have one approved grades `3-8` exemplar
- electives/applied concept has a named candidate and a clear second-wave plan
- study-skills work has an explicit decision: approved exemplar, dedicated authoring task, or intentional defer
- the current grades `3-8` approval order is documented in repo
- audit and rewrite work follows that order instead of drifting across unrelated grades

This does not mean every grades `3-8` lesson is already gold.

It means the repo has the guide structure needed to improve those lessons consistently.

---

## 2. Current Inventory Snapshot

The quick grades `3-8` lesson inventory currently surfaces:
- `99` math lesson rows
- `60` ELA lesson rows
- `101` science lesson rows
- `103` social studies lesson rows
- `39` electives lesson rows

Current repo support is strongest in the core-subject lanes:
- metadata seeding already targets math, ELA, science, and social studies
- audit scripts already operate meaningfully on those same lanes
- practice-gap and quality-gap work is already easiest to run there

That means the practical order is:
- core subjects first
- electives second
- standalone study-skills last unless a clean existing candidate appears

---

## 3. Working Waves

### Wave 0. Keep The Existing Math Anchor

Goal:
- keep lesson `1437` as the approved grades `3-5` math guide lesson

Reason:
- the elementary-math lane already has the strongest approved exemplar in repo
- grades `3-8` work should build from that strength instead of reopening it

### Wave 1. Close The Strongest New Core Exemplars

Goal:
- run the first real review pass on the strongest new core candidates

Current target lessons:
- lesson `232` for `Upper Math Worked Example`

Reason:
- upper math looked review-ready enough to test first
- the first history pass on lesson `331` exposed the duplicate-row blocker that had to be cleared before history could move back into real approval work
- lesson `232` was rewritten and then approved on `2026-03-25` after its practice layer was repaired

### Wave 2. Rewrite-First Core Lanes

Goal:
- fix the strongest ELA and science candidates before formal exemplar approval

Current target lessons:
- lesson `148` for `ELA Reading / Analysis`
- lesson `4648` for `Science Phenomenon / Evidence`

Reason:
- both lanes have plausible candidates now
- lesson `148` was rewritten and then approved on `2026-03-25` after browser/player validation confirmed the live player render path
- lesson `4648` was rewritten and then approved on `2026-03-25` after practice repair, canonical cleanup, and browser/player validation

### Wave 2.5. Canonical Resolution For History

Goal:
- resolve same-module duplicate history candidates before another exemplar approval attempt

Current target lessons:
- lesson `331`
- lesson `3283`
- then lesson `338` as the next clean fallback candidate

Reason:
- this wave documented the duplicate-row cleanup required before history could move back into real approval work
- lesson `3283` was demoted to `draft`, making lesson `331` the canonical public row for module `602`
- lesson `331` was then rewritten, practice-repaired, browser-validated, and approved as the history exemplar
- lesson `338` remains rejected as a backup candidate until it is substantially repaired

### Wave 3. Electives / Applied Concept

Goal:
- establish one grades `3-8` applied-concept guide lesson after the core lanes are no longer missing exemplars

Approved exemplar:
- lesson `648` for `Specials / Applied Concept Lesson`

Reason:
- electives exist in grades `3-8`, but they are not yet the strongest-supported lane in the current metadata and audit stack

Completed on `2026-03-25`:
- lesson `648` was rewritten, its practice layer was rebuilt, duplicate public lesson `1855` was demoted to `draft`, and browser/player validation confirmed the live render path

### Wave 4. Study Skills Decision

Goal:
- establish one grades `3-8` study-skills guide lesson with real source-of-truth and runtime evidence

Current repo reality:
- the earlier inventory check was correct: no clean standalone study-skills routine lesson existed in live data
- the approved solution on `2026-03-25` was to author a dedicated study-skills module and lesson instead of repurposing a health/PE lesson

Approved exemplar:
- lesson `4901` for `Study Skills / Metacognitive Routine`

Reason:
- the closest live health/PE planning lessons were the wrong archetype and had weak canonical/practice state

Completed on `2026-03-25`:
- module `2743`, `Plan Your Week in 10 Minutes`, was created under subject `Study Skills`
- lesson `4901` was seeded, synced from curated markdown, linked to dedicated skill `434`, and given authored managed practice `Q27609-Q27620`
- browser/player validation confirmed Welcome, all `8` Learn sections, and Review render correctly for lesson `4901`

---

## 4. Batch Rules

Run the grades `3-8` push in controlled batches.

For each target lesson:

1. confirm the lesson row is the canonical target
2. confirm the archetype assignment
3. run machine audits for structure, practice, and visual issues
4. run the human checklist against the actual lesson body and player behavior
5. choose one path: approve, deterministic cleanup, rewrite-first, or backup-candidate swap
6. update the exemplar coverage ledger immediately after the decision

Do not:
- start broad subject rewrites before the relevant exemplar candidate is reviewed
- keep switching candidates casually inside the same archetype
- treat a rewrite-first candidate as an approved model just because it is currently best available

---

## 5. Rewrite Priorities Inside Grades 3-8

When a target lesson is not approval-ready, fix the blockers in this order:

1. canonical lesson choice
2. archetype fit
3. parser-safe lesson shell
4. checkpoint and practice alignment
5. visual mismatch or missing instructionally necessary visual
6. weak concept / evidence / worked-example arc

This matters because several current top candidates already show a familiar pattern:
- the lesson shell exists
- the subject lane is correct
- the lesson is still not safe to copy because the visual or instructional arc is wrong

Grades `3-8` work should therefore prefer targeted cleanup over blind full-repo rewrites.

---

## 6. Approval Sequence

Use the following sequence as the default grades `3-8` approval order:

1. retain lesson `1437` for grades `3-5` math
2. use lesson `232` as the approved upper-math exemplar; keep `219` as the fallback depth candidate
3. use lesson `148` as the approved ELA exemplar; keep `116` as the fallback depth candidate
4. use lesson `4648` as the approved science exemplar; keep `261` as the fallback depth candidate
5. use lesson `331` as the approved history/social studies exemplar; keep `338` only as a rejected backup candidate
6. use lesson `648` as the approved applied-concept exemplar; keep `43` as the fallback candidate
7. find or author the study-skills exemplar

This sequence should govern:
- manual exemplar reviews
- rewrite queue selection
- any archetype-tagging work added to metadata or scripts

First completed review records:
- [lesson-232-upper-math-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-232-upper-math-2026-03-25.md)
- [lesson-232-upper-math-rereview-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-232-upper-math-rereview-2026-03-25.md)
- [lesson-148-ela-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-148-ela-2026-03-25.md)
- [lesson-148-ela-rereview-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-148-ela-rereview-2026-03-25.md)
- [lesson-4648-science-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-4648-science-2026-03-25.md)
- [lesson-331-history-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-331-history-2026-03-25.md)
- [lesson-331-history-rereview-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-331-history-rereview-2026-03-25.md)
- [lesson-648-applied-concept-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-648-applied-concept-2026-03-25.md)
- [lesson-331-history-rewrite-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-rewrites/lesson-331-history-rewrite-2026-03-25.md)
- [lesson-338-history-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-338-history-2026-03-25.md)

Current rewrite draft:
- [lesson-232-upper-math-rewrite-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-rewrites/lesson-232-upper-math-rewrite-2026-03-25.md)
- [lesson-148-ela-rewrite-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-rewrites/lesson-148-ela-rewrite-2026-03-25.md)
- [lesson-4648-science-rewrite-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-rewrites/lesson-4648-science-rewrite-2026-03-25.md)
- [lesson-648-applied-concept-rewrite-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-rewrites/lesson-648-applied-concept-rewrite-2026-03-25.md)

Latest completed unblock:
- lesson `232` practice was replaced with authored similarity/congruence questions and the lesson is now approved as the upper-math exemplar
- lesson `148` now has a completed live player validation pass and is approved as the ELA exemplar
- lesson `4648` now has rewritten lesson content, dedicated practice, resolved canonical serving state, and approved exemplar status for science
- lesson `3283` is now `draft`, so lesson `331` is the canonical public row for module `602`
- lesson `331` now has rewritten lesson content, dedicated practice, resolved canonical serving state, and approved exemplar status for history/social studies
- lesson `1855` is now `draft`, so lesson `648` is the canonical public row for module `15`
- lesson `648` now has rewritten lesson content, dedicated practice, resolved canonical serving state, and approved exemplar status for applied concept
- lesson `338` remains rejected and should stay a backup candidate until it is substantially repaired

---

## 7. Definition Of Done

The grades `3-8` push is complete at the documentation and governance layer when:
- the shortlist exists
- the approval order is explicit
- each grades `3-8` archetype has either an approved exemplar, a named rewrite-first candidate, or an explicit no-candidate decision
- the coverage ledger reflects those states cleanly

The grades `3-8` push is complete operationally only when:
- the core subject archetypes each have an approved exemplar
- the rewrite queue is being formed from those exemplars and archetype rules
- the repo is no longer relying on generic cross-subject lesson patterns for grades `3-8`
