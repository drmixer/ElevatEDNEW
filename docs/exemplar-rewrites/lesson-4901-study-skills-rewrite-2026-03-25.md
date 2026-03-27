# Exemplar Rewrite: Lesson 4901

Lesson ID:
- `4901`

Lesson title:
- `Plan Your Week in 10 Minutes`

Archetype target:
- `Study Skills / Metacognitive Routine`

Date:
- `2026-03-25`

Status:
- authored in repo source-of-truth and synced to the live lesson row

Source-of-truth files:
- [ElevatED_K12_Curriculum_Skeleton.json](/Users/drmixer/code/ElevatEDNEW/data/curriculum/ElevatED_K12_Curriculum_Skeleton.json)
- [study_skills_authored_launch_lessons.json](/Users/drmixer/code/ElevatEDNEW/data/lessons/study_skills_authored_launch_lessons.json)
- [6-study-skills-executive-functioning-plan-your-week-in-10-minutes-launch.md](/Users/drmixer/code/ElevatEDNEW/data/lessons/curated/6-study-skills-executive-functioning-plan-your-week-in-10-minutes-launch.md)
- [study_skills_authored_practice_items.json](/Users/drmixer/code/ElevatEDNEW/data/practice/study_skills_authored_practice_items.json)

Sync utilities used:
- [seed_authored_launch_lessons.ts](/Users/drmixer/code/ElevatEDNEW/scripts/seed_authored_launch_lessons.ts)
- [sync_lesson_markdown.ts](/Users/drmixer/code/ElevatEDNEW/scripts/sync_lesson_markdown.ts)
- [sync_module_authored_practice.ts](/Users/drmixer/code/ElevatEDNEW/scripts/sync_module_authored_practice.ts)

---

## What Changed

The earlier study-skills candidate situation could not support exemplar approval:
- no live grades `3-8` study-skills module or lesson existed in the catalog-backed DB
- the closest live candidates were the health/PE `Fitness Planning` modules (`68`, `70`, `72`), which were domain lessons rather than academic routine lessons
- those health/PE modules also had messy canonical state, including duplicate public lessons and inconsistent skill linkage
- practice quality in that lane was not exemplar-safe:
  - lesson `1918` resolved to generic reflective prompts `Q24113-Q24116`
  - lesson `1920` still resolved through generic skill `69`, `planning`
  - lesson `1922` resolved to malformed generic prompts `Q27029-Q27032`

The rewrite/authoring work created the first dedicated study-skills exemplar lane instead of pretending those health lessons qualified:
- added a new `Study Skills` subject row in the live DB
- added module `2743`, `Plan Your Week in 10 Minutes`
- seeded lesson `4901` as the module's canonical lesson row
- synced curated markdown so the live lesson now teaches a concrete four-step planning routine:
  - map fixed commitments
  - place one anchor block
  - add two short review blocks
  - check the plan
- anchored the lesson in an academic weekly-planning task instead of generic motivation or wellness talk
- added worked and guided scenarios built around realistic student schedules

The practice layer was also created and aligned:
- lesson `4901` now uses dedicated skill `434`, `weekly_study_planning_routine`
- the live bank now contains `12` managed questions (`Q27609` through `Q27620`)
- the new practice questions match the lesson's planning, next-step, and plan-checking routine

---

## Verification

Completed:
- parser check on the markdown source shows `3` objectives, a real hook, `5` vocabulary terms, `8` learn sections, and a summary
- live lesson row `4901` now points to the curated markdown source file
- live lesson skill mapping now resolves only to skill `434`
- live practice fetch now resolves to the `12` authored lesson-aligned questions
- module `2743` now resolves lesson `4901` as its only public lesson in the lesson-detail API
- browser/player validation on `2026-03-25` confirmed that Welcome, all `8` Learn sections, and Review render correctly for lesson `4901`

Runtime notes:
- the `playwright` skill wrapper remains broken in this environment because `playwright-cli` is still not exposed on the wrapper path
- browser validation was completed instead through the installed local Playwright package against the local Vite dev server
- guest playback still skips Practice because `LessonPlayerPage` only fetches practice when a `studentId` exists

Artifacts:
- screenshots saved under `output/playwright/`
