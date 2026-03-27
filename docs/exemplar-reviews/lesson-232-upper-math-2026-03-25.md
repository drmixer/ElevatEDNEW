# Exemplar Review: Lesson 232

Lesson ID:
- `232`

Lesson title:
- `Similarity & Congruence`

Subject:
- Mathematics

Grade band:
- `8`

Archetype:
- `Upper Math Worked Example`

Reviewer:
- Codex

Date:
- `2026-03-25`

Decision state:
- `Rejected`

Can this lesson be used as a guide exemplar right now?
- `No`

Related docs:
- [lesson-exemplar-approval.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-approval.md)
- [gold-lesson-review-checklist.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-review-checklist.md)
- [upper-math-worked-example.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/upper-math-worked-example.md)
- [grades-3-8-exemplar-shortlist.md](/Users/drmixer/code/ElevatEDNEW/docs/grades-3-8-exemplar-shortlist.md)

---

## Summary

Lesson `232` is the right kind of lesson for the `Upper Math Worked Example` lane and it appears to be the canonical row for its module. After rewrite, the lesson body is much closer to the archetype: the shell parses correctly, the introduction is real, and the worked examples are now explicit.

It is still not safe to approve as the guide exemplar.

The remaining blocker is the support layer:
- the linked practice questions are still generic placeholder items and do not match exemplar quality

Secondary runtime note:
- in unauthenticated browser playback, the player skips the practice phase because `LessonPlayerPage` only fetches practice when `studentId` exists

---

## Review Record

### 1. Canonical Choice

- `Pass` The lesson is the only current lesson row in its module.
- `Pass` No competing draft or sibling row surfaced in the same module.

Notes:
- module `302` currently contains only lesson `232`

### 2. Content Quality

- `Pass` No placeholder vocabulary or obvious filler text.
- `Pass` No contradictory instructions or visibly misleading math examples.
- `Pass` No solved fake practice section that gives away answers.
- `Partial` The lesson reads like finished content, but the framing is still lighter and more juvenile than the archetype wants for grade `8`.

Notes:
- the “twins/siblings” and selfie framing are usable, but they weaken the formal upper-math tone

### 3. Parser-Friendly Markdown

- `Pass` Stable `##` headings are present.
- `Fail` Objectives do not parse cleanly from a list.
- `Pass` Vocabulary terms do parse.
- `Pass` Summary is clearly recognized.

Notes:
- the lesson uses `## What You'll Learn` instead of a true `## Introduction`
- parser check on `2026-03-25` showed `hook: null`
- parser check also showed malformed objective extraction because the player classifies `What You'll Learn` as an objectives section instead of an introduction

### 4. Learn Arc

- `Partial` The opening gives context, but not in the more formal “problem type and why it matters” style expected here.
- `Pass` The core concept is explained directly.
- `Partial` Examples are present, but they are not worked examples with explicit setup and reasoning.
- `Pass` Sections build in a logical order.
- `Pass` Summary reinforces the main takeaway.

Notes:
- the lesson explains congruence, similarity, transformations, and scale factor clearly enough
- it does not show the student a full solve/setup sequence to copy

### 5. Checkpoints And Practice

- `N/A` Checkpoints were not reviewed in live player playback during this pass.
- `N/A` Checkpoint variety was not reviewed in live player playback during this pass.
- `Fail` Practice linkage exists, but the linked practice questions are generic placeholder items rather than concept-aligned production questions.
- `N/A` Hints were not reviewed in live player playback during this pass.
- `N/A` Quick review and challenge were not reviewed in live player playback during this pass.

Notes:
- lesson `232` has `1` lesson skill and `36` linked practice questions
- sampled linked questions on `2026-03-25` were items such as `Q22379` through `Q22384`
- sampled prompts were generic strings like `Practice question 1 for Similarity & Congruence.`
- sampled options were placeholder choices like `Option A`, `Option B`, `Option C`, `Option D`

### 6. Visual Quality

- `Pass` The transformations visual matches part of the prompt text.
- `Partial` The visual is helpful, but it supports only one slice of the lesson and does not help with the scale-factor reasoning.
- `Pass` The visual is age-appropriate and instructionally relevant.
- `Pass` No obvious shape or diagram mismatch was visible in the lesson body.

### 7. Audit And Runtime Cleanliness

- `Partial` The lesson body itself is now structurally cleaner, but practice quality still fails the audit bar.
- `Pass` Practice linkage is present.
- `Partial` Browser review showed the rewritten Learn and Review phases render correctly, but unauthenticated playback skips practice by design because no `studentId` exists.
- `N/A` Full rendering and interaction behavior was not reviewed in this pass.

### 8. Upper Math Addendum

- `Partial` Key terms are defined, but assumptions and notation are still light.
- `Fail` Worked examples do not show reasoning in the formal step-by-step way this archetype requires.
- `Partial` The lesson distinguishes concept and procedure somewhat, but not with enough explicit setup.
- `Partial` The lesson is readable for grade `8`, but the tone is less formal than the archetype spec calls for.

---

## Decision

Overall status:
- `Not Gold`

Rationale:
- correct lane
- canonical row appears stable
- lesson body is much stronger after rewrite
- still not a safe exemplar because the linked practice layer is placeholder-grade and fails concept-alignment quality

Highest-priority fixes:
- replace the generic linked practice questions with real similarity/congruence questions
- verify hints, quick review, and challenge behavior against those replacement questions
- re-run authenticated player review so Practice can be inspected in normal flow

Next review trigger:
- re-review after practice regeneration or practice relinking

---

## Rewrite Follow-Up

Rewrite status:
- rewritten in the lesson row on `2026-03-25`

Rewrite reference:
- [lesson-232-upper-math-rewrite-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-rewrites/lesson-232-upper-math-rewrite-2026-03-25.md)

Post-rewrite verification:
- parser check now returns `3` clean objectives
- introduction now produces a real hook
- vocabulary parses cleanly
- worked-example sections are separated as distinct learn sections
- summary remains present

What is still pending:
- authenticated player review with a student context
- checkpoint, hint, quick review, and challenge review
- practice regeneration or relinking

---

## Live Re-Review Notes

Browser playback findings on `2026-03-25`:
- Welcome phase renders the rewritten hook and learning goals correctly
- Learn phase renders all `6` sections correctly
- Review phase renders key takeaways and vocabulary correctly
- unauthenticated playback skips practice because the player only fetches practice questions when `studentId` exists

Implementation reference:
- [LessonPlayerPage.tsx](/Users/drmixer/code/ElevatEDNEW/src/pages/LessonPlayerPage.tsx)

Important distinction:
- the skipped Practice phase in guest playback is not specific to lesson `232`
- the sampled linked question bank for lesson `232` is still a lesson-specific blocker because those questions are placeholder-quality
