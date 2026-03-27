# Exemplar Rewrite: Lesson 648

Lesson ID:
- `648`

Lesson title:
- `Intro: Music Theory (intro)`

Archetype target:
- `Specials / Applied Concept Lesson`

Date:
- `2026-03-25`

Status:
- rewritten in repo source-of-truth and synced to the live lesson row

Source-of-truth files:
- [6-electives-arts-and-music-music-theory-intro-launch.md](/Users/drmixer/code/ElevatEDNEW/data/lessons/curated/6-electives-arts-and-music-music-theory-intro-launch.md)
- [arts_music_authored_launch_lessons.json](/Users/drmixer/code/ElevatEDNEW/data/lessons/arts_music_authored_launch_lessons.json)
- [arts_music_authored_practice_items.json](/Users/drmixer/code/ElevatEDNEW/data/practice/arts_music_authored_practice_items.json)

Sync utilities used:
- [sync_lesson_markdown.ts](/Users/drmixer/code/ElevatEDNEW/scripts/sync_lesson_markdown.ts)
- [sync_module_authored_practice.ts](/Users/drmixer/code/ElevatEDNEW/scripts/sync_module_authored_practice.ts)

---

## What Changed

The original lesson `648` was not usable as an applied-concept exemplar:
- it was a generic "music is a language" overview instead of a concrete music-theory lesson
- it listed broad vocabulary like `composition`, `rhythm`, and `dynamics` without building one transferable skill
- it had no worked example showing how a student should apply the technique
- it was linked only to generic skill `8`, `intro`
- that skill resolved to unrelated generic practice rows, including placeholder math prompts
- module `15` also had a second public lesson row, `1855`, which blocked canonical clarity

The rewrite changed lesson `648` into a real applied-concept lesson:
- added parser-safe `## Introduction`
- anchored the lesson in a concrete task: deciding why one short chord progression sounds finished and another sounds unfinished
- taught a bounded grade-6 concept set built around the C major scale, triads, and the jobs of tonic, subdominant, and dominant
- added a worked example comparing `C-F-G` with `C-F-G-C`
- added a guided application section built around a short announcement-jingle scenario

The practice and canonical layers were also repaired:
- lesson `648` now uses dedicated skill `433`, `music_theory_progression_basics`
- the live bank now contains `12` managed questions (`Q27597` through `Q27608`)
- the new practice questions match the rewritten lesson's chord-building and progression-analysis job
- stale public sibling lesson `1855` was demoted to `draft`, so lesson `648` is now the only public lesson in module `15`
- lesson `648` metadata now points to the curated markdown source file and the correct module slug

---

## Verification

Completed:
- parser check on the markdown source shows `3` objectives, a real hook, `6` vocabulary terms, `6` learn sections, and a summary
- live lesson row `648` now points to the curated markdown source file
- live lesson skill mapping now resolves only to skill `433`
- live practice fetch now resolves to the `12` authored lesson-aligned questions
- module `15` now resolves lesson `648` as its only public lesson in the lesson-detail API
- browser/player validation on `2026-03-25` confirmed that Welcome, all `6` Learn sections, and Review render correctly for lesson `648`

Runtime notes:
- the `playwright` skill wrapper remains broken in this environment because `@playwright/mcp` is not exposing `playwright-cli`
- browser validation was completed instead through the installed local Playwright package against the local Vite dev server
- guest playback still skips Practice because `LessonPlayerPage` only fetches practice when a `studentId` exists

Artifacts:
- screenshots saved under `output/playwright/`
