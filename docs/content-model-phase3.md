# Content Model & Metadata (Phase 3)

Scope: align Phase 1 standards and Phase 2 licensing with the existing Supabase schema (modules, lessons, assets, standards, content_sources).

## Types and DB Mapping
- **Course**: `modules` row with `metadata.kind = "course"`. Use for a grade-band and subject (e.g., Math 6-8). Fields: `title`, `slug`, `subject`, `grade_band`, `summary/description`, `source_id` (to `content_sources`), `metadata.grades` (list of integers), `metadata.storage_mode` (`imported` or `linked`).
- **Unit**: `modules` row with `metadata.kind = "unit"` and `metadata.parent_module_id = <course module id>`. Units inherit `subject` and `grade_band` from course; can override `metadata.grades` when needed. Standards alignment lives in `module_standards`.
- **Lesson**: `lessons` row with `module_id` pointing to the Unit; `slug`, `title`, `visibility`, `attribution_block` (required if assets are attached), `license`, `source`, `source_url`, `metadata` (see Tagging). If a lesson belongs to a course without units, still set `module_id` to the course module.
- **Activity**: `assets` row with `kind = "activity"` and `lesson_id` (or `module_id` for unit-level activities). Use `metadata.storage_mode` to distinguish `stored` vs `link` vs `embed`.
- **Resource**: `assets` row with `kind` in `{ "video", "reading", "exercise", "simulation", "project", "assessment", "worksheet" }`; always set `license`, `license_url` (if available), `source_id` when possible, `metadata.media_type` mirroring `kind`.
- **Assessment**: existing `assessments` rows; link to units/lessons via `module_id` or `lesson_id` (if present) and set `metadata.assessment_type` (`quiz`, `unit_assessment`, `project_rubric`).

## Tagging Model (store in `metadata`)
Applies to `modules` (course/unit) and `lessons`; use the same keys for assets when relevant.
- `grades`: array of integers (e.g., `[6,7]`); keep `grade_band` in the main column for querying.
- `subject`: keep main column on `modules`; duplicate in lesson metadata for fast filtering.
- `standards`: array of `{ framework, code }` for lessons; units use `module_standards` as the source of truth (keep redundant codes in metadata for search).
- `skills`: array of skill tags from `data/curriculum/skill_tags_phase3.csv`.
- `difficulty`: 1-5 scale (1 Foundation/preview, 2 Emerging, 3 On-Grade Core, 4 Stretch, 5 Challenge).
- `estimated_time_minutes`: integer for expected student time.
- `prerequisites`: array of lesson slugs or module slugs; map to `topic_prerequisites` later if formal graph is needed.
- `media_type`: dominant media for lessons/resources (`video`, `reading`, `exercise`, `simulation`, `mixed`).
- `storage_mode`: `stored` (we host), `link` (deep link), or `embed` (iframe); mirrors license policy rules.

## License and Provenance Fields
- Required on **modules** and **lessons**: `license` (string), `metadata.license_url`, `metadata.source_provider`, `metadata.source_doc_id` (e.g., PDF path or repo ref), `metadata.last_verified_at` (ISO timestamp), and `source_id` when the provider exists in `content_sources`.
- Required on **assets**: `license`, `license_url`, `attribution_text`, `metadata.source_provider`, `metadata.storage_mode`, `metadata.last_verified_at`.
- For BY-SA content, set `open_track = true` on lessons (already enforced by trigger when assets are BY-SA).
- Attribution display (UI): show a small badge or footer near the resource title: `Source: {provider} - {license}` with a link to `license_url`.

## Skill Tags (canonical list)
Source of truth in `data/curriculum/skill_tags_phase3.csv`. Use these tags in `metadata.skills`.

## Sample Import Payload (excerpt)
```json
{
  "course": {
    "title": "Grade 6 Mathematics",
    "slug": "math-6",
    "subject": "Mathematics",
    "grade_band": "6",
    "metadata": {
      "kind": "course",
      "grades": [6],
      "storage_mode": "imported",
      "source_provider": "Open Up Resources / IM",
      "license": "CC BY 4.0",
      "license_url": "https://creativecommons.org/licenses/by/4.0/",
      "last_verified_at": "2024-02-01T00:00:00Z"
    }
  },
  "units": [
    {
      "title": "Unit 1: Ratios and Rates",
      "slug": "math-6-unit-1-ratios",
      "metadata": {
        "kind": "unit",
        "parent_module_id": "<math-6 module id>",
        "grades": [6],
        "skills": ["ratios_proportions"],
        "storage_mode": "imported"
      },
      "standards": [
        { "framework": "CCSS-M", "code": "6.RP.A.1" },
        { "framework": "CCSS-M", "code": "6.RP.A.3" }
      ],
      "lessons": [
        {
          "title": "Understanding Ratios",
          "slug": "math-6-u1-l1-understanding-ratios",
          "license": "CC BY 4.0",
          "metadata": {
            "grades": [6],
            "skills": ["ratios_proportions"],
            "standards": [
              { "framework": "CCSS-M", "code": "6.RP.A.1" }
            ],
            "difficulty": 3,
            "estimated_time_minutes": 45,
            "media_type": "mixed",
            "storage_mode": "imported"
          },
          "assets": [
            {
              "kind": "exercise",
              "title": "Ratio word problems set A",
              "url": "https://example.com/ratio-set-a",
              "license": "CC BY 4.0",
              "license_url": "https://creativecommons.org/licenses/by/4.0/",
              "metadata": {
                "media_type": "exercise",
                "storage_mode": "link",
                "source_provider": "Open Up Resources",
                "last_verified_at": "2024-02-01T00:00:00Z"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## Operational Notes
- Keep `content_sources` populated for every provider used in imports and point `modules.source_id` and `assets.source_id` at it.
- Reject imports missing license info or marked NC/ND; set `storage_mode = "link"` for link-only providers (EngageNY, CK-12, Khan).
- Populate `module_standards` at the Unit level; store lesson-level standard codes in metadata until a `lesson_standards` table is added.
