# Lesson Source Of Truth Ownership

Purpose: define who owns the lesson-spec stack in this repo, what kinds of changes each owner can make, and what approval is required before the standards, archetype docs, exemplar lessons, or audit outputs are treated as authoritative.

This doc is the governance layer for the lesson source-of-truth stack, not a process manual.

---

## Scope

This governance applies to:
- `docs/lesson-source-of-truth.md`
- `docs/gold-lesson-rubric.md`
- `docs/gold-lesson-review-checklist.md`
- `docs/lesson-archetypes.md`
- `docs/archetypes/*.md`
- lesson exemplar docs such as `docs/perimeter-launch-gold.md`
- audit and review outputs that are treated as reference material for lesson quality

This governance does not replace:
- code review rules for implementation changes
- project-level release or merge requirements
- subject-matter review for individual lesson content

---

## Ownership Areas

### 1. Lesson Standards

Owned by:
- lesson standards owner

Includes:
- `gold-lesson-rubric.md`
- `gold-lesson-review-checklist.md`
- the standards sections of `lesson-source-of-truth.md`

Owns:
- what "gold" means
- what the universal lesson contract is
- what the review checklist asks reviewers to verify

### 2. Archetype Catalog

Owned by:
- lesson architecture owner

Includes:
- `lesson-archetypes.md`
- archetype status labels
- archetype mapping heuristics

Owns:
- which lesson types exist
- which grade bands and subjects map to them
- when an archetype is `Live`, `Candidate`, or `Future`

### 3. Archetype Specs

Owned by:
- lesson architecture owner
- subject reviewer for the relevant domain

Includes:
- `docs/archetypes/*.md`

Owns:
- lesson shell expectations
- checkpoint and practice shape
- visual and support rules
- banned patterns for that archetype

### 4. Exemplars

Owned by:
- lesson architecture owner
- subject reviewer

Includes:
- canonical exemplar lessons used to model an archetype

Owns:
- whether a lesson is fit to guide similar rewrites
- whether the exemplar is still aligned with the current player behavior

### 5. Audit Outputs

Owned by:
- audit owner

Includes:
- human review notes
- audit summaries
- batch comparison outputs

Owns:
- how review results are reported
- which findings are considered blockers
- which outputs are source material versus disposable run logs

---

## Change Authority

### Standards Layer

Allowed to change:
- lesson standards owner

Requires review from:
- lesson architecture owner if the change affects archetype behavior
- runtime owner if the change affects parser expectations or player behavior

Typical changes:
- rubric wording
- checklist criteria
- new pass/fail thresholds

### Archetype Catalog

Allowed to change:
- lesson architecture owner

Requires review from:
- lesson standards owner
- subject reviewer if the mapping changes by domain

Typical changes:
- adding or removing an archetype
- changing archetype status
- changing a grade-band mapping

### Archetype Specs

Allowed to change:
- lesson architecture owner
- subject reviewer for the domain

Requires review from:
- lesson standards owner if the change alters the universal shell
- runtime owner if the change affects parser-safe structure or the player contract

Typical changes:
- updating section requirements
- tightening checkpoint rules
- changing visual rules
- adding or removing banned patterns

### Exemplars

Allowed to change:
- lesson architecture owner
- subject reviewer

Requires review from:
- lesson standards owner if the exemplar becomes the guide pattern
- runtime owner if the exemplar depends on player behavior that changed

Typical changes:
- re-approving a lesson as the archetype exemplar
- replacing an exemplar after a major lesson rewrite
- deprecating an exemplar that no longer matches the spec

### Audit Outputs

Allowed to change:
- audit owner

Requires review from:
- lesson architecture owner if the audit criteria changed
- runtime owner if the output reflects a parser or player regression

Typical changes:
- updating a generated report format
- adding a blocker category
- changing what gets summarized in a batch review

---

## Approval Thresholds

Use the following thresholds before a change is treated as authoritative.

### 1. Standards Changes

Requires:
- one direct owner approval
- one secondary review when the change can affect lesson parsing, grading, or exemplar selection

Examples:
- rubric language changes need standards owner approval
- checklist changes that alter review pass/fail behavior need secondary review

### 2. Archetype Changes

Requires:
- lesson architecture owner approval
- subject reviewer approval for the affected domain

Examples:
- a new science pattern needs architecture and science review
- a K-5 math rule change needs architecture and math review

### 3. Exemplar Approval

Requires:
- lesson architecture owner approval
- subject reviewer approval
- confirmation that the lesson passes the current review checklist

Examples:
- a lesson cannot become the guide exemplar unless it is already acceptable as a gold candidate

### 4. Audit Output Changes

Requires:
- audit owner approval
- review from the owner of the underlying standards if the report is used as decision support

Examples:
- report formatting can be updated by the audit owner
- blocker definitions need standards or architecture review if they affect judgment

---

## Review Cadence

Review the lesson-spec stack on a fixed cadence so it does not drift from the player or the content model.

### Monthly

Review:
- exemplar status
- major audit findings
- any spec changes that have landed since the last check

Goal:
- keep the spec stack aligned with what the player actually does now

### Quarterly

Review:
- archetype catalog scope
- archetype status labels
- whether any archetype should be split, merged, or deprecated

Goal:
- prevent the catalog from accumulating stale categories

### After Major Runtime Changes

Review:
- parser-safe section expectations
- visual rules
- checkpoint/practice compatibility
- exemplar validity

Goal:
- confirm the docs still match the lesson player contract

### After Large Content Batches

Review:
- audit findings
- recurring blockers
- whether an archetype spec needs tightening

Goal:
- use real lesson data to refine the spec stack

---

## Minimum Update Rules

When updating the lesson-spec stack, follow these rules.

### 1. Update Source, Not Just Output

Do not edit audit outputs, exemplar notes, or review summaries as if they were the source of truth.

If the underlying standard changed:
- update the rubric, checklist, archetype spec, or exemplar first
- regenerate the derived output after the source change

### 2. Keep Statuses Honest

When a spec changes:
- update the `Status` line if the change affects whether it is `Live`, `Candidate`, or `Future`
- do not leave a spec looking more authoritative than it is

### 3. Keep Exemplar Links Current

When an exemplar changes:
- update the archetype spec
- update any source-of-truth references that name the exemplar
- make sure the exemplar still matches the current parser and player behavior

### 4. Keep Changes Narrow

When possible:
- change one archetype or one standards layer at a time
- do not mix rubric edits, archetype rewrites, and exemplar replacement in one unreviewed change unless the batch is intentional

### 5. Preserve Parsability

Any standards or archetype update must preserve the current lesson parser contract:
- headings remain stable
- vocabulary remains parser-safe
- section names still map cleanly to lesson flow

### 6. Document the Reason

Any authority-bearing change should include a short rationale:
- what changed
- why it changed
- what downstream docs or reviews must be revisited

---

## Decision Rule

If there is a conflict between:
- a spec doc
- an exemplar lesson
- an audit summary

Use this order:
1. the universal standards in the rubric and checklist
2. the relevant archetype spec
3. the current canonical exemplar
4. the audit summary

If the exemplar or audit summary disagrees with the rubric or archetype spec, the lower-priority artifact should be updated or deprecated.

