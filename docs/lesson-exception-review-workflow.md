# Lesson Exception Review Workflow

Purpose: define when a lesson should leave normal archetype-based cleanup and enter exception review, what information must be collected, who makes the decision, and what outcomes are allowed.

Status:
- `Draft`

Related docs:
- [lesson-source-of-truth.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-source-of-truth.md)
- [lesson-archetypes.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-archetypes.md)
- [gold-lesson-rubric.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-rubric.md)
- [gold-lesson-review-checklist.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-review-checklist.md)
- [perimeter-launch-gold.md](/Users/drmixer/code/ElevatEDNEW/docs/perimeter-launch-gold.md)

---

## 1. Purpose Of Exception Review

Exception review exists for lessons that do not fit cleanly into an existing archetype or cannot be fixed safely by normal archetype-based cleanup.

Use exception review to avoid:
- forcing a lesson into the wrong archetype
- making a rewrite that hides a deeper content or product issue
- approving a lesson that still has unresolved structural or instructional conflicts

Exception review is not a replacement for normal archetype cleanup. It is the escalation path when the normal path is not enough.

---

## 2. When A Lesson Enters Exception Review

A lesson should enter exception review when at least one of these is true:
- the lesson’s instructional job is unclear after archetype classification
- the lesson mixes two archetypes and no single pattern is clearly primary
- the lesson cannot be made gold without changing the lesson’s intended purpose
- the lesson has a structural or runtime issue that blocks normal review
- the lesson contains content that conflicts with the archetype enough that a rewrite would become a new lesson
- the lesson belongs to a special case that needs manual approval before any rewrite

Do not send a lesson to exception review just because:
- it is messy
- it needs copy edits
- it has one bad example
- it needs a normal archetype rewrite
- the reviewer is unsure and has not checked the rubric or archetype spec yet

---

## 3. Exception Types

Use one or more of these labels when routing a lesson.

### 3.1 Archetype Mismatch

The lesson was classified into an archetype, but the fit is weak enough that rewriting to that archetype would distort the lesson.

Common signals:
- the lesson’s core task is different from the archetype
- checkpoints or practice would need to be rebuilt from scratch
- the lesson seems to belong to a different subject pattern

### 3.2 Mixed-Pattern Lesson

The lesson legitimately combines two instructional jobs and does not fit a single archetype cleanly.

Common signals:
- the lesson has both concept teaching and source analysis
- the lesson combines explanation with a process or routine
- the lesson’s sections switch between two different reasoning modes

### 3.3 Product Constraint Exception

The lesson cannot be completed inside the current player or content model without changing the platform behavior.

Common signals:
- unsupported structure
- unsupported media or visual requirement
- a lesson flow that would require parser or runtime changes

### 3.4 Content Integrity Exception

The lesson has a correctness or safety issue that cannot be patched with a normal archetype rewrite.

Common signals:
- wrong facts
- misleading visuals
- contradictory instructions
- missing canonical content

### 3.5 Canonical Selection Exception

There is more than one plausible lesson version and the wrong one may be the current target.

Common signals:
- competing drafts
- deprecated sibling lessons
- ambiguity about which row should be treated as the canonical lesson

### 3.6 Domain-Specific Exception

The lesson is valid, but the domain requires explicit approval before it can be used as a guide exemplar or rewritten at scale.

Common signals:
- high-stakes science, history, or special-subject content
- technique-based lessons with unusual media or safety requirements
- lessons that need a subject owner to confirm the pattern

---

## 4. Required Inputs

Every exception review should collect the same minimum evidence.

### Lesson Identity

- lesson ID
- lesson title
- module or course context
- current canonical variant, if known
- current archetype assignment, if any

### Exception Summary

- why the lesson failed normal cleanup
- which exception type applies
- what was already checked
- what is still unresolved

### Source Of Truth References

- relevant archetype spec
- relevant rubric or checklist items
- any exemplar lesson used as comparison
- any platform constraint that matters

### Content Evidence

- the section or sections that caused the exception
- screenshots or excerpted text if needed
- visual or checkpoint issues if relevant
- any runtime or parser evidence if relevant

### Recommendation

- what the reviewer thinks should happen next
- whether the lesson should be rewritten, reclassified, or escalated

---

## 5. Review Ownership

Exception review should not be decided by a single casual reviewer.

### Primary Reviewer

The primary reviewer gathers the evidence and makes the initial recommendation.

Responsibilities:
- identify the exception type
- verify the archetype or rubric mismatch
- document the minimum evidence

### Secondary Reviewer

The secondary reviewer checks the recommendation against the archetype stack and the lesson’s intended use.

Responsibilities:
- confirm whether the lesson truly belongs in exception review
- challenge overbroad or underexplained recommendations
- verify that a normal archetype path was not skipped too early

### Subject Or Product Owner

Use a subject owner or product owner when the exception depends on domain judgment, canonical selection, or platform constraints.

Responsibilities:
- decide whether the lesson should remain in exception review
- confirm the acceptable rewrite path or exempt it
- approve any nonstandard outcome

### Decision Rule

No lesson should be marked closed from exception review until the reviewer can answer this question:

Can this lesson now be improved safely by a specific archetype or approved exception path?

If the answer is no, keep it open.

---

## 6. Decision Checklist

Before approving an exception outcome, verify:
- the lesson was matched against the correct archetype spec
- the rubric and review checklist were applied
- the specific blocker is documented
- the proposed fix does not change the lesson into a different product
- the lesson can be improved without guessing at the intended structure

If any of these are missing, the review is incomplete.

---

## 7. Allowed Outcomes

Exception review should end in one of these states.

### 7.1 Reclassify

Use when the lesson was placed in the wrong archetype and can move cleanly to a better one.

Result:
- update the archetype assignment
- return the lesson to normal archetype-based cleanup

### 7.2 Rewrite Under New Guidance

Use when the lesson needs a rewrite plan that is more specific than the current archetype spec, but still fits the lesson system.

Result:
- capture the rewrite rule or note
- keep the lesson in the active cleanup queue

### 7.3 Approve As Exception

Use when the lesson is intentionally nonstandard but still acceptable for its current use.

Result:
- document why the lesson is exempt
- record any special handling needed for future audits

### 7.4 Hold For Product Change

Use when the lesson cannot be fixed without a platform or content-model change.

Result:
- move the issue to the product or platform backlog
- leave the lesson closed only if the current version is safe

### 7.5 Reject

Use when the lesson still fails the rubric and cannot be approved safely.

Result:
- keep the lesson open
- assign the next required cleanup step

---

## 8. What Must Be Recorded

After every exception decision, record:
- exception type
- final decision
- decision owner
- archetype or product area involved
- evidence used to decide
- follow-up owner
- whether the lesson can now return to normal review

Do not close an exception without a written rationale. Future audits need the reason, not just the outcome.

---

## 9. Review Notes Format

Use a short, repeatable note format so exception decisions are searchable.

Recommended structure:
- `Lesson:`
- `Exception Type:`
- `Reason:`
- `Decision:`
- `Owner:`
- `Follow-up:`

Keep the note concise. The goal is to preserve the decision path, not to rewrite the lesson analysis inside the note.

---

## 10. Banned Patterns

Do not use exception review for:
- normal grammar fixes
- routine archetype cleanup
- vague reviewer discomfort with no specific blocker
- a substitute for reading the rubric or archetype spec
- unresolved disagreement with no documented evidence

Do not close exception review with:
- no decision owner
- no lesson ID
- no cited blocker
- no follow-up path

---

## 11. Operating Rule

If a lesson can be safely improved by an existing archetype spec, do that first.

If it cannot, move it to exception review and document the precise reason.

That keeps exception review narrow and prevents the lesson system from turning every hard lesson into a special case.
