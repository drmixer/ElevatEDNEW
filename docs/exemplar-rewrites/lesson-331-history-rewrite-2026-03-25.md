# Exemplar Rewrite: Lesson 331

Lesson ID:
- `331`

Lesson title:
- `Citizenship & Rights Launch Lesson`

Archetype target:
- `History / Social Studies Source Analysis`

Date:
- `2026-03-25`

Status:
- rewritten in repo source-of-truth and synced to the live lesson row

Source-of-truth files:
- [4-social-studies-civics-and-government-citizenship-and-rights-launch.md](/Users/drmixer/code/ElevatEDNEW/data/lessons/curated/4-social-studies-civics-and-government-citizenship-and-rights-launch.md)
- [authored_launch_lessons.json](/Users/drmixer/code/ElevatEDNEW/data/lessons/authored_launch_lessons.json)
- [authored_practice_items.json](/Users/drmixer/code/ElevatEDNEW/data/practice/authored_practice_items.json)

Sync utilities used:
- [sync_lesson_markdown.ts](/Users/drmixer/code/ElevatEDNEW/scripts/sync_lesson_markdown.ts)
- [sync_module_authored_practice.ts](/Users/drmixer/code/ElevatEDNEW/scripts/sync_module_authored_practice.ts)

---

## What Changed

The earlier version of lesson `331` could not serve as a history/source-analysis exemplar:
- it talked about source analysis in general terms instead of centering a real source
- it used a decorative citizenship logo instead of evidence-bearing source material
- it had no strong observation-versus-inference model
- it was linked only to generic skill `218`, `Social Studies: Citizenship & Rights`
- the available question bank was a generic generated citizenship set rather than lesson-aligned practice

The rewrite changed the lesson into a real civic-source analysis lesson:
- added parser-safe `## Introduction`
- anchored the lesson in a concrete primary source: a First Amendment excerpt from the Bill of Rights
- replaced the generic overview with sourcing, observation, inference, and purpose sections
- added a worked claim-evidence-reasoning example using a civic petition scenario
- removed the decorative image and made the source text itself carry the instructional work

The practice layer was also rebuilt:
- lesson `331` now uses dedicated skill `431`, `citizenship_rights_source_analysis`
- the live bank now contains `12` managed questions (`Q27585` through `Q27596`)
- the new practice questions are source-specific and aligned to the rewritten lesson

The history canonical layer was also resolved:
- module `602` now serves lesson `331` as its only public lesson
- duplicate sibling lesson `3283` remains `draft`

---

## Verification

Completed:
- parser check on the markdown source shows `3` objectives, a real hook, `5` vocabulary terms, `7` learn sections, and a summary
- live lesson row `331` now points to the curated markdown source file
- live lesson skill mapping now resolves only to skill `431`
- live practice fetch resolves to the `12` authored lesson-aligned questions
- browser/player validation on `2026-03-25` confirmed that Welcome, all `7` Learn sections, and Review render correctly for lesson `331`

Runtime notes:
- guest playback still skips Practice because the player only fetches practice when a `studentId` exists
- practice alignment was therefore verified in the live DB/question-bank layer rather than by guest playback UI
- local Playwright wrapper remains broken because `playwright-cli` is not installed, so browser validation was run directly through the installed local Playwright package

Artifacts:
- screenshots saved under `output/playwright/`
