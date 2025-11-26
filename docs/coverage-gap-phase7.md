# Phase 7 – Coverage Gaps & Dashboards

Goal: make coverage gaps visible for Grades 3–8 core subjects, then fill them systematically with explanations, practice, assessments, and external links.

## Baseline and counting rules
- Scope: Grades 3–8 for Mathematics, English Language Arts, Science, Social Studies.
- Baseline per module/standard cell: ≥1 public lesson/explanation, ≥20 practice items, ≥1 unit/baseline assessment, ≥1 external/linkable resource.
- Explanations: `lessons.visibility = 'public'` linked to the module.
- Practice items: `question_bank` rows tagged with `metadata.module_slug`/`module_id`, or standard-aligned via `metadata.standards` or `question_skills → skills.standard_code`.
- Assessments: `assessments` with `module_id` (or `metadata.module_slug`) and `metadata.assessment_type/purpose` in `{unit_assessment, unit, baseline, summative}` (or adaptive).
- External resources: `assets` for the module (or its lessons) where `metadata.storage_mode` is `link` or `embed`.

## New dashboards (Supabase)
- `public.coverage_dashboard_cells`: one row per module (+per standard when present) with counts for lessons, practice, assessments, and external resources plus baseline booleans. Columns include `grade_band`, `subject`, `module_slug`, `standard_framework/code`, `practice_items_aligned`, `has_assessment`, `meets_*_baseline`, `last_touched_at`.
- `public.coverage_dashboard_rollup`: grade/subject aggregates showing how many modules meet each baseline and how many need attention.
- Both views are granted to `authenticated` and `service_role`; use a service key for full visibility.

## CLI gap report
- Command: `pnpm tsx scripts/report_coverage_gaps.ts`
  - Prints grade/subject rollups, then a prioritized list of cells missing baselines with counts (lessons, practice, assessments, external).
  - Uses `coverage_dashboard_cells` and honors the ≥20 practice baseline (or the view’s `practice_target` if changed).

## Weekly workflow
- Run the CLI report, skim the rollup, and pick the worst offenders (multiple gaps first, then big practice deltas).
- Fix order of operations:
  1) Add/ publish a core lesson; ensure `visibility = 'public'` and attribution block is present.
  2) Add practice to hit ≥20: import/link question sets or use authored generation with `metadata.module_slug` + `metadata.standards`.
  3) Attach a unit/baseline assessment (`metadata.assessment_type = 'unit_assessment'` or `purpose = 'baseline'`).
  4) Add ≥1 external/enrichment link (`assets.metadata.storage_mode = 'link'|'embed'`).
- Re-run the report to confirm the cell clears all baselines; update `data/curriculum/coverage_matrix_phase1.csv` notes if needed.

## Spot-checks
- Each week, sample a few “cleared” cells per subject/grade:
  - Verify standard alignment (module_standards vs. lesson metadata).
  - Confirm practice items are on-grade and age-appropriate.
  - Ensure assessments link back to the correct module and carry license/attribution.
  - Click external resources to confirm live links and safe content.
