# Find My Level Phase 2 Content Coverage Report

Generated from the live audit in [scripts/audit_cat_content_coverage.ts](/Users/drmixer/code/ElevatEDNEW/scripts/audit_cat_content_coverage.ts) and the artifact at [data/audits/cat_content_coverage_audit.json](/Users/drmixer/code/ElevatEDNEW/data/audits/cat_content_coverage_audit.json).

## Phase 2.5 Update
- Phase 2.5 diagnostic ladder remediation is complete in code and has been reseeded into the live DB.
- Kindergarten `module_standards` alignment has also been repaired in the live DB.
- Foundational diagnostic metadata is no longer flattened to the old grade-3 floor.
- Live Math and ELA diagnostics now expose placement levels `0, 1, 2, 3, 4, 5, 6, 7, 8`.
- Live foundational assessment metadata now maps as:
  - `K -> level 0, window 0-1`
  - `1 -> level 1, window 0-2`
  - `2 -> level 2, window 1-3`
  - `3 -> level 3, window 2-4`
- Live foundational Math/ELA question metadata now includes a usable low-end difficulty ladder:
  - K Math: 12 questions, difficulty mix `1:6, 2:3, 3:3`
  - K ELA: 12 questions, difficulty mix `1:6, 2:3, 3:3`
  - Grade 1 Math: 15 questions, difficulty mix `1:6, 2:5, 3:4`
  - Grade 1 ELA: 15 questions, difficulty mix `1:7, 2:4, 3:4`
  - Grade 2 Math: 13 questions, difficulty mix `1:6, 2:4, 3:3`
  - Grade 2 ELA: 13 questions, difficulty mix `1:6, 2:4, 3:3`
- The original Phase 2 blockers are now cleared:
  1. foundational diagnostic metadata now uses distinct K/1/2 levels
  2. foundational diagnostic difficulty now exposes a usable low-end ladder
  3. Kindergarten `module_standards` now point to actual Kindergarten standards
- A new follow-up issue is now visible in the coverage rollup:
  1. once K standards were corrected, Kindergarten Math and ELA modules began surfacing as missing practice coverage against their true K standards

## Status
- Phase 2 is complete.
- Phase 3 diagnostic/standards prerequisites are complete.
- Kindergarten practice-tag coverage needs follow-up.

## Scope Note
- If current product focus is grades 3-8, the Kindergarten practice gap should be treated as follow-up backlog rather than a Phase 3 blocker.
- The grades 3-8 Phase 3 gate is open.

## Executive Summary
The good news is that foundational Math and ELA content exists in the live platform. K-2 modules, lessons, practice, assessments, and external-resource coverage all show as complete in the current coverage rollups. New CAT v2 pathing is not blocked by missing low-end lesson content.

The blocker is the diagnostic and standards-alignment layer. Foundational diagnostic items exist, but the current pipeline still flattens Kindergarten, Grade 1, Grade 2, and Grade 3 into the same placement level (`3`). On top of that, Kindergarten module standards are misaligned in the live database: all sampled K Math and K ELA modules are attached to high-school standards instead of Kindergarten standards. That makes low-end CAT routing and prerequisite-gap insertion unsafe.

## Key Findings

### 1. Foundational diagnostics exist, but they are not CAT-ready
Live Math diagnostics:
- 9 diagnostics
- 139 linked question items
- placement levels present in metadata: `3, 4, 5, 6, 7, 8`

Live ELA diagnostics:
- 9 diagnostics
- 137 linked question items
- placement levels present in metadata: `3, 4, 5, 6, 7, 8`

Foundational low-end detail:
- K Math: 10 questions, all at placement level `3`, all difficulty `1`
- Grade 1 Math: 10 questions, all at placement level `3`, all difficulty `1`
- Grade 2 Math: 13 questions, all at placement level `3`, all difficulty `1`
- Grade 3 Math: 13 questions, all at placement level `3`
- K ELA: 12 questions, all at placement level `3`, all difficulty `1`
- Grade 1 ELA: 14 questions, all at placement level `3`, all difficulty `1`
- Grade 2 ELA: 13 questions, all at placement level `3`, all difficulty `1`
- Grade 3 ELA: 13 questions, all at placement level `3`

Implication:
- there is no diagnostic metadata below level `3`
- K/1/2 cannot be distinguished by level metadata
- K/1/2 also do not have an internal difficulty ladder

This directly blocks the Phase 3 CAT requirement that the engine be able to step down below the current grade-3 floor and probe narrower low-end bands.

### 2. The current seeding pipeline is the reason the low end is flattened
Current normalization still clamps the placement ladder to grades `3` through `8` in [scripts/utils/placementMetadata.ts](/Users/drmixer/code/ElevatEDNEW/scripts/utils/placementMetadata.ts#L1):
- `K` and `K-2` normalize to `3`
- numeric levels are clamped to `3..8`
- placement windows are clamped to `3..8`

Diagnostic seeding then writes those normalized values directly into assessment metadata in [scripts/seed_diagnostic_assessments.ts](/Users/drmixer/code/ElevatEDNEW/scripts/seed_diagnostic_assessments.ts#L171).

Current normalization snapshot from the audit:
- `K -> level 3, window 3-4`
- `1 -> level 3, window 3-4`
- `2 -> level 3, window 3-4`

### 3. Foundational path content is present
Coverage rollups for K-2 are healthy:
- K Math: 13 modules, 0 needing attention
- K ELA: 7 modules, 0 needing attention
- Grade 1 Math: 13 modules, 0 needing attention
- Grade 1 ELA: 7 modules, 0 needing attention
- Grade 2 Math: 13 modules, 0 needing attention
- Grade 2 ELA: 7 modules, 0 needing attention

Implication:
- the path/remediation layer appears to have enough low-end content to support real placement
- we do **not** need to block Phase 3 because of missing K-2 lesson inventory

### 4. Kindergarten standards alignment is broken
Module-standards audit results:
- `K:Mathematics` has `13/13` mismatches
- `K:English Language Arts` has `7/7` mismatches
- Grades 1 and 2 have `0` mismatches in both subjects

Examples from the live DB:
- `k-mathematics-number-and-operations-counting-and-cardinality` is linked to `HSF-IF.4`
- `k-english-language-arts-reading-informational-simple-nonfiction-animals-places` is linked to `RI.9-10.2`
- `k-english-language-arts-speaking-and-listening-show-and-tell-retelling` is linked to `SL.11-12.1`

Implication:
- even if low-end diagnostics were remapped, Kindergarten prerequisite-gap insertion would still be unreliable
- CAT v2 should not start using K-grade standards for surgical remediation until this is repaired

## Recommendation
Phase 2.5 is complete.

The original no-go criteria from this report have been resolved in live data.

The next checkpoint is not low-end laddering or K standards alignment. It is Kindergarten practice alignment:
1. verify whether K practice items exist but are tagged to old high-school standards
2. retag or reseed K practice so the corrected K module standards still meet the practice baseline
3. rerun coverage rollups after the practice layer is repaired

## Required Work Before Phase 3

### Completed in Phase 2.5
1. Expanded the placement ladder below `3` in [scripts/utils/placementMetadata.ts](/Users/drmixer/code/ElevatEDNEW/scripts/utils/placementMetadata.ts).
2. Reseeded K/1/2 diagnostic assessments so item metadata and assessment metadata use distinct foundational levels instead of flattening to `3`.
3. Introduced a usable low-end difficulty ladder for K/1/2 diagnostic items instead of a single difficulty bucket.

### Follow-up After Phase 3 Gate
1. Repair Kindergarten practice alignment so corrected K standards still resolve to usable module-level practice coverage.

### Can wait until after the above
1. CAT v2 item-selection engine
2. CAT v2 onboarding UI changes
3. continuous post-diagnostic recalibration logic

## Go / No-Go
- Phase 0: done
- Phase 1: done
- Phase 2: done
- Phase 3 diagnostic/standards gate: **go**, especially for grades 3-8 work
- Kindergarten practice coverage gate: **follow-up required**
