# Exemplar Rewrite: Lesson 4648

Lesson ID:
- `4648`

Lesson title:
- `Plate Tectonics (Earth & Space Science, Grade 6): Grade 6 Launch Lesson`

Archetype target:
- `Science Phenomenon / Evidence`

Date:
- `2026-03-25`

Status:
- rewritten in repo source-of-truth and synced to the live lesson row

Source-of-truth files:
- [6-science-earth-space-plate-tectonics-launch.md](/Users/drmixer/code/ElevatEDNEW/data/lessons/curated/6-science-earth-space-plate-tectonics-launch.md)
- [science_authored_launch_lessons.json](/Users/drmixer/code/ElevatEDNEW/data/lessons/science_authored_launch_lessons.json)
- [science_authored_practice_items.json](/Users/drmixer/code/ElevatEDNEW/data/practice/science_authored_practice_items.json)

Sync utilities used:
- [sync_lesson_markdown.ts](/Users/drmixer/code/ElevatEDNEW/scripts/sync_lesson_markdown.ts)
- [sync_module_authored_practice.ts](/Users/drmixer/code/ElevatEDNEW/scripts/sync_module_authored_practice.ts)

---

## What Changed

The original lesson was not usable as a science exemplar:
- it contained a mismatched math visual, `/images/lessons/math/area_perimeter.svg`
- it was a generic shell rather than a real science phenomenon lesson
- it did not build from observation to evidence to explanation
- it was linked to generic generated practice through skill `307`
- the module still exposed older public sibling lessons that blocked canonical clarity

The rewrite changed the lesson into a real plate-tectonics evidence lesson:
- added parser-safe `## Introduction`
- removed the mismatched visual entirely
- anchored the lesson in the observable pattern that earthquakes and volcanoes cluster at plate boundaries
- added concrete evidence sections for continent-fit clues and ocean-floor clues
- added explicit boundary-type explanation for convergent, divergent, and transform motion
- added a worked Andes example using claim, evidence, and reasoning

The practice and canonical layers were also repaired:
- lesson `4648` now uses dedicated skill `430`, `plate_tectonics_evidence`
- the live bank now contains `12` managed questions (`Q27573` through `Q27584`)
- the questions match the rewritten lesson's evidence and boundary-pattern logic
- module `686` was moved to live serving state (`public`, `open_track: true`)
- stale public sibling lessons `368` and `4500` were demoted to `draft` so lesson `4648` is now the only public lesson in module `686`

---

## Verification

Completed:
- parser check on the markdown source shows `3` objectives, a real hook, `5` vocabulary terms, `6` learn sections, and a summary
- live lesson row `4648` now points to the curated markdown source file
- live lesson skill mapping now resolves only to skill `430`
- live practice fetch resolves to the `12` authored lesson-aligned questions
- module `686` now resolves lesson `4648` as its only public lesson in the lesson-detail API
- browser/player validation on `2026-03-25` confirmed that Welcome, Learn, and Review render correctly for lesson `4648`

Runtime notes:
- the local Playwright skill wrapper still fails because `playwright-cli` is not exposed by `@playwright/mcp`
- browser validation was completed instead through the installed local Playwright package against the dev server
- guest playback still moves from Learn directly to Review because `LessonPlayerPage` only fetches practice when a `studentId` exists

Artifacts:
- screenshots saved under `output/playwright/`
