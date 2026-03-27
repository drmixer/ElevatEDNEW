# Lesson Exemplar Approval

Purpose: define how a lesson becomes the approved exemplar for an archetype, so the repo has a clear review path between "good lesson" and "copy this pattern for similar lessons."

This doc is the governance layer between:
- the universal standard in [gold-lesson-rubric.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-rubric.md)
- the fast audit tool in [gold-lesson-review-checklist.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-review-checklist.md)
- the archetype specs in [lesson-archetypes.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-archetypes.md)
- the per-archetype specs in `docs/archetypes/*.md`

Use this doc when a lesson is being considered as the exemplar other lessons should follow.

---

## 1. What An Exemplar Is

An exemplar is the lesson that best represents an archetype in its intended production shape.

An exemplar should:
- follow the archetype spec cleanly
- satisfy the gold rubric for that subject and grade band
- be readable as a model lesson, not just a technically passing lesson
- be stable enough that other lessons can safely copy its pattern

An exemplar is not:
- the longest lesson
- the most polished-looking lesson
- a lesson that only passes because the archetype spec is vague
- a one-off lesson that does not generalize to similar content

---

## 2. Approval Inputs

A lesson can only be reviewed as an exemplar if the reviewer has these inputs:

- the canonical lesson row or source file
- the relevant archetype spec
- the universal rubric
- the review checklist
- the current runtime context when visuals, checkpoints, or practice matter

The reviewer should also know:
- lesson ID
- lesson title
- subject
- grade band
- archetype name
- canonical variant
- whether the lesson is expected to use native practice

If any of those inputs are missing, the lesson is not ready for exemplar review.

---

## 3. Review Steps

Review exemplar candidates in this order:

1. Confirm the lesson belongs to the archetype being reviewed.
2. Confirm it is the canonical lesson the app should actually serve.
3. Run the gold review checklist against the lesson body and player behavior.
4. Compare the lesson against the archetype spec, not against personal preference.
5. Check that checkpoints, practice, hints, and visuals all reinforce the same instructional job.
6. Decide whether this lesson is good enough to guide future lessons in the same archetype.

The review should not skip from "looks good" to approval.

The core question is:
- would I want the next 10 lessons in this archetype to copy this pattern?

If the answer is no, it is not ready.

---

## 4. Approval Criteria

A lesson can be approved as an exemplar only if all of these are true:

- it passes the gold rubric for the subject and grade band
- it passes the review checklist with no core `Fail`
- it follows the archetype spec’s required structure and banned patterns
- the lesson is canonical, not a draft or sibling variant
- the Learn arc is coherent from introduction through summary
- checkpoints are answerable from the lesson content and vary appropriately
- practice matches the same instructional job as the Learn flow
- hints and quick review support the lesson without giving away answers
- visuals, if used, are accurate and instructionally relevant
- the lesson is stable enough to use as a rewrite template

Approval should be based on evidence, not confidence alone.

---

## 5. Decision States

Use these states for exemplar review:

- `Draft`
  The lesson is being considered, but the review is incomplete.
- `Near Gold`
  The lesson is close, but still has issues that would make it risky as a template.
- `Approved Exemplar`
  The lesson is the best current model for the archetype and can guide similar rewrites.
- `Rejected`
  The lesson should not be used as an exemplar in its current form.
- `Superseded`
  A later lesson now better represents the archetype and should replace the old exemplar.

Only `Approved Exemplar` should be used as the formal guide lesson state.

---

## 6. Rejection Reasons

Common reasons a candidate should be rejected:

- it is not canonical
- it has unresolved content quality issues
- it does not match the archetype spec cleanly
- it relies on unsupported runtime behavior
- checkpoints or practice do not actually fit the lesson
- visuals are misleading or not aligned to the text
- the lesson works as a lesson but not as a reusable pattern

Rejection does not mean the lesson is bad.
It means the lesson is not safe to use as a model for future rewrites.

---

## 7. After Approval

Once a lesson is approved as an exemplar:

- mark it as the approved model for that archetype in the source-of-truth docs
- use it as the first reference point for similar lesson rewrites
- preserve the archetype-specific lesson shape unless the archetype spec changes
- re-review it if a later lesson reveals a better pattern

Approved exemplars should be treated as stable guidance, not frozen perfection.

If the runtime or rubric changes, the exemplar may need to be revalidated.

---

## 8. After Rejection

If a candidate is rejected:

- record the primary reasons
- identify whether the lesson needs content edits or is simply the wrong archetype fit
- route the lesson to normal improvement work, if it is still worth serving
- do not cite it as the exemplar for the archetype

If the lesson is close, the reviewer should say what must change before it can be reconsidered.

If it is the wrong archetype, the review should stop there and point to the correct archetype instead.

---

## 9. Re-Review

A rejected lesson can be re-reviewed when:

- the cited issues have been fixed
- the archetype spec has been updated in a way that changes the decision
- the runtime behavior that affected the review has changed
- a later lesson makes it clear the earlier candidate should be reconsidered

Re-review should use the same rubric, checklist, and archetype spec as the original review.

---

## 10. Exemplar Record

When a lesson is approved, the review record should capture:

- lesson ID
- lesson title
- archetype
- reviewer
- review date
- decision state
- short rationale
- any caveats
- next review trigger, if any

This record should be enough for a future reviewer to understand why the lesson was approved.

---

## 11. Current Practice

Current approved exemplars:
- lesson `1437`
- [Perimeter (intro) Launch Lesson](/Users/drmixer/code/ElevatEDNEW/docs/perimeter-launch-gold.md)
- lesson `232`
- [Similarity & Congruence](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-232-upper-math-rereview-2026-03-25.md)
- lesson `148`
- [Science/Tech Articles (open-licensed)](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-148-ela-rereview-2026-03-25.md)
- lesson `4648`
- [Plate Tectonics (Earth & Space Science, Grade 6): Grade 6 Launch Lesson](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-4648-science-2026-03-25.md)
- lesson `331`
- [Citizenship & Rights Launch Lesson](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-331-history-rereview-2026-03-25.md)
- lesson `4901`
- [Plan Your Week in 10 Minutes](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-4901-study-skills-2026-03-25.md)
- lesson `648`
- [Intro: Music Theory (intro)](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-648-applied-concept-2026-03-25.md)

Current expectation:
- the perimeter lesson remains the guide exemplar for `K-5 Math Concept / Procedure`
- lesson `232` now serves as the guide exemplar for `Upper Math Worked Example`
- lesson `148` now serves as the guide exemplar for `ELA Reading / Analysis`
- lesson `4648` now serves as the guide exemplar for `Science Phenomenon / Evidence`
- lesson `331` now serves as the guide exemplar for `History / Social Studies Source Analysis`
- lesson `4901` now serves as the guide exemplar for `Study Skills / Metacognitive Routine`
- lesson `648` now serves as the guide exemplar for `Specials / Applied Concept Lesson`

This is the approval bar to use now:
- if the lesson cannot be safely copied by the next writer, it is not yet an exemplar

---

## 12. Related Work

This doc should be read with:
- [lesson-source-of-truth.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-source-of-truth.md)
- [lesson-archetypes.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-archetypes.md)
- [gold-lesson-rubric.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-rubric.md)
- [gold-lesson-review-checklist.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-review-checklist.md)

It should also stay consistent with:
- `docs/archetypes/k5-math-concept-procedure.md`
- `docs/archetypes/upper-math-worked-example.md`
- `docs/archetypes/ela-reading-analysis.md`
- `docs/archetypes/science-phenomenon.md`
- `docs/archetypes/history-source-analysis.md`
- `docs/archetypes/study-skills-routine.md`
- `docs/archetypes/applied-concept.md`
