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
- `/admin/import` – upload JSON mapping files and trigger the importers via API. Validation errors bubble up from the license guard.

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
