# Find My Level CAT Migration Spec

## System Overview
Today, the platform already runs separate placement sessions for Math and ELA, but the system is still partly grade-anchored. A single declared grade and age are used to derive a `gradeBand` and `expectedLevel`, those values influence which placement assessment is selected, and the resulting path is then built from a subject `workingLevel`. That means the current engine is subject-separated, but not yet truly subject-first.

The target system is a subject-first adaptive placement and pathing engine for Math and ELA. The student experiences a single neutral "Find My Level" session, but Math and ELA are probed independently and adaptively behind the scenes. Grade becomes optional and is no longer used for placement logic. Age is used only as a soft hint for tone, framing, and initial probe selection. The output is a per-subject working level plus identified prerequisite gaps, and those outputs drive per-subject learning paths that can self-correct silently after the diagnostic.

## Current System Summary

### How it works now
- Onboarding captures `ageYears` and `gradeLevel` in the student flow.
- The UI starts separate placement sessions for `math` and `english`, then interleaves the questions so the student experiences one flow.
- The backend derives a `gradeBand` and `expectedLevel` from grade and age.
- Placement assessment selection uses `gradeBand`, `subject`, and `expectedLevel`.
- Placement scoring computes a per-subject `workingLevel`, `levelConfidence`, `testedLevels`, `strandEstimates`, and `weakStandardCodes`.
- Path generation already stores per-subject state in `student_subject_state` and can build per-subject subject paths.

### What is already reusable
- `student_subject_state` is the right core record for per-subject placement state.
- `student_assessment_attempts` and `student_assessment_responses` already support resumable per-subject diagnostic sessions.
- The interleaved Math + ELA onboarding UI is already structurally aligned with the target behavior.
- The path builder already knows how to build subject-specific paths.
- `weakStandardCodes` and `strandScores` are a starting point for prerequisite gap insertion.

### What is not good enough
- Grade currently anchors too much of assessment selection and path generation.
- The current `workingLevel` scale is effectively clamped too narrowly for truly behind learners.
- Placement is based on selecting a grade-banded assessment, not on live adaptive item selection.
- Weak prerequisite signals currently pull too much toward broad level movement instead of surgical remediation.
- Post-diagnostic adaptation exists in pieces, but not as a unified subject-level recalibration loop.

## Target Product Behavior

### Onboarding
- Grade is optional.
- Grade is stored, if provided, for reporting, parent/admin context, and future manual assignment suggestions only.
- Grade is not used in placement selection, path seeding, or path correction logic.
- Grade should not be visually prominent during onboarding. It should live in an optional reporting-only section and feel secondary.
- Age is captured for:
  - instruction tone
  - content framing
  - safety policies
  - soft initial probe selection only
- The student is explicitly told they are doing a "Find My Level" session, not a test.
- Math and ELA run as separate adaptive sessions under the hood, but the UI interleaves them into one calm experience.
- The UI never exposes level labels, grade labels, or adaptation behavior during the session.

### Adaptive Diagnostic (CAT)
- Each subject is modeled independently.
- Each subject starts from a soft prior derived from age only.
- The soft prior is neither a floor nor a ceiling.
- Item difficulty changes live:
  - correct response -> harder next item
  - incorrect response -> easier next item
- Each subject aims to converge within 8-12 items.
- Diagnostic phases:
  - Phase 1, Questions 1-3: wide bracket, locate ballpark
  - Phase 2, Questions 4-8: narrow estimate and confidence interval
  - Phase 3, Questions 8-12: confirm level and probe prerequisite dependencies
- Output per subject:
  - `workingLevel`
  - `confidenceInterval`
  - `diagnosticConfidence`
  - `prerequisiteGaps`
  - `recommendedStartingModules`

### Prerequisite Gap Detection
- The engine identifies skill-level or standard-level gaps independently of overall subject level.
- A learner can place at a higher overall level and still get targeted lower-level remediation.
- Example:
  - Math working level = 4
  - detected gap = grade 3 fractions prerequisite
  - result = insert fractions remediation node(s), do not reset full math level to 3
- Same rule applies to ELA:
  - ELA working level = 7
  - detected gap = grade 5 informational text inference
  - result = insert remediation node(s), do not reset entire ELA path

### Learning Path Generation
- Each subject path is generated independently from demonstrated level.
- Different subject levels are normal, expected, and first-class.
- Core path = demonstrated level spine.
- Remediation path = targeted prerequisite nodes inserted before the first dependent node.
- Stretch path = optional forward nodes only after stable performance at current working level.
- The path should feel continuous and coherent, not like a series of resets.

### Continuous Adaptation
- The diagnostic does not end adaptation; it initializes it.
- Early lesson and practice performance feed the same subject model.
- The first several nodes after diagnostic act as live calibration checks.
- If the initial diagnostic estimate was slightly off, the path silently shifts:
  - too easy -> accelerate
  - too hard -> step down or insert support
  - specific recurring gap -> insert targeted remediation
- The learner never sees "level moved down" or "you have been reassigned."
- The parent may optionally see a high-level "path adjusted based on progress" summary, but not as a required first release.

## Data Model Changes

### Preserve as-is conceptually
- `student_profiles.age_years`
- `student_assessment_attempts`
- `student_assessment_responses`
- `student_subject_state`
- `student_paths`
- `learning_sequences`

### Preserve but change semantics

#### `student_profiles.grade_level` / `grade`
- Current meaning:
  - nominal grade anchor used in onboarding and downstream logic
- New meaning:
  - optional reporting field
  - not used for placement or path generation

#### `student_profiles.age_years`
- Current meaning:
  - contributes to expected level
- New meaning:
  - soft prior for probe selection
  - tone/safety framing input
  - not a floor, ceiling, or path lock

#### `student_subject_state.expected_level`
- Current meaning:
  - grade-and-age-seeded expected level
- New meaning:
  - `prior_level_hint`
  - a soft prior only
- Recommendation:
  - keep the column for backward compatibility, but rename in code semantics and stop treating it as a target level

#### `student_subject_state.working_level`
- Current meaning:
  - estimated level from current diagnostic
- New meaning:
  - canonical per-subject demonstrated level
- Recommendation:
  - preserve, but expand the supported range to full Math/ELA coverage rather than the current narrow range

### Extend existing tables

#### `student_subject_state`
- Add:
  - `diagnostic_version text`
  - `prior_level_hint numeric(4,2) null`
  - `confidence_low numeric(4,2) null`
  - `confidence_high numeric(4,2) null`
  - `prerequisite_gaps jsonb not null default '[]'::jsonb`
  - `calibration_state jsonb not null default '{}'::jsonb`
  - `last_recalibrated_at timestamptz null`
  - `last_diagnostic_type text not null default 'cat_v2'`
- Preserve:
  - `strand_scores`
  - `weak_standard_codes`
  - `recommended_module_slugs`
- New semantics:
  - `weak_standard_codes` remains a compact summary
  - `prerequisite_gaps` becomes the structured remediation input for path generation

#### `student_assessment_attempts`
- Preserve table and resume behavior.
- Add or standardize metadata keys:
  - `subject`
  - `diagnostic_version`
  - `phase`
  - `prior_level_hint`
  - `posterior_level`
  - `confidence_low`
  - `confidence_high`
  - `termination_reason`
  - `item_route`

#### `student_assessment_responses`
- Recommendation:
  - add `metadata jsonb not null default '{}'::jsonb`
- Needed for CAT traceability:
  - served difficulty / level
  - strand / standard targets
  - phase served
  - adaptation reason

### New or revised content metadata

#### Diagnostic item metadata in `question_bank` or assessment-question joins
- Each CAT-eligible item needs metadata fields for:
  - `subject`
  - `content_level`
  - `strand`
  - `standard_codes`
  - `prerequisite_standard_codes`
  - `discrimination` or difficulty signal
  - `cat_eligible`
  - `diagnostic_tags`

#### Remediation graph
- Best-version recommendation:
  - add a prerequisite relationship source, either:
    - `skill_prerequisites`
    - or `module_prerequisite_metadata`
- Goal:
  - map a missed concept to the smallest useful remediation insertion
- If we do not create a new prerequisite table, we can use `standard_codes` plus sequence metadata for phase 1, but it will be weaker and harder to maintain.

### Breaking changes and compatibility risk
- Any code that assumes `gradeBand` is the canonical path selector becomes incorrect.
- Any code that treats `expected_level` as a target level rather than a soft prior becomes incorrect.
- Any reporting that equates student grade with subject path level becomes misleading.
- Existing placement analytics based on old grade-banded assessments will need version tags.

## Diagnostic Engine Logic

### Core design
- One CAT session per subject.
- One visible onboarding flow.
- The UI alternates between Math and ELA to keep the experience varied and less fatiguing.
- Each subject maintains independent state.

### Internal per-subject state
- `priorLevelHint`
- `currentEstimate`
- `confidenceLow`
- `confidenceHigh`
- `itemsSeen`
- `correctByStrand`
- `testedStandards`
- `candidatePrerequisiteGaps`
- `phase`

### Subject session pseudocode

```text
initializeSubject(subject, ageYears):
  priorLevelHint = deriveSoftPriorFromAge(ageYears)
  currentEstimate = priorLevelHint
  confidenceLow = minScale
  confidenceHigh = maxScale
  phase = WIDE_BRACKET
  itemsSeen = []
  candidatePrerequisiteGaps = {}

nextItem(subjectState):
  if phase == WIDE_BRACKET:
    choose item that maximizes bracket separation around currentEstimate
  if phase == NARROW:
    choose item near currentEstimate that reduces uncertainty fastest
  if phase == CONFIRM:
    choose item that either confirms boundary or tests prerequisite dependency

scoreResponse(subjectState, item, isCorrect):
  update currentEstimate
  update confidence interval
  update strand and standard evidence
  update gap candidates if dependent prerequisite patterns appear
  update phase

terminate(subjectState):
  stop if:
    itemsSeen >= 8 and confidence interval is narrow enough
    or itemsSeen >= 12
    or evidence is sufficient for stable working level + gap profile

finalizeSubject(subjectState):
  workingLevel = discrete level mapped from currentEstimate
  prerequisiteGaps = collapse candidate gap evidence into minimal actionable list
  confidence = summarized certainty for level placement
```

### Phase logic

#### Phase 1: Wide bracket (Q1-Q3)
- Start near age-derived hint, but not locked to it.
- First items should have high separation power.
- If the learner misses early items badly, step down aggressively.
- If the learner succeeds early, step up aggressively.
- Goal:
  - identify broad performance band, not precision

#### Phase 2: Narrow estimate (Q4-Q8)
- Serve items around the emerging estimate.
- Prioritize high-information items near the current estimate.
- Build confidence interval and strand evidence.
- Goal:
  - identify likely working level
  - determine whether the estimate is stable enough to stop early

#### Phase 3: Confirm and probe gaps (Q8-Q12)
- Confirm the likely working level boundary.
- Probe prerequisite structures immediately below or inside the estimated level.
- Example:
  - overall math looks like level 4
  - serve one or two targeted fractions / multiplication dependency items to check whether the learner needs insertion-level remediation
- Goal:
  - finish with:
    - stable working level
    - small set of actionable gap insertions

### Student-facing behavior
- Show only:
  - neutral progress indicator
  - calm copy
  - "Find My Level" framing
- Never show:
  - score
  - difficulty changes
  - level labels
  - "harder" / "easier" language

## Path Generation Logic

### Inputs
- `workingLevel`
- `confidenceLow` / `confidenceHigh`
- `prerequisiteGaps`
- `recent subject evidence`
- `subject`

### Core path rules
- For each subject:
  - choose a core sequence aligned to `workingLevel`
  - insert remediation nodes only where a prerequisite dependency exists
  - keep future sequence at the demonstrated level unless evidence says otherwise

### Path node types
- `core`
  - demonstrated-level path content
- `remediation`
  - targeted prerequisite repair for identified gaps
- `checkpoint`
  - early calibration node used to verify the placement
- `stretch`
  - later optional node if the learner rapidly outperforms the current path

### Remediation insertion rules
- A detected gap does not reset the entire subject path.
- For each gap:
  - find dependent future modules
  - insert the minimum prerequisite remediation before the first dependent module
- Collapse overlapping gaps into one remediation bundle if they share the same prerequisite family.

### Example
- Math working level = 4
- Gaps = grade 3 fractions, multiplication fluency
- Path might become:
  - level 4 core module
  - fractions remediation node
  - level 4 core module dependent on fractions
  - multiplication fluency remediation checkpoint
  - level 4 core module
- Not:
  - full reset to grade 3 math

### How this maps to current code
- Preserve `student_paths` and path entries.
- Preserve per-subject active path semantics.
- Replace grade-band-first sequence selection with subject-state-first sequence selection.
- Continue using `learning_sequences`, but allow:
  - level-based routing independent of declared grade
  - insertion of remediation nodes from prerequisite graph outputs

## Continuous Adaptation Loop

### Goal
Make the diagnostic the beginning of adaptation, not the end.

### Signals
- lesson completion accuracy
- practice accuracy
- retry patterns
- time on task
- repeated misses by standard or strand
- demonstrated ease on current-level content

### Continuous update logic
- Each new subject event updates:
  - current estimate
  - confidence
  - standard mastery evidence
  - gap confidence
- Recalibration rules:
  - repeated strong performance -> shift upcoming nodes upward
  - repeated weak performance across broad standards -> shift upcoming nodes downward
  - repeated weak performance in narrow dependency cluster -> insert remediation only

### Silent correction window
- The first 3-5 subject-specific nodes after the diagnostic are special calibration nodes.
- If those nodes disagree strongly with the diagnostic placement:
  - revise path silently
  - do not require a new onboarding diagnostic

### Parent/ops visibility
- Not required for first release, but recommended:
  - internal event logging for:
    - `subject_level_adjusted`
    - `gap_inserted`
    - `diagnostic_recalibrated`
  - optional parent-facing explanation later:
    - "path updated based on recent progress"

### Content Coverage Hole Behavior
- The CAT engine must not fail silently when no eligible item exists at the desired subject + target level.
- Selection fallback rules:
  - first try exact subject + exact target level
  - if none exist, try nearest available level in the same subject, preferring the nearer easier level before the harder level
  - do not skip more than one adjacent level without flagging the session as low-confidence
- Session behavior when fallback is used:
  - record `coverage_fallback_used = true`
  - widen the confidence interval
  - emit an internal alert/event such as `cat_content_gap_detected`
  - mark the affected subject session as `low_confidence` if fallback occurs repeatedly or in the foundational zone
- Product rule:
  - fallback is protective instrumentation, not a substitute for content readiness
  - if foundational Math/ELA coverage is insufficient, Phase 3 is blocked until the gap is resolved
  - the engine must not pretend exact-level placement occurred when content availability forced approximation

## Migration Plan

### Phase 0: Freeze semantics and instrumentation
1. Define `CAT v2` as a versioned placement engine.
2. Add version tagging to all new diagnostic attempts and subject state updates.
3. Keep existing placement engine available behind a flag during migration.

### Phase 1: Data model preparation
1. Add new columns to `student_subject_state` for:
   - confidence interval
   - structured prerequisite gaps
   - calibration state
   - versioning
2. Add `metadata jsonb` to `student_assessment_responses`.
3. Preserve `grade_level` but remove its use from placement logic.
4. Standardize diagnostic metadata contracts in attempts and responses.

### Phase 2: Content and item readiness
1. Tag CAT-eligible Math and ELA items with:
   - subject
   - content level
   - strand
   - standards
   - prerequisite metadata
2. Build or backfill prerequisite relationships for Math and ELA.
3. Audit low-floor coverage:
   - especially K-2 / foundational math and early ELA
4. Identify unsupported zones before rollout.
5. Treat insufficient foundational Math/ELA coverage as a hard blocker for Phase 3.
6. Current status note:
   - the low-end diagnostic ladder and Kindergarten standards alignment have been repaired in live data
   - a separate Kindergarten practice-tag gap remains, but it should not block grades 3-8 Phase 3 work

### Phase 3: CAT engine
1. Replace grade-banded assessment selection with subject-specific adaptive item routing.
2. Keep the existing attempt/response persistence model.
3. Introduce phase-aware item selection:
   - wide bracket
   - narrow
   - confirm + gap probe
4. Produce:
   - `workingLevel`
   - confidence interval
   - prerequisite gaps

### Phase 4: Onboarding v2
1. Update student onboarding copy to "Find My Level."
2. Make grade optional in UI and data entry.
3. Continue collecting age, but relabel it as a personalization input rather than a placement input.
4. Preserve interleaving of Math and ELA sessions.
5. Hide all adaptation mechanics from the learner.

### Phase 5: Path builder v2
1. Replace `gradeBand`-driven path generation with `workingLevel` + `prerequisiteGaps`.
2. Continue storing subject paths independently.
3. Introduce remediation insertion node generation.
4. Keep core path continuity rather than resetting full level.

### Phase 6: Continuous recalibration
1. Feed lesson/practice outcomes into subject-state updates.
2. Add silent early-path correction rules.
3. Replan only upcoming subject nodes, not completed history.
4. Log recalibration events for review and future admin tooling.

### Phase 7: Migration and coexistence
1. Existing students keep their current subject states.
2. New engine applies only to:
   - new students
   - or students explicitly restarted into `CAT v2`
3. Add a one-time manual restart path for trusted parent/admin use.
4. Keep old and new diagnostic records distinguishable by version.

### Phase 8: Validation
1. Add fixture-based CAT evaluation for:
   - behind-in-math / advanced-in-ELA students
   - high mismatch learners
   - low-confidence cases
2. Add path-generation tests for:
   - no-gap steady placement
   - higher-level with surgical lower-level gap
   - silent post-diagnostic correction
3. Review live telemetry before making `CAT v2` the only path.

## Preserved vs Replaced

### Preserve
- per-subject state model
- separate Math and ELA sessions
- attempt/response persistence
- onboarding interleaving
- path storage model
- existing subject-path rendering patterns

### Replace or substantially rewrite
- grade-banded assessment selection
- `expectedLevel` as target anchor
- narrow working-level clamp
- path generation that assumes nominal grade is the main routing key
- remediation as broad level movement instead of precise insertion

## Breaking Changes
- Path generation functions that accept `gradeBand` as the primary selector need to be refactored.
- Any code that assumes one student grade implies one subject level becomes semantically wrong.
- Existing admin / parent explanations that describe placement as grade-aligned will become inaccurate.
- Existing tests that assert grade-band-selected assessments will need to be replaced with CAT-routing tests.

## Open Questions / Decisions Needed Before Implementation

1. Should parents be allowed to enter a subject-specific hint such as:
   - "Reading is stronger"
   - "Math needs support"
   This would not determine placement, but could improve initial probe ordering.
2. Should parents see the resulting subject starting points after onboarding, or should that remain internal in v1 of this migration?
3. Should there be a manual "restart Find My Level" control for parent/admin, or only for admin at first?
4. Should Science and Social Studies remain on legacy path generation until Math and ELA stabilize, or should we also prepare the data model for later subject expansion now?
5. Do we want remediation insertion to be:
   - single-node minimal
   - or bundled as short remediation clusters
   Recommendation: bundled only when dependency evidence overlaps.

## Locked Decisions

1. Grade is optional, reporting-only, and visually de-emphasized during onboarding.
2. K-2 / foundational Math coverage must be audited in Phase 2 before Phase 3 begins.
3. Phase 3 is blocked if foundational low-end coverage is insufficient.
4. The current Kindergarten practice-tag gap is follow-up backlog, not a grades 3-8 Phase 3 blocker.
5. Existing students are not auto-migrated into CAT v2.
6. New students get the new engine only once Phase 3 is complete.
7. Existing students require explicit restart / opt-in.
8. Maintain both a continuous internal estimate and a discrete mapped working level.
9. Early stop is allowed after 8 questions only when the confidence interval is sufficiently narrow.

## Recommended Decisions
- Keep grade optional and non-blocking.
- Use age as tone/safety + soft prior only.
- Implement Math and ELA only in this migration.
- Support true low-floor Math and ELA from the start if content coverage allows.
- Keep both continuous estimate and discrete working level.
- Make CAT v2 opt-in for new students first, with explicit restart for existing students.
- Keep parent-facing subject-level details minimal in the first release; prioritize correctness first.
