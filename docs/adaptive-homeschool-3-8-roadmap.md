# Adaptive Homeschool 3-8 Roadmap

Purpose: turn ElevatED from a covered lesson library into a practical adaptive homeschool replacement for one student first, with a path to share more broadly later.

Status:
- Active working plan
- Scope is grades 3-8, not all K-12
- Priority is depth, adaptivity, and daily packaging over public-launch polish

Related docs:
- [Adaptive Foundation Plan](/Users/drmixer/code/ElevatEDNEW/docs/adaptive-foundation-plan.md)
- [Content Style Guide](/Users/drmixer/code/ElevatEDNEW/docs/content-style-guide.md)
- [Content Model & Metadata](/Users/drmixer/code/ElevatEDNEW/docs/content-model-phase3.md)

---

## 1. Product Goal

Build a 3-8 adaptive homeschool system that can place a student by skill, teach daily lessons, assign practice, detect weak prerequisites, and give a parent a clear record of what happened.

The app should not behave like a fixed grade-level course. It should behave like a tutor-managed school day:
- diagnose the current working level by subject and strand
- assign a daily plan
- teach new material
- practice and assess
- repair weak prerequisites
- spiral older skills back in
- summarize progress for the parent

This is first for one student. That means the app can be practical and opinionated before it is polished for a broad market.

---

## 2. Current State

The repo now has a strong content base for grades 3-8:
- full 3-8 coverage across Math, ELA, Science, Social Studies, and Electives
- no missing lessons, practice, assessments, or external assets in the coverage rollup
- 1,362 lessons passed content quality audit with 0 issues
- 33,450 question bank rows passed quality audit with 0 flagged and 0 blocked
- Math/ELA/Science/Social Studies/Electives have enough module breadth for adaptive routing

The current content is best understood as:
- good launch lessons
- useful practice sets
- baseline assessments
- broad coverage

It is not yet:
- a full multi-day unit system
- a daily homeschool planner
- a prerequisite-aware mastery engine
- a rich package of readings, projects, labs, writing assignments, and cumulative review

---

## 3. Remaining Homeschool Readiness Gaps

This is the active completion ledger. The goal is not just to add features, but to remove the reasons the app is not yet a full grades 3-8 homeschool replacement.

### 3.1 Math Depth

Current gap:
- Math has the first adaptive spine, but many modules are still closer to single launch lessons than complete teach-practice-repair-mastery arcs.
- Remediation and challenge variants exist for the highest-priority modules, but coverage should expand across the rest of the grades 3-8 math graph.
- Spiral review is not yet rich enough to keep older skills warm across weeks.

Completion target:
- Each high-priority math module has a diagnostic, teach/model lesson, guided practice, independent practice, repair path, challenge path, mastery check, and spiral review items.
- Weak prerequisite evidence reliably inserts backfill work before the student advances.
- Parent math records explain what changed, why it changed, and what older skill is being revisited.

Next actions:
- Expand remediation and challenge variants beyond the first 18 priority modules.
- Add spiral review selection to the math daily plan.
- Persist and display more detailed math work evidence, not only state summaries.

### 3.2 ELA Depth

Current gap:
- ELA has the first real written-response loop and durable work samples.
- Authored content packs currently cover the first Grade 3 modules only.
- Reading, vocabulary, grammar/revision, and longer writing still need broader grades 4-8 depth.

Completion target:
- Grades 3-8 ELA modules include deterministic authored packs for diagnostic, mini-lesson, repair, evidence practice, reflection, and longer writing blocks.
- Reading comprehension, vocabulary in context, evidence paragraphs, grammar/revision, and writing rubrics update separate ELA strengths and weak points.
- Parent work samples show the source content, prompt, rubric, response, score, and next-step reason.

Next actions:
- Expand `shared/elaBlockContentPacks.ts` across Grade 4-8 priority modules.
- Split ELA state into clearer reading, writing, vocabulary, and revision evidence when enough work samples exist.
- Add longer writing/project blocks after short constructed responses feel stable.

### 3.3 Science Loop

Current gap:
- Science has content coverage, and the first lightweight daily loop now exists.
- The first Science loop includes a daily plan, student block page, deterministic CER/data/model scaffold, rubric scoring, subject-state updater, durable work samples, and parent weekly science evidence.
- It still needs more authored science content depth, home investigation variants, and a richer adaptation summary.

Completion target:
- Science runs 2-3 times per week with short phenomenon, investigation, data-table, model-revision, and CER blocks.
- Science completions write to `student_subject_state` and `student_work_samples`.
- Parent can see what phenomenon or investigation was used, what the student claimed/explained, and what the next science step is.

Next actions:
- Build the Science daily plan service and student block page using the ELA work-sample pattern. `Done: /student/homeschool/science-plan, /student/science/block/:blockId, and science block content resolution.`
- Add deterministic science prompts and rubrics for CER, data interpretation, home investigation notes, and model revision. `Done for first CER/data/model scaffold: shared/scienceBlockPrompts.ts and shared/scienceBlockContent.ts.`
- Add parent weekly science record and adaptation summary. `Partially done: parent weekly science record and work-sample detail are live; richer adaptation summary is still pending.`
- Add authored science content packs and home investigation variants across priority Grade 3-8 modules.

### 3.4 Social Studies Loop

Current gap:
- Social Studies has content coverage, but not a weekly homeschool loop with source analysis and constructed responses.
- It should follow Science after the shared non-math work-sample pattern is proven.

Completion target:
- Social Studies runs 2-3 times per week with source-analysis, map/timeline, cause-effect, civic reasoning, and short constructed-response blocks.
- Social Studies completions write to `student_subject_state` and `student_work_samples`.
- Parent can inspect the source, prompt, response, rubric, and why the next topic was assigned.

Next actions:
- Reuse the Science/ELA block architecture for Social Studies.
- Add deterministic source-analysis and map/timeline prompts.
- Add parent weekly Social Studies evidence.

### 3.5 Full Daily Planner

Current gap:
- Math and ELA can appear as daily cards, but the app does not yet generate a complete multi-subject homeschool day with rollover and weekly balance.
- Required vs optional work is not yet first-class.
- Unfinished work behavior is not fully modeled.

Completion target:
- The parent and student can open the app and see the full school day: required work, optional enrichment, estimated time, subject balance, and unfinished carryover.
- Completed work updates subject state and tomorrow's plan.
- Missed or unfinished blocks roll forward intentionally instead of disappearing.

Next actions:
- Create a unified daily plan model that can compose Math, ELA, Science, Social Studies, and elective blocks.
- Add required/optional flags, weekly subject targets, and rollover rules.
- Add parent daily summary for completed, unfinished, skipped, and reassigned work.

### 3.6 Continuous Adaptation Across Evidence Types

Current gap:
- Adaptation works in pieces, but not uniformly across lesson, quiz, practice, writing, science projects, and social studies source work.
- The deterministic rules need to become a shared cross-subject policy with subject-specific rubrics.

Completion target:
- Lesson completions, practice accuracy, quizzes, written responses, project artifacts, time-on-task, and repeated misses all contribute to explainable state changes.
- Every state change has a parent-facing reason and a next-step rule.
- AI can summarize and support the decision, but deterministic evidence remains the authority.

Next actions:
- Normalize event payloads for subject evidence across Math, ELA, Science, and Social Studies.
- Add shared helper logic for mastery, practice, repair, and backfill outcomes.
- Add tests that prove repeated success advances and repeated struggle repairs/backfills by subject.

### 3.7 Parent Records and Completion Evidence

Current gap:
- Parent weekly views and ELA work samples are improving, but broader homeschool reporting is not complete.
- There is not yet a printable/exportable portfolio or attendance/time summary.

Completion target:
- Parent can export or print a weekly/monthly record showing subjects, time estimates, completed work, scores, mastery changes, work samples, and parent notes.
- `student_work_samples` is the durable portfolio source for written and constructed-response work.
- Gaps, skipped work, and reassigned work are visible instead of hidden.

Next actions:
- Build reporting views on top of `student_work_samples`, subject state, and daily plan history.
- Add export/print support after daily planner history is stable.
- Add a lightweight content/work-sample issue reporting loop.

---

## 4. Design Decision

Keep the adaptive band at grades 3-8.

Do not build only one grade first, because the student may be behind in math and uneven across strands. Placement should be by subject and strand, not by age or enrolled grade.

Example:
- Fractions: grade 4-5 working level
- Geometry: grade 6 working level
- Ratios: grade 5-6 working level
- Expressions/equations: grade 6-7 working level
- Reading comprehension: grade 7-8 working level

The system should use grade as a rough prior, then let evidence decide the actual working level.

---

## 5. Target Daily Experience

A good homeschool day should be generated by the app, not manually assembled by the parent.

Baseline daily package:
- 5 minutes: warmup or spiral review
- 15-25 minutes: new lesson
- 15-25 minutes: guided and independent practice
- 5-10 minutes: correction, explanation, or reflection
- 3-5 minutes: exit ticket

Subject balance can vary by day, but the planner should generally support:
- Math most days
- ELA most days
- Science 2-3 times per week
- Social Studies 2-3 times per week
- Electives/life skills as lighter flexible blocks

Each assigned item should have:
- estimated time
- purpose
- mastery target
- completion evidence
- next-step rule

---

## 6. Content Depth Model

Each important module should eventually become a lesson arc instead of a single launch lesson.

Target arc shape:
1. Diagnostic pre-check
2. Core teach/model lesson
3. Guided practice
4. Independent practice
5. Remediation path
6. Challenge path
7. Application task or project
8. Mastery quiz
9. Spiral review items

Math should get this deepest first because it is prerequisite-heavy and the student is behind there.

ELA depth should focus on:
- reading comprehension
- vocabulary in context
- evidence-based paragraphs
- grammar and sentence revision
- longer writing assignments

Science depth should focus on:
- phenomenon-based lessons
- data tables and graphs
- investigations/labs that can be done at home
- CER writing
- model revision

Social Studies depth should focus on:
- source analysis
- maps/timelines
- cause and effect
- civic and economic reasoning
- short constructed responses

Electives should stay lighter unless the student shows sustained interest.

---

## 7. Adaptive Engine Requirements

The adaptive engine should be deterministic first.

Minimum student state by subject:
- current working level
- confidence
- weak strands
- mastered strands
- current module
- recent evidence window
- next recommended task

Minimum evidence inputs:
- diagnostic results
- lesson completion
- practice accuracy
- quiz accuracy
- time on task
- hint usage, if available
- repeated missed skills

Initial rule policy:
- 85% or higher twice: advance or offer challenge
- 70-84%: continue with normal practice or light reinforcement
- 60-69%: assign repair practice before advancing
- below 60% twice: backfill prerequisites
- repeated fast high scores: skip ahead within the strand
- repeated slow low scores: lower difficulty and add parent note

All path changes should have a plain-language reason visible to the parent.

---

## 8. Parent Layer

For homeschool replacement, the parent layer is not optional.

Needed parent views:
- today completed
- time spent by subject
- scores and mastery changes
- weak skills
- what the app assigned next
- why it assigned that
- suggested parent intervention
- weekly summary
- printable/exportable record

The parent should be able to answer:
- What did he do today?
- Did he understand it?
- What is he struggling with?
- Is he moving forward?
- What should I do if he is stuck?

---

## 9. Phased Build Plan

### Phase 1. Math Adaptive Spine

Goal: make grades 3-8 math work like a prerequisite-aware adaptive course.

Deliverables:
- map math modules into a strand/prerequisite graph
- define diagnostic checkpoints by strand
- add lesson arc metadata for math modules
- create remediation and challenge task types
- update daily planner to assign math by current strand state

Acceptance criteria:
- the student can place below enrolled grade in one strand and higher in another
- missed math skills trigger backfill
- strong performance advances the path
- parent can see why math changed

### Phase 2. Homeschool Daily Planner

Goal: generate a real school day from adaptive state.

Deliverables:
- daily plan model
- subject time targets
- required vs optional work
- completion tracking
- parent daily summary
- weekly rollover for unfinished work

Acceptance criteria:
- parent can open the app and know what the student should do today
- completed work updates mastery and tomorrow's plan
- unfinished work does not disappear

### Phase 3. ELA Reading and Writing Depth

Goal: make ELA useful beyond quizzes.

Deliverables:
- multi-day reading lessons
- evidence paragraph assignments
- vocabulary practice
- grammar/revision mini-lessons
- writing rubrics
- parent-visible writing feedback

Acceptance criteria:
- ELA includes actual written responses
- the app tracks reading and writing separately
- weak evidence/revision skills trigger targeted practice

### Phase 4. Science and Social Studies Weekly Depth

Goal: provide enough non-math/ELA structure for a homeschool week.

Deliverables:
- science investigation templates
- social studies source-analysis templates
- weekly project/application tasks
- short constructed-response rubrics
- home-friendly materials lists

Acceptance criteria:
- science and social studies feel like real subjects, not just reading quizzes
- the weekly plan includes projects or investigations

### Phase 5. Review, Records, and Sharing Readiness

Goal: make the system defensible for use beyond one student.

Deliverables:
- stronger standards audit
- privacy/safety review
- content provenance review
- parent export/report
- content issue reporting loop
- cross-browser smoke test

Acceptance criteria:
- another family could understand what the app does
- progress records are clear
- content gaps can be found and fixed systematically

---

## 10. Near-Term Task List

Start here in the next session:

1. Build the math 3-8 prerequisite map. `Done: data/curriculum/math_3_8_prerequisite_map.json`
2. Add metadata for math strands, prerequisite slugs, difficulty, and estimated time. `Done in the map artifact; still needs DB integration.`
3. Create a script to audit math modules for prerequisite coverage. `Done: npm run audit:math-prereq-map`
4. Define the daily plan data shape. `Done for the first math block: shared/homeschoolDailyPlan.ts`
5. Implement a first deterministic math assignment policy. `Done: shared/mathAdaptivePolicy.ts`
6. Add parent-facing explanation text for math recommendations. `Done in policy output; still needs UI/planner integration.`
7. Connect the math daily planner to live student state. `Done at service/API layer: server/homeschoolPlans.ts and GET /api/v1/student/homeschool/math-plan`
8. Seed remediation and challenge variants for the highest-priority math modules. `Done for 18 priority modules / 72 variants: data/curriculum/math_adaptive_variants_3_8.json`
9. Render the live math plan in the student dashboard. `Done in simplified student dashboard.`
10. Teach the lesson player to open/render a selected adaptive variant. `Done: /student/math/variant/:variantId opens variants from the math daily plan and records scored practice completion.`
11. Add the first ELA homeschool daily loop. `Done: live ELA plan cards, /student/ela/block/:blockId, deterministic prompts/content, rubric scoring, student ELA adaptation state, and parent weekly ELA work samples.`
12. Store ELA work samples durably instead of relying only on subject-state metadata. `Done: supabase/migrations/051_student_work_samples.sql, server/elaWorkSamples.ts, event write-through, and weekly ELA record reads that prefer durable samples with metadata fallback.`
13. Apply and verify the durable ELA work-sample migration in the target Supabase environment. `Done: supabase db push completed through 051_student_work_samples.sql; service-role read check confirmed public.student_work_samples is reachable.`
14. Add the first authored ELA content-pack layer. `Done: shared/elaBlockContentPacks.ts covers diagnostic, mini-lesson, repair, evidence-practice, and reflection content for the first Grade 3 ELA modules; the resolver prefers these packs when the DB only has generic launch content.`
15. Split parent homeschool panels out of ParentDashboardSimplified. `Done: math panels live in ParentDashboard/ParentMathPanels.tsx and ELA panels live in ParentDashboard/ParentElaPanels.tsx.`
16. Add the first Science homeschool daily loop. `Done: live Science plan card, /student/science/block/:blockId, deterministic CER/data/model content, rubric scoring, science subject-state updates, durable work samples, and parent weekly Science work samples.`

Next ELA tasks:
- add more ELA authored content packs for Grade 4-8 once the first Grade 3 loop feels good in real use
- add a dedicated parent work-sample route or modal if inline detail becomes too crowded
- add export/reporting views on top of `student_work_samples` once daily use creates enough real samples

Highest-priority math strands:
- place value and operations
- multiplication/division fluency
- fractions
- decimals
- ratios and rates
- expressions and equations
- word problems and mathematical modeling

Next subject decision:
- Build Science next as the first lightweight non-ELA loop. It should reuse the durable work-sample pattern, but the completion artifact should be a short CER response, home investigation note, model revision, or data-table explanation.
- Add Social Studies after Science. Its loop should reuse the same subject-state/work-sample foundation with source-analysis, map/timeline, cause-effect, and civic reasoning prompts.

Storage decision:
- Keep `student_subject_state` as the current adaptive state snapshot.
- Keep `student_work_samples` as the durable homeschool portfolio source of truth for written or constructed-response work across ELA, Science, and Social Studies.
- Add export/report tables only when parent reporting needs exceed what can be derived from `student_work_samples`.

---

## 11. New Chat Handoff Prompt

Use this prompt to resume work in a fresh chat:

```text
We are building ElevatED into a 3-8 adaptive homeschool replacement for my son first. Read docs/adaptive-homeschool-3-8-roadmap.md and docs/adaptive-foundation-plan.md, then continue with the next task from the roadmap. Math has the first adaptive spine. ELA now has a lighter homeschool loop with durable work samples and first Grade 3 authored content packs. Parent math/ELA homeschool panels have been split out of ParentDashboardSimplified. Start by running a signed-in post-migration ELA smoke if needed, then expand ELA content packs or begin the Science lightweight homeschool loop using student_work_samples as the durable portfolio layer.
```

Suggested first commands:

```bash
sed -n '1,260p' docs/adaptive-homeschool-3-8-roadmap.md
sed -n '1,260p' docs/adaptive-foundation-plan.md
rg -n "learning_path|adaptive|mastery|student_subject|diagnostic|recommend" src server shared scripts supabase
npm run audit:math-prereq-map
```

---

## 12. Operating Principle

Do not chase more raw coverage first. The key shift is packaging and adaptivity:

- from modules to arcs
- from lessons to daily plans
- from quizzes to mastery evidence
- from grade level to strand level
- from parent guessing to parent summaries

Coverage is now good enough to build on. Depth and routing are the next bottlenecks.
