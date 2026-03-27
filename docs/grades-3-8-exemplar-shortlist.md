# Grades 3-8 Exemplar Shortlist

Purpose: turn the active grades `3-8` focus window into a concrete exemplar-candidate ledger, so approval work and rewrite work can point at real lesson IDs instead of generic archetype placeholders.

Status:
- `Draft`
- based on current grades `3-8` lesson inventory plus quick candidate review on `2026-03-25`

Related docs:
- [lesson-source-of-truth.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-source-of-truth.md)
- [lesson-exemplar-coverage.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-coverage.md)
- [lesson-exemplar-approval.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-approval.md)
- [lesson-audit-pipeline.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-audit-pipeline.md)
- [lesson-rewrite-pipeline.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-rewrite-pipeline.md)
- [lesson-archetypes.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-archetypes.md)

---

## 1. What This Shortlist Is

This shortlist is:
- the current best guess at which lessons should be reviewed first as grades `3-8` exemplars
- a planning tool for audit and rewrite sequencing
- a concrete bridge between the archetype specs and actual lesson rows

This shortlist is not:
- an approval record
- proof that a lesson is already gold
- a substitute for the exemplar review workflow

Use this doc to decide:
- which lesson to audit first for each archetype
- which backup lesson to use if the first candidate fails review
- which lanes are ready for approval now versus rewrite-first work

---

## 2. Candidate Selection Rules

Candidates were prioritized using the current repo reality:
- grades `3-8` only
- current lesson inventory in core subjects plus electives
- lessons with public visibility when available
- lessons with parser-safe section shells already present
- lessons that look reusable enough to guide sibling rewrites

Quick review also checked for obvious blocker patterns such as:
- mismatched visuals
- generic or weak instructional framing
- lessons that fit the subject but not the archetype
- lessons that would need a rewrite before they are safe to copy

---

## 3. Shortlist Table

| Archetype | Primary Candidate | Backup Candidate(s) | Current Fit | Known Blockers | Immediate Next Step |
| --- | --- | --- | --- | --- | --- |
| K-5 Math Concept / Procedure | Lesson `1437`, `Perimeter (Intro) Launch Lesson` | Secondary breadth candidates can be added later for grades `3-5` | Already approved | None for current guide use | Retain as the grades `3-5` math guide exemplar |
| Upper Math Worked Example | Lesson `232`, `Similarity & Congruence` (Grade `8`, Math) | Lesson `219`, `Similarity & Congruence` (Grade `7`, Math) | Approved exemplar on `2026-03-25` | No current approval blocker; guest practice gating remains a player-wide caveat, not a lesson-232 content blocker | Use lesson `232` as the rewrite model; keep `219` as the backup depth candidate |
| ELA Reading / Analysis | Lesson `148`, `Science/Tech Articles (open-licensed)` (Grade `7`, ELA) | Lesson `116`, `Biographies (PD) Launch Lesson` (Grade `5`, ELA) | Approved exemplar on `2026-03-25` | No current approval blocker; guest practice gating remains a player-wide caveat rather than a lesson-148 content blocker | Use lesson `148` as the rewrite model; keep `116` as the backup depth candidate |
| Science Phenomenon / Evidence | Lesson `4648`, `Plate Tectonics (Earth & Space Science, Grade 6): Grade 6 Launch Lesson` | Lesson `261`, `Launch Lesson: Life Science Human Body Systems Intro` (Grade `4`, Science) | Approved exemplar on `2026-03-25` | No current approval blocker; guest practice gating remains a player-wide caveat rather than a lesson-4648 content blocker | Use lesson `4648` as the rewrite model; keep `261` as the backup depth candidate |
| History / Social Studies Source Analysis | Lesson `331`, `Citizenship & Rights Launch Lesson` (Grade `4`, Social Studies) | Lesson `338`, `Citizenship & Rights Launch Lesson` (Grade `5`, Social Studies) | Approved exemplar on `2026-03-25` | No current approval blocker; guest practice gating remains a player-wide caveat rather than a lesson-331 content blocker | Use lesson `331` as the rewrite model; keep `338` only as a rejected backup candidate until it is substantially repaired |
| Study Skills / Metacognitive Routine | Lesson `4901`, `Plan Your Week in 10 Minutes` (Grade `6`, Study Skills) | None yet | Approved exemplar on `2026-03-25` | No current approval blocker; guest practice gating remains a player-wide caveat rather than a lesson-4901 content blocker | Use lesson `4901` as the rewrite model; add a secondary depth candidate later if needed |
| Specials / Applied Concept Lesson | Lesson `648`, `Intro: Music Theory (intro)` (Grade `6`, Electives) | Lesson `43`, `Drawing/Painting Techniques Launch Lesson` (Grade `4`, Electives) | Approved exemplar on `2026-03-25` | No current approval blocker; guest practice gating remains a player-wide caveat rather than a lesson-648 content blocker | Use lesson `648` as the rewrite model; keep `43` as the backup candidate |

---

## 4. Working Approval Order

Use this order for the current grades `3-8` push:

1. retain lesson `1437` as the approved grades `3-5` math exemplar
2. use lesson `232` as the approved exemplar for `Upper Math Worked Example`
3. use lesson `148` as the approved exemplar for `ELA Reading / Analysis`
4. use lesson `4648` as the approved exemplar for `Science Phenomenon / Evidence`
5. use lesson `331` as the approved exemplar for `History / Social Studies Source Analysis`
6. use lesson `648` as the approved exemplar for `Specials / Applied Concept Lesson`
7. use lesson `4901` as the approved exemplar for `Study Skills / Metacognitive Routine`

Why this order:
- it closes the highest-value grades `3-8` core-subject lanes first
- it now reflects that upper math is no longer blocked at the exemplar layer
- it reflects that ELA and science are now closed at the exemplar layer
- it reflects that the core grades `3-8` lanes now have approved exemplars across math, ELA, science, and history/social studies
- it now closes the final open grades `3-8` exemplar lane
- it keeps electives and study-skills work moving with real approved models instead of placeholder planning notes

---

## 5. Operational Notes

Use this shortlist with the existing workflow:

1. audit the primary candidate with the rubric, review checklist, and archetype spec
2. if the candidate is close but blocked by a small number of issues, route it to deterministic cleanup
3. if the candidate is structurally weak for the archetype, route it to rewrite-first work
4. if the candidate fails for archetype fit, move immediately to the named backup
5. once approved, update [lesson-exemplar-coverage.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-coverage.md) and the relevant archetype spec status notes

Do not use a candidate lesson as a rewrite model just because it is first on this list.

It becomes a real guide exemplar only after approval.

First review records:
- [lesson-232-upper-math-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-232-upper-math-2026-03-25.md)
- [lesson-232-upper-math-rereview-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-232-upper-math-rereview-2026-03-25.md)
- [lesson-148-ela-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-148-ela-2026-03-25.md)
- [lesson-148-ela-rereview-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-148-ela-rereview-2026-03-25.md)
- [lesson-4648-science-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-4648-science-2026-03-25.md)
- [lesson-331-history-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-331-history-2026-03-25.md)
- [lesson-331-history-rereview-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-331-history-rereview-2026-03-25.md)
- [lesson-331-history-rewrite-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-rewrites/lesson-331-history-rewrite-2026-03-25.md)
- [lesson-338-history-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-reviews/lesson-338-history-2026-03-25.md)

Current rewrite draft:
- [lesson-232-upper-math-rewrite-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-rewrites/lesson-232-upper-math-rewrite-2026-03-25.md)
- [lesson-148-ela-rewrite-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-rewrites/lesson-148-ela-rewrite-2026-03-25.md)
- [lesson-4648-science-rewrite-2026-03-25.md](/Users/drmixer/code/ElevatEDNEW/docs/exemplar-rewrites/lesson-4648-science-rewrite-2026-03-25.md)
