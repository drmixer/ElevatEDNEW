# Find My Level Phase 3 Rollout Checklist

Scope: grades 3-8, Math and ELA, CAT v2.

## 1. Database Gate

Required migration:

`supabase/migrations/050_cat_v2_phase0_phase1.sql`

Why it matters:

- Adds `student_assessment_responses.metadata`
- Adds CAT-facing `student_subject_state` columns used by rollout review and diagnostics
- Removes the need to rely on runtime compatibility shims for older schemas

Remote apply command:

```bash
supabase migration up --linked
```

Current blocker from local attempt on April 7, 2026:

- `supabase migration up` targets the local database by default
- `supabase migration up --linked` failed with `403`
- `supabase migration list` also failed with `403`
- CLI also requested `SUPABASE_DB_PASSWORD`
- Linked project ref in this repo: `ciyidohmnkwwwpvfhbjj`

Exit criteria:

- Migration `050_cat_v2_phase0_phase1.sql` is present in the remote migration history
- A fresh CAT attempt writes `student_assessment_responses.metadata`
- `student_subject_state` rows contain `diagnostic_version`, `confidence_low`, `confidence_high`, `prerequisite_gaps`, and `last_diagnostic_type`

## 2. Engine Gate

Confirm platform config:

- `placement.engine_active = cat_v2`

Current intended scope:

- Only Math and ELA
- Only grades 3-8
- K practice follow-up remains out of scope for this rollout

Exit criteria:

- Non-eligible grades/subjects still resolve to legacy placement
- Eligible grades/subjects resolve to `cat_v2`

## 3. Controlled Rollout

Start with a constrained internal or staging cohort.

Recommended checks for the first 10 completed CAT attempts:

- `working_level` is plausible for the learner grade
- `confidence_low` and `confidence_high` are populated
- `prerequisite_gaps` are present only when lower-level misses justify them
- `student_path_entries` contains a `review` entry when remediation is expected
- When a canonical sequence dependency exists, that `review` entry appears immediately before the anchored downstream lesson

Suggested pass/fail thresholds before broader rollout:

- `cat_content_gap_detected` remains low and explainable
- `cat_low_confidence` is rare and manually explainable
- No obvious cases where `working_level` is one full grade too high or too low after manual review

## 4. Admin Review Surface

Use the Admin dashboard CAT rollout review panel to inspect:

- Recent CAT attempts
- Expected vs. working level
- Confidence band
- Prerequisite gap codes
- Whether a remediation review was inserted
- The adjacent lesson anchor around that review

Recommended spot-check pattern:

1. Open a recent CAT attempt.
2. Verify `expected -> working` looks plausible.
3. Verify gap standards match missed prerequisite evidence.
4. Verify the review module sits directly before the downstream anchored lesson when an anchor exists.

## 5. Rollback

Immediate rollback lever:

```text
placement.engine_active = legacy_v1
```

Use rollback if:

- CAT attempt outputs are clearly unstable
- Confidence bands are frequently low without a content explanation
- Review insertion is missing or mis-anchored in live paths
- CAT content fallback events spike unexpectedly

## 6. Verification Commands

Local regression:

```bash
npx eslint server/learningPaths.ts server/api.ts server/adminPlacement.ts src/services/adminService.ts src/components/Admin/AdminDashboard.tsx
npm test -- --run server/__tests__/learningPaths.test.ts server/__tests__/learningPaths.db.test.ts server/__tests__/adminPlacement.test.ts
```

Live DB integration:

```bash
RUN_DB_INTEGRATION_TESTS=true npm test -- --run server/__tests__/learningPaths.db.test.ts
```
