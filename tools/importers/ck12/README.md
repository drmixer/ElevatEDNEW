# CK-12 Curriculum Importer

This importer normalizes CK-12 JSON exports into ElevatED's Supabase schema.

## Prerequisites
- Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available in your shell.
- Place one or more CK-12 payloads in `data/ck12/*.json`. Each file should follow the shape documented below.
- Install dependencies (the repo uses pnpm): `pnpm install`.

## Running
```bash
pnpm tsx tools/importers/ck12/index.ts --path ./data/ck12
```

### Flags
- `--path <dir>`: Directory containing CK-12 JSON (default `./data/ck12`).
- `--subject "<name>"`: Import only matching subject name.
- `--limit <n>`: Limit total topics processed across all files.
- `--dryRun`: Parse and diff without writing to Supabase.
- `--triggeredBy <uuid>`: Optional `auth.users.id` for audit trail.

Metrics and any issues are logged at the end of the run. Dry runs skip database writes but still validate payloads.

## CK-12 JSON Shape (per file)
```json
{
  "subject": {
    "name": "Math",
    "description": "Numeracy foundations",
    "license": "CC BY-NC",
    "source_url": "https://www.ck12.org",
    "attribution": "CK-12 Foundation (ck12.org)"
  },
  "topics": [
    {
      "external_id": "ck12:math:fractions",
      "name": "Fractions",
      "slug": "fractions",
      "description": "",
      "prerequisites": ["ck12:math:division-basics"],
      "difficulty_level": 2,
      "lessons": [
        {
          "external_id": "ck12:lesson:frac-intro-001",
          "title": "Introduction to Fractions",
          "slug": "intro-to-fractions",
          "content": "<p>Lesson HTML...</p>",
          "estimated_duration_minutes": 12,
          "media": [
            { "type": "video", "url": "https://cdn.example/fractions-vid" }
          ],
          "metadata": { "grade_range": "3-4" },
          "license": "CC BY-NC",
          "source_url": "https://www.ck12.org/lesson/fractions"
        }
      ]
    }
  ]
}
```

## License & Attribution Guidance
- CK-12 resources are typically released under **CC BY-NC**; verify each payload and store the license string.
- Always preserve the provided attribution text or default to `CK-12 Foundation (ck12.org)`.
- Imported subjects, topics, and lessons persist `license`, `source`, `source_url`, and `attribution` to honour downstream usage requirements.
- Do **not** surface NC-licensed CK-12 material in paid experiences unless you have explicit permission.
