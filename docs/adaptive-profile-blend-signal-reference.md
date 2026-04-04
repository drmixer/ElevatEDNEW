# Adaptive Profile Blend Signal Reference

Purpose: document the internal `profile_blend_signal` contract, the current trigger rules, and the operator expectations for adaptive blended path replanning.

Status:
- `Implemented locally`

Related docs:
- [adaptive-path-hardening-plan.md](/Users/drmixer/code/ElevatEDNEW/docs/adaptive-path-hardening-plan.md)
- [student-safe-adaptive-path-plan.md](/Users/drmixer/code/ElevatEDNEW/docs/student-safe-adaptive-path-plan.md)

## 1. Where the signal lives

The adaptive blend snapshot is stored in:
- `student_subject_state.metadata.profile_blend_signal`

It is:
- internal-only
- written during blended profile replans in [learningPaths.ts](/Users/drmixer/code/ElevatEDNEW/server/learningPaths.ts)
- intended for adult-facing explainability, debugging, and threshold tuning

It is not:
- a student-facing placement label
- a canonical long-term analytics table
- a guarantee that every subject replan produces a durable schema-level column

## 2. Current stored fields

Current fields written per subject:
- `recent_accuracy`: recent practice and quiz accuracy as a percent from `0` to `100`, or `null` if there are no recent scored events
- `mastery_pct`: normalized subject mastery percent from `0` to `100`, or `null` if mastery is unavailable
- `mastery_trend`: one of `support`, `steady`, or `stretch`
- `support_pressure`: internal support score from `0` to `1`
- `stretch_readiness`: internal stretch score from `0` to `1`
- `evidence_count`: count of recent scored signals included in `recent_accuracy`
- `lesson_signals`: count of recent `lesson_completed` events for the subject in the sampled window
- `weak_standards`: copied weak standards from the current `student_subject_state`
- `last_replanned_at`: ISO timestamp for the last blended profile replan
- `trigger_subject`: normalized subject that triggered the latest replan
- `trigger_event_type`: triggering event type such as `lesson_completed`, `practice_answered`, or `quiz_submitted`

## 3. Inputs and derivation

The signal is derived from:
- recent `student_events` rows for `practice_answered`, `quiz_submitted`, and `lesson_completed`
- current `student_subject_state`
- `student_mastery_by_subject`

Current event window:
- up to `60` recent adaptive event rows per learner for blended replanning
- up to `8` recent subject events used when building each adult-facing signal snapshot

Normalization rules:
- `practice_answered` contributes `1` for correct and `0` for incorrect
- `quiz_submitted.score` is normalized into a `0` to `1` ratio before conversion to percent-style display values
- `lesson_completed` counts as completion evidence but does not add a scored accuracy sample

## 4. Expected value ranges

### 4.1 `recent_accuracy`

Expected range:
- `null` when no recent scored practice or quiz events exist
- otherwise `0` to `100`

Interpretation:
- below `65` means recent evidence is strongly support-leaning
- `65` to `75` is mild support pressure
- `78` and above starts contributing to stretch readiness
- `85` and above is strong stretch evidence

### 4.2 `mastery_pct`

Expected range:
- `null` when subject mastery is unavailable
- otherwise `0` to `100`

Interpretation:
- below `65` adds strong support pressure
- `65` to `75` adds moderate support pressure
- `78` and above starts contributing to stretch readiness
- `85` and above is strong stretch evidence

### 4.3 `support_pressure`

Expected range:
- clamped to `0` to `1`

Interpretation:
- `0.00` to `0.39`: low support need
- `0.40` to `0.59`: watch zone
- `0.60` and above: subject is likely to receive extra priority in the blended queue
- `0.65` and above: current logic marks `mastery_trend` as `support`

Main contributors:
- expected-vs-working-level gap
- low mastery
- low recent accuracy
- repeated support-direction event signals
- presence of weak standards

### 4.4 `stretch_readiness`

Expected range:
- clamped to `0` to `1`

Interpretation:
- `0.00` to `0.39`: no special stretch signal
- `0.40` to `0.64`: improving or stable
- `0.65` and above: current logic marks `mastery_trend` as `stretch`
- `0.75` and above with low support pressure can reduce a core subject back to standard weight

Main contributors:
- mastery and recent accuracy above the target band
- recent stretch-direction event signals
- no expected-vs-working-level gap

### 4.5 `mastery_trend`

Possible values:
- `support`
- `steady`
- `stretch`

Resolution rules:
- `support` wins when `support_pressure >= 0.65`
- otherwise `stretch` wins when `stretch_readiness >= 0.65`
- otherwise the subject stays `steady`

## 5. Current replan trigger rules

### 5.1 Immediate trigger

The blended profile replans immediately on:
- `lesson_completed`

### 5.2 Stable practice/checkpoint trigger

The blended profile can also replan on:
- `practice_answered`
- `quiz_submitted`

But only when all of the following are true:
- the subject can be resolved
- the subject was not replanned within the debounce window
- there are `3` recent directional signals for that subject
- all `3` signals point the same way: `support` or `stretch`
- if standards are present, the signals share at least one standard

### 5.3 Debounce rule

Current debounce:
- `5` minutes per subject, based on `last_replanned_at`

Effect:
- lesson completion still replans immediately
- practice and checkpoint-only churn is suppressed during the debounce window

## 6. Current blend behavior

Current blended queue behavior:
- core subjects are `math` and `english`
- contextual subjects are `science` and `social_studies`
- support-heavy core subjects can receive weight `2`
- stretch-stable core subjects can return to weight `1`
- contextual subjects remain limited supporting entries rather than taking over the path

Operationally, this means:
- a support-heavy Math signal usually creates a `math, math, english` front of queue
- stronger subjects still stay in the queue
- science and social studies remain visible as contextual rotation

## 7. Telemetry and operator expectations

Every blended replan emits an internal ops event with:
- trigger label and trigger event type
- previous vs next subject-mix label
- time since previous replan
- primary support subject
- primary stretch subject
- support pressure and stretch readiness
- oscillation-risk flag when the primary core subject flips quickly

Operators should use this telemetry to answer:
- are replans happening too often
- which event types are driving replans
- whether support-heavy learners rebalance over time
- whether rapid subject flip-flopping is appearing

## 8. Safe tuning guidance

Before changing thresholds:
- inspect adaptive replan telemetry in the admin dashboard
- confirm the issue is persistent, not anecdotal
- review both trigger frequency and resulting subject-mix shifts

When changing logic:
- change one threshold family at a time
- keep student-facing routes unchanged
- prefer internal copy or operator telemetry changes before algorithmic changes when the issue is observability

Minimum validation after threshold edits:
- `npm run test:db:adaptive`
- `npm test -- --run server/__tests__/opsMetrics.test.ts`
- `npx tsc --noEmit`
- targeted `eslint` on touched files

## 9. Known limitations

Current limitations:
- the signal is metadata-backed rather than migration-backed
- only the latest snapshot is stored; there is no row-per-replan history table
- `lesson_completed` is intentionally stronger than practice-only evidence
- contextual subjects do not currently have the same adaptive weighting depth as core Math and English
- signal windows are event-count based, not time-window based

## 10. When to promote fields into columns

Keep the signal in metadata when:
- adult explainability is the main use case
- per-student writes should stay simple
- indexing and reporting needs are still light

Consider migration-backed columns or a dedicated history table when:
- operators need filterable reporting directly from SQL
- querying specific signal dimensions becomes frequent
- indexing `last_replanned_at`, `trigger_subject`, or oscillation risk becomes operationally important
