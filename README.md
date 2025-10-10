ElevatED Platform
=================

Curriculum orchestration workspace for ElevatED with Supabase migrations, importer tooling, adaptive recommendations API, and a lightweight catalog UI.

Prerequisites
-------------

- Node.js 20+
- npm (ships with Node) or pnpm/yarn if preferred
- Supabase CLI (`npm install -g supabase`)
- Docker Desktop running (required for `supabase start`)
- Environment variables:
  - `SUPABASE_URL` (local or remote project)
  - `SUPABASE_SERVICE_ROLE_KEY`

Install Dependencies
--------------------

```bash
npm install
```

Database & Schema
-----------------

1. Start the local Supabase stack (requires Docker):

   ```bash
   supabase start
   ```

2. Apply migrations:

   ```bash
   npm run db:migrate
   ```

3. Seed curriculum modules from the provided skeleton (`data/curriculum/ElevatED_K12_Curriculum_Skeleton.json`):

   ```bash
   npm run seed:skeleton
   ```

Lesson Data
-----------

- `public.lessons` is the canonical store for classroom-ready lesson plans. Required fields are:
  - `module_id` – links the lesson to a curriculum module. Lesson detail pages only surface lessons with a populated `module_id`.
  - `title` – human-friendly heading used in catalog views.
  - `content` – Markdown body containing the structured lesson plan. The API renders this body to HTML for the UI.
  - `visibility` – enum (`draft`, `private`, `public`) that controls publication state.
  - `open_track` – boolean flag indicating if the lesson is approved for an open-track sequence.
  - `attribution_block` – Markdown snippet that aggregates attribution strings for the lesson’s supporting assets.
- Optional metadata:
  - `estimated_duration_minutes`, `media_url`, and `ai_hint_context` enrich time estimates and adaptive experiences.
  - `metadata` (JSONB) can store importer breadcrumbs and authoring notes.
  - `created_by` back-references a profile when lessons are authored through the app.
- Assets connect to lessons through `public.assets.lesson_id`. When assets are attached to a lesson, their aggregated attribution is stored on the lesson’s `attribution_block`.
- Open-track lessons are also surfaced at the module level; make sure to set both the module and lesson `open_track` flags when authoring.

Content Importers
-----------------

Sample mapping files live under `mappings/`. After seeding modules you can attach assets with:

```bash
# OpenStax CC BY links
npm run import:openstax

# Project Gutenberg public-domain texts
npm run import:gutenberg

# NASA / NOAA / NARA / LOC public-domain media
npm run import:federal
```

Each importer validates licenses via `assertLicenseAllowed`. If a mapping contains a disallowed license the command fails with a descriptive error.

For providers that publish bulk datasets you can normalize their raw exports with the provider CLI:

```bash
# Normalize raw dumps into the shared dataset format
npm run import:provider -- --provider c3teachers --input data/providers/c3_teachers_raw.json --output dist/imports/c3_teachers.dataset.json --pretty
```

Supported `--provider` values: `openstax`, `c3teachers`, `siyavula`, and `nasa_noaa`. The CLI emits JSON ready for the Admin import console.

Queued Import Workflow
----------------------

- `/api/import/runs` persists every job with `pending → running → success|error` status, metrics, and append-only logs.
- The Node API boots an in-process worker (`ImportQueue`) that claims pending runs, performs license QA (including optional URL health checks), and records warnings/errors back onto the run.
- Supabase Edge functions can reuse the same processor to run imports on a schedule or via webhooks.
- Set `SKIP_IMPORT_URL_CHECKS=true` to bypass external link checks when running in an offline environment.

Standards & Assessments Integration
-----------------------------------

- `npm run import:standards` – loads frameworks and codes from `data/standards/standards.json` (JSON or CSV supported via `--file`).
- `npm run import:module-standards` – attaches standards to modules using `mappings/module_standards.json` (module slug → standard codes).
- `npm run seed:module-assessments` – seeds baseline quizzes per module from `data/assessments/module_quizzes.json`, creating question bank items, sections, and assessment links.

Module detail pages now return aligned standards, baseline assessment summaries, and the `/api/modules/:id/assessment` endpoint exposes the full quiz structure for previewing in the UI.

QA Scripts
----------

```bash
# Detect unsupported licenses, missing attribution, or dead URLs (CSV to stdout)
npm run audit:licenses

# List modules lacking lessons or assets
npm run audit:completeness
```

Local Development
-----------------

The Vite dev server proxies API requests to the same service-role powered handlers used in production.

```bash
# Start Vite + API proxy on http://localhost:5173
npm run dev

# (Optional) run the standalone API server on http://localhost:8787
npm run api:dev
```

UI Highlights
-------------

- `/catalog` – grade, subject, strand, and topic filters with pagination.
- `/module/:id` – lesson list, linked assets with attribution, and adaptive recommendations based on the most recent assessment score.
- `/admin/import` – upload mapping or dataset files, queue provider runs, and monitor job logs / status without blocking the UI.

Adaptive Recommendations API
----------------------------

`GET /api/recommendations?moduleId=123&lastScore=85`

Returns up to three modules in the same subject/strand, automatically falling back to subject defaults if no close match exists. The API is available through both the Vite dev proxy and the standalone `api:dev` server.

Additional Tooling
------------------

- `npm run import:oer` – legacy OER importer (unchanged).
- Supabase helper functions and migrations live under `supabase/`.

Troubleshooting
---------------

- `supabase migration up` requires the Docker-based local stack; start it with `supabase start`.
- Import commands need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. For local development they are emitted by `supabase status --json`.
- The catalog and module pages read from the new `/api/modules` endpoints; verify the API server is running if you see 404s in the browser.
