# OER Curriculum Importer

This importer normalizes open educational resource (OER) JSON exports into ElevatED's Supabase schema. It is source‑agnostic: any payload that matches the documented shape can be ingested (Khan Academy, district-created content, OpenStax, etc.).

## Prerequisites
- Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available in your shell.
- Place one or more normalized payloads in `data/oer/*.json`. Each file should follow the shape documented below.
- Install dependencies (the repo uses pnpm): `pnpm install`.

## Running
```bash
pnpm tsx tools/importers/oer/index.ts --path ./data/oer
```

### Flags
- `--path <dir>`: Directory containing JSON datasets (default `./data/oer`).
- `--subject "<name>"`: Import only matching subject name.
- `--limit <n>`: Limit total topics processed across all files.
- `--dryRun`: Parse and diff without writing to Supabase.
- `--triggeredBy <uuid>`: Optional `auth.users.id` for audit trail.
- `--source "<label>"`: Override the `source` value stored on imported subjects/topics/lessons (defaults to the dataset's `subject.source` or `OER`).

Metrics and any issues are logged at the end of the run. Dry runs skip database writes but still validate payloads.

## Expected JSON Shape (per file)
```json
{
  "subject": {
    "name": "Math",
    "description": "Numeracy foundations",
    "license": "CC BY",
    "source": "Open Numeracy Initiative",
    "source_url": "https://example.org/open-numeracy",
    "attribution": "Open Numeracy Initiative"
  },
  "topics": [
    {
      "external_id": "oni:math:fractions",
      "name": "Fractions",
      "slug": "fractions",
      "description": "",
      "prerequisites": ["oni:math:division-basics"],
      "difficulty_level": 2,
      "lessons": [
        {
          "external_id": "oni:lesson:frac-intro-001",
          "title": "Introduction to Fractions",
          "slug": "intro-to-fractions",
          "content": "<p>Lesson HTML...</p>",
          "estimated_duration_minutes": 12,
          "media": [
            { "type": "video", "url": "https://cdn.example/fractions-vid" }
          ],
          "metadata": { "grade_range": "3-4" },
          "license": "CC BY",
          "source_url": "https://example.org/open-numeracy/fractions/intro"
        }
      ]
    }
  ]
}
```

## License & Attribution Guidance
- Always preserve the license, attribution, and source details supplied by the provider. If the dataset omits them, fall back to the `--source` label and supply attribution text manually.
- Imported subjects, topics, and lessons persist `license`, `source`, `source_url`, and `attribution` to honour downstream usage requirements.
- Verify that the terms of use for each dataset are compatible with your intended experience (e.g., avoid NC‑licensed content in paid offerings unless you have explicit permission).
