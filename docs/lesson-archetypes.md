# Lesson Archetypes

Purpose: define the lesson archetypes ElevatED should use as the organizing layer between the universal lesson rubric and large-scale lesson rewrite work.

This doc is the catalog, not the full spec for each archetype.

Use it to answer:
- what lesson types exist
- which subjects and grade bands belong to each type
- which archetypes are ready now vs still draft
- which exemplar(s) and future spec docs should anchor them

Related docs:
- [lesson-source-of-truth.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-source-of-truth.md)
- [gold-lesson-rubric.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-rubric.md)
- [gold-lesson-review-checklist.md](/Users/drmixer/code/ElevatEDNEW/docs/gold-lesson-review-checklist.md)

---

## Why Archetypes Matter

The repo should not improve lessons by treating every lesson as a unique writing project.

Instead:
- many lessons share the same instructional job
- each instructional job should map to an archetype
- each archetype should have one or more exemplar lessons
- bulk audits and rewrites should target archetypes, not random individual lessons

In practice, archetypes are the missing layer between:
- "what a good lesson is" and
- "how we fix hundreds of lessons efficiently"

---

## Archetype Design Rules

An archetype should be:
- broad enough to cover many lessons
- narrow enough to enforce a real teaching pattern
- stable across many modules
- tied to grade-band and subject expectations

An archetype should define:
- instructional purpose
- best-fit subjects
- best-fit grade bands
- default section structure
- checkpoint style
- practice style
- visual expectations
- support expectations
- banned patterns

An archetype should not be:
- one lesson topic
- one standard
- one module
- one-off author preference

---

## Status Labels

Use these labels in this catalog:

- `Live`
  The archetype is real enough to govern active lesson improvement work now.
- `Candidate`
  The archetype is clearly needed, but its full spec or exemplar is not nailed down yet.
- `Future`
  The archetype is useful long-term, but not needed for the immediate lesson-quality push.

---

## Current Recommended Archetype Set

### 1. K-5 Math Concept / Procedure

Status:
- `Live`

Best fit:
- Mathematics
- Grades K-5
- topics where students need a direct explanation plus one or more worked examples

Examples:
- perimeter
- area
- place value
- fractions
- measurement
- basic operations

Teaching shape:
- short concrete introduction
- short vocabulary block when useful
- direct concept explanation
- worked examples with visible numbers/units
- short summary

Checkpoint style:
- define / compute / scenario rotation

Practice style:
- scaffolded, concrete, answerable from the lesson model

Visual expectations:
- frequent
- directly tied to the example or practice numbers

Current exemplar:
- lesson `1437`
- [perimeter-launch-gold.md](/Users/drmixer/code/ElevatEDNEW/docs/perimeter-launch-gold.md)

Spec:
- [k5-math-concept-procedure.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/k5-math-concept-procedure.md)

### 2. Upper Math Worked Example

Status:
- `Candidate`

Best fit:
- Mathematics
- Grades 6-12
- topics that depend on symbolic reasoning, method choice, and multi-step example work

Examples:
- ratios
- expressions and equations
- linear functions
- geometry problem solving
- trigonometric setup
- calculus procedures

Teaching shape:
- goal and notation setup
- concept explanation
- worked example(s)
- common mistake contrast
- summary

Checkpoint style:
- concept check
- method selection
- solve/interpret

Practice style:
- multi-step
- less "kid scaffold," more explicit reasoning

Visual expectations:
- selective, not constant
- used when diagrams/tables/graphs actually help

Current exemplar:
- none yet

Spec:
- [upper-math-worked-example.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/upper-math-worked-example.md)

### 3. ELA Reading / Analysis

Status:
- `Candidate`

Best fit:
- English / Language Arts
- Grades 3-12
- reading comprehension, literary analysis, informational text analysis

Examples:
- main idea
- theme
- character analysis
- text evidence
- comparing sources

Teaching shape:
- reading purpose
- context or vocabulary
- text or excerpt focus
- model analysis / claim with evidence
- summary

Checkpoint style:
- meaning
- evidence
- interpretation

Practice style:
- evidence-grounded
- avoids generic "what is important?" filler

Visual expectations:
- optional
- more useful for organizers, annotation models, or text structure support than decorative images

Current exemplar:
- none yet

Spec:
- [ela-reading-analysis.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/ela-reading-analysis.md)

### 4. Science Phenomenon / Evidence

Status:
- `Candidate`

Best fit:
- Science
- Grades 3-12
- lessons centered on explaining observations, models, systems, or cause/effect relationships

Examples:
- ecosystems
- weather
- plate tectonics
- forces and motion
- matter and energy

Teaching shape:
- observation or guiding question
- core concept explanation
- model/evidence/example
- reasoning or conclusion
- summary

Checkpoint style:
- observation meaning
- evidence interpretation
- concept application

Practice style:
- explanation and evidence, not only vocabulary recall

Visual expectations:
- often important
- diagrams/models/charts should do real teaching work

Current exemplar:
- none yet

Spec:
- [science-phenomenon.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/science-phenomenon.md)

### 5. History / Social Studies Source Analysis

Status:
- `Candidate`

Best fit:
- Social Studies / History / Civics
- Grades 4-12
- lessons that need context, evidence, perspective, and sourcing

Examples:
- primary source analysis
- historical causation
- civic structures
- compare perspectives

Teaching shape:
- context
- source framing or key terms
- evidence/example
- interpretation
- summary

Checkpoint style:
- sourcing
- evidence
- inference/claim

Practice style:
- context-aware
- avoids unsupported opinion prompts

Visual expectations:
- useful for timelines, maps, source excerpts, diagrams, charts

Current exemplar:
- none yet

Spec:
- [history-source-analysis.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/history-source-analysis.md)

### 6. Study Skills / Metacognitive Routine

Status:
- `Candidate`

Best fit:
- Study skills
- cross-subject support lessons
- habits, planning, organization, reflection

Examples:
- note-taking
- planning a study session
- checking work
- building a revision routine

Teaching shape:
- purpose
- short routine or framework
- worked model
- self-application prompt
- summary

Checkpoint style:
- identify the routine
- choose the best next step
- apply in a simple scenario

Practice style:
- scenario-based, not generic self-help filler

Visual expectations:
- light
- checklists, routine cards, or organizers over decorative images

Current exemplar:
- none yet

Spec:
- [study-skills-routine.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/study-skills-routine.md)

### 7. Specials / Applied Concept Lesson

Status:
- `Future`

Best fit:
- arts
- music
- health
- PE
- computer science
- other non-core domains that still need structured lessons

Why it is separate:
- these subjects often need a concept + example format, but not always the same evidence style as ELA/history/science

Likely teaching shape:
- purpose
- concept explanation
- model/example
- guided application
- summary

Current exemplar:
- none yet

Spec:
- [applied-concept.md](/Users/drmixer/code/ElevatEDNEW/docs/archetypes/applied-concept.md)

---

## Archetype Mapping Heuristics

Use these as the first-pass classification rules.

### Mathematics

- Grades K-5 -> `K-5 Math Concept / Procedure`
- Grades 6-12 -> `Upper Math Worked Example`

### English / Language Arts

- reading comprehension, text evidence, literary analysis -> `ELA Reading / Analysis`

### Science

- explanation of systems, models, evidence, observation -> `Science Phenomenon / Evidence`

### Social Studies / History / Civics

- source interpretation, chronology, systems, perspective -> `History / Social Studies Source Analysis`

### Study Skills

- planning, reflection, routines, habits -> `Study Skills / Metacognitive Routine`

### Arts / Music / Health / PE / CS

- default temporary bucket -> `Specials / Applied Concept Lesson`
- may later split into more precise archetypes if needed

---

## What Counts As "Different Enough" For A New Archetype

Create a new archetype only if all of these are true:
- the lesson type needs a meaningfully different teaching pattern
- the checkpoint/practice shape changes materially
- the visual/support expectations also change materially
- trying to force it into an existing archetype would weaken quality

Do not create a new archetype just because:
- the topic is different
- one module has a special preference
- one lesson uses a different example

---

## Immediate Recommendation

The current catalog is now fully backed by per-archetype spec docs.

The next documentation work should be:

1. approve exemplar lessons for the non-math and upper-math archetypes using [lesson-exemplar-approval.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-approval.md) and [lesson-exemplar-coverage.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-exemplar-coverage.md)
2. wire archetype tags and audit statuses into lesson metadata and script outputs
3. make the audit and rewrite scripts follow the operational flow in [lesson-audit-pipeline.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-audit-pipeline.md) and [lesson-rewrite-pipeline.md](/Users/drmixer/code/ElevatEDNEW/docs/lesson-rewrite-pipeline.md)

That is enough to move from "archetype library exists" to "archetype library governs real rewrite operations."

---

## Operational Use

This catalog should eventually govern:
- lesson metadata tagging
- automated audits
- bulk rewrite scripts
- exemplar selection
- exception review queues

When the rewrite pipeline exists, every lesson should have:
- an assigned archetype
- an audit result against that archetype
- a status such as `gold`, `near_gold`, `needs_rewrite`, or `exception_review`

---

## Current Recommendation

Use this working model now:
- the universal standard lives in the rubric
- the perimeter launch lesson remains the K-5 math exemplar
- future lesson improvement should be grouped by archetype
- new lesson specs should extend existing archetypes before creating new ones
