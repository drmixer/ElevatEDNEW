# Visuals Pipeline (MVP)

Goal: add relevant visuals to lessons at scale without manual image sourcing.

## Track A — Generated SVGs (preferred for K–5 math)

Why:
- zero licensing risk
- always relevant to the exact numbers in the lesson
- consistent style

Approach:
- Detect a “visual opportunity” from lesson/section content (e.g., rectangle dimensions in a perimeter lesson).
- Render an SVG diagram dynamically in the lesson player.
- (Optional later) persist generated SVGs as lesson assets to avoid repeated computation.

Initial scope:
- Perimeter/area rectangles + squares (labels + “add the sides” cue)
- number lines (addition/subtraction; skip counting)
- arrays (multiplication as rows/columns)
- fraction bars (1/2, 1/3, 3/4, etc.)

## Track B — Open-license image auto-curation (for ELA/Science/Social)

Why:
- subjects often benefit from real-world photos/diagrams

Sources (license-safe defaults):
- Wikimedia Commons (Public Domain / CC BY / CC BY-SA)
- NASA (mostly public domain; verify per asset)
- USGS / NOAA (often public domain; verify per asset)

MVP workflow:
1. Build a script that takes `(lesson_id, title, subject, gradeBand, keywords)` and searches sources.
2. Filter candidates by license and content type (prefer images/diagrams over logos).
3. Download the best candidate(s) and store in Supabase Storage.
4. Insert/update a lesson asset row with:
   - `url`
   - `title`
   - `license`
   - `licenseUrl`
   - `attributionText`
   - tags/metadata (source, author, page URL)
5. Add an admin “review” view to approve/replace images when matches are poor.

Guardrails:
- never ingest non-open licenses
- always store attribution metadata
- keep a “known bad” list per source for low-quality matches

