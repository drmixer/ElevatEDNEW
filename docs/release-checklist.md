## Release Checklist (Phase 15)

### Automated coverage + artifacts
- Trigger the "Coverage Audits" workflow (or run `npm run audit:completeness`, `npm run audit:coverage-rollup`, `npm run audit:coverage-gaps`, `npm run audit:practice` locally with production Supabase secrets). Save the `coverage-reports` artifact on the release ticket so trends are traceable run over run.
- If any audit fails, fix content/metadata and rerun until clean; do not override failures in CI.

### Hard launch gates
- Coverage quality: `npm run audit:coverage-rollup` shows ≥80% of Grades 3–8 Math/ELA cells fully covered; capture the per-grade/subject fully covered counts and percent. A grade/subject below 80% blocks the launch.
- Diagnostics present: confirm diagnostic assessments exist for every Grade 3–8 Math/ELA grade (Supabase `assessments` with `metadata.purpose = diagnostic` or `data/assessments/diagnostics_phase13.json`). Missing a diagnostic is a blocker.
- Priority explanations: `npm run audit:coverage-gaps` must show zero "no public lesson" rows for priority matrix or `coverage_anchor` entries (see `data/curriculum/coverage_matrix_phase1.csv` and `data/curriculum/learning_paths_phase13.json`). Any missing explanation blocks the release.

### Human + AI QA sampling
- Inspect at least one fully covered module per subject, one diagnostic per grade with its resulting learning paths, and one project unit per subject. Log findings and fixes.
- Ask Max High to audit assessments: `Critique this diagnostic for bias/coverage/level.` and `Spot weak questions or misaligned rubrics in this quiz.` Keep final decisions human-owned.

### Sign-off
- Link the Coverage Audits artifact, QA notes, and gate results to the release PR/ticket. Capture who approved each gate (content, QA, pedagogy).
