# Plan 1 – Phase 1 (Scope, Standards, Coverage)

- Launch scope: Grades 3–8 Math and ELA; Grades 6–8 Science. Social Studies is deferred to a later phase so we can ship Math/ELA quickly and lock NGSS-aligned Science before widening scope.
- Standards sets:
  - Math: Common Core State Standards for Mathematics (CCSS-M, 2010) for grades 3–8. Stored in `data/standards/ccss_math_3-8.csv`.
  - ELA: Common Core State Standards for English Language Arts (CCSS-ELA, 2010) for grades 3–8. Stored in `data/standards/ccss_ela_3-8.csv`.
  - Science: Next Generation Science Standards (NGSS, middle school band) with recommended grade placement 6–8. Stored in `data/standards/ngss_6-8.csv`.
- Rationale:
  - CCSS provides the broadest interoperability for Math/ELA. We can later add state-specific variants as mappings.
  - NGSS is the widely adopted base for middle-school Science; we can layer in state tweaks later.
  - Social Studies is excluded from v1 ingestion to protect timeline and avoid licensing variance across states.
- Coverage matrix:
  - File: `data/curriculum/coverage_matrix_phase1.csv`.
  - Rows: (grade, subject, standard_code/topic). Columns: priority for core explanations, practice goal (e.g., ≥20 items), assessment goal, enrichment priority, notes.
  - Current rows seed high-priority skills for launch (fractions and proportional reasoning in Math; evidence-based reading/writing in ELA; foundational NGSS MS performance expectations).
- How to use:
  - Import pipelines should map each unit/lesson to the codes in the standards CSVs.
  - Product should show attribution using the `standard_set` and `code` fields.
  - As we fill items, update the coverage matrix and add `last_verified_at` dates once QA is done.
- Next (Phase 2 preview): confirm OER license posture for chosen anchor curricula (e.g., EngageNY/Eureka, Open Up Resources), decide importable vs link-only, and draft the one-page Content License Policy.
