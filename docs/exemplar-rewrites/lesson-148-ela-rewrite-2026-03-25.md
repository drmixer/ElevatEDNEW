# Exemplar Rewrite: Lesson 148

Lesson ID:
- `148`

Lesson title:
- `Science/Tech Articles (open-licensed)`

Archetype target:
- `ELA Reading / Analysis`

Date:
- `2026-03-25`

Status:
- rewritten in repo source-of-truth and synced to the live lesson row

Source-of-truth files:
- [7-english-language-arts-reading-informational-science-tech-articles-open-licensed-launch.md](/Users/drmixer/code/ElevatEDNEW/data/lessons/curated/7-english-language-arts-reading-informational-science-tech-articles-open-licensed-launch.md)
- [ela_authored_launch_lessons.json](/Users/drmixer/code/ElevatEDNEW/data/lessons/ela_authored_launch_lessons.json)
- [ela_authored_practice_items.json](/Users/drmixer/code/ElevatEDNEW/data/practice/ela_authored_practice_items.json)

Sync utilities used:
- [sync_lesson_markdown.ts](/Users/drmixer/code/ElevatEDNEW/scripts/sync_lesson_markdown.ts)
- [sync_module_authored_practice.ts](/Users/drmixer/code/ElevatEDNEW/scripts/sync_module_authored_practice.ts)

---

## What Changed

The original lesson was too generic to serve as an ELA exemplar:
- it used a science water-cycle image that did not support the reading move
- it had no concrete passage or excerpt
- it talked about article analysis in broad terms instead of modeling claim, evidence, and explanation
- its linked practice was attached to skill `27`, `licensed`, and pulled generic cross-module article questions

The rewrite changed the lesson into a text-anchored informational-reading model:
- added parser-safe `## Introduction`
- removed the mismatched visual
- introduced a self-authored article excerpt, "A Cooler Roof for Carter Middle School"
- added clear vocabulary for `central idea`, `supporting detail`, `claim`, `credible`, and `evidence`
- modeled central idea, strongest evidence, and credibility analysis explicitly
- added a claim-evidence-explanation response frame
- added a topic-versus-central-idea contrast section

The practice layer was also rebuilt:
- lesson `148` now uses dedicated skill `429`, `science_tech_article_analysis`
- the live bank now contains `12` managed questions (`Q27561` through `Q27572`)
- the new practice questions are passage-specific and aligned to the rewritten lesson

---

## Verification

Completed:
- parser check on the markdown source shows clean objectives, a real hook, `5` vocabulary terms, `7` learn sections, and a summary
- live lesson row `148` now points to the curated markdown source file
- live lesson skill mapping now resolves only to skill `429`
- live practice fetch resolves to the `12` authored lesson-aligned questions

Still pending:
- browser/player playback validation
- practice, hint, quick review, and challenge review in the actual lesson player

Reason still pending:
- the local Playwright skill is blocked in this environment because the expected `playwright-cli` binary is not available from the installed `@playwright/mcp` package
