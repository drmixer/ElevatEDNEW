# Import Pipelines (Phase 4)

Goal: stand up import paths for anchor OER curricula, starting with Math 3-8 (Illustrative Mathematics via Open Up Resources), then layering in OpenStax and other link-only supplements. This doc covers what to do and which scripts/templates to use.

## Pre-flight
- Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are exported.
- Seed `content_sources` for: `Open Up Resources`, `OpenStax`, `EngageNY/Eureka`, `Khan Academy`, `CK-12`, `PhET`, `OpenSciEd`. (Name must match exactly for the importers.)
- Run standards import if not already done: `pnpm tsx scripts/import_standards.ts data/standards/ccss_math_3-8.csv data/standards/ccss_ela_3-8.csv data/standards/ngss_6-8.csv`.
- Optional: update module-to-standard mappings via `pnpm tsx scripts/import_module_standards.ts`.

## Math 3-8 (Open Up / IM) - Anchor Flow
1) **Source capture (link-only to start):**
   - Download or bookmark the teacher/student materials from `https://im.openupresources.org/6/index.html`, `.../7/index.html`, `.../8/index.html` (and 3-5 analogs).
   - For the first pass, treat PDFs/HTML as **link-only**; store URLs and metadata, not full text. This keeps ingestion light while we refine parsing.

2) **Normalize to import shape:**
   - Use the template `data/oer/im_openup_math_sample.json` as the schema (subject -> topics -> lessons). Each lesson should carry `license`, `source_url`, and `attribution`.
   - Keep lesson `content` minimal HTML/Markdown (for example, lesson objective plus link list). Do not paste full curricula until we have a parser that strips navigation cruft and confirms licensing.

3) **Import:**
   - Run: `pnpm tsx tools/importers/oer/index.ts --path ./data/oer --subject Mathematics --source "Open Up Resources / IM"`.
   - This writes into `subjects`, `topics`, and `lessons` with license/provenance preserved. It is source-agnostic and safe for CC BY.

4) **Enrich with standards and assets:**
   - Attach standards at the module/unit level when those modules exist via `pnpm tsx scripts/import_module_standards.ts`.
   - For OpenStax extensions (bridge topics), prepare `mappings/openstax.json` and run `pnpm tsx scripts/import_openstax.ts`.

5) **QA:**
   - `pnpm tsx scripts/audit_licenses.ts` to flag NC/ND or missing license fields.
   - `pnpm tsx scripts/audit_completeness.ts` to catch missing grade/subject/standards metadata.
   - Spot-check a couple of imported lessons per grade: titles, URLs resolve, attribution present.

## ELA 3-8 (EL Education + PD texts) - Next
- Ingest EL Education units as link-only lessons initially using the same OER importer shape.
- Embed public-domain texts by adding a `content` HTML section plus a source badge; ensure `license` is `Public Domain`.
- Maintain `storage_mode` in metadata (`link`, `embed`, `stored`) to follow the Phase 2 license rules.

## Science 6-8 (OpenSciEd + PhET/NASA) - Next
- Convert OpenSciEd unit lesson pages into normalized JSON; set license to `CC BY 4.0` and include source URLs.
- PhET simulations should be added as `media` or `assets` with `storage_mode = "embed"` and attribution.
- NASA media: treat as enrichment assets with `Public Domain` and include source links.

## Standards Alignment (manual check)
- Use `mappings/module_standards.json` for unit-level alignments; extend for new modules as they are created.
- For lesson-level alignment, store `{framework, code}` arrays in lesson metadata until a dedicated `lesson_standards` table is added.

## Edge cases and reminders
- Do not import NC/ND items; mark them link-only.
- Keep `attribution` strings intact. If missing, add a manual attribution referencing the provider and license.
- Re-run imports with `--dryRun` first when testing new datasets.
