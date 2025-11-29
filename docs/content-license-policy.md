# Content License Policy (Phase 2)

## Import vs Link Rules
- **Importable**: CC BY / CC0 / Public Domain. CC BY-SA allowed only if we preserve the same license on derivatives and keep attribution. Record license string and URL on every stored item.
- **Link/Embed Only**: Any **Non-Commercial**, **No-Derivatives**, unclear license, or platform ToS that forbids redistribution. Do not store the full content; store metadata and outbound URL only.
- **Forbidden**: Anything with unclear provenance or explicit commercial restrictions without written permission.
- Attribution must be displayed wherever imported content is surfaced (e.g., “Source: Open Up Resources (CC BY 4.0)”). For BY-SA items, note the share-alike requirement.
- Track `license_type`, `license_url`, `source_provider`, and `last_verified_at` on every record; re-verify licenses at least annually.

## Provider Classification (current targets)
- **Open Up Resources / Illustrative Mathematics (IM K–5, 6–8 Math)** — CC BY 4.0 — **Importable** with attribution to Open Up Resources and Illustrative Mathematics; keep original notices.
- **OpenStax** — CC BY 4.0 — **Importable**; cite book title/edition and chapter.
- **OpenSciEd** — CC BY 4.0 — **Importable**; retain footer/license language.
- **EL Education Language Arts (2019)** — CC BY 4.0 — **Importable** for ELA units/lessons.
- **Project Gutenberg / Public domain texts (US)** — Public Domain — **Importable**; keep source citation; avoid texts with lingering copyright in non-US markets.
- **NASA media** — Public Domain (17 U.S.C. § 105, except logos/insignia) — **Importable/Embeddable**; avoid logos/insignia use.
- **PhET simulations** — CC BY 4.0 (most sims; some third-party assets may differ) — Treat as **Embed**; store metadata only and show attribution; if offline copies are needed, re-check individual sim license.
- **EngageNY / Eureka Math & ELA (Great Minds)** — CC BY-NC-SA 3.0 US — **Link Only**; non-commercial and share-alike prevent internal storage for commercial use without permission.
- **CK-12** — CC BY-NC 3.0 (many resources) plus CK-12 terms — **Link Only**; non-commercial.
- **Khan Academy** — CC BY-NC-SA 3.0 US — **Link/Embed Only**; non-commercial; do not store or modify.
- **OER Commons (aggregator)** — **Varies by item** — Default to **Link Only**; import only when item is explicitly CC BY/CC0 and recorded with license metadata.

## Anchor Content Choices (v1)
- **Math 3–8**: Illustrative Mathematics via Open Up Resources (CC BY 4.0) as the backbone units/lessons; OpenStax (Pre-Algebra/Algebra) for bridge/extension topics; EngageNY/Eureka strictly link-only for additional practice references.
- **ELA 3–8**: EL Education Language Arts (CC BY 4.0) as core units; embed public-domain texts (Project Gutenberg, Library of Congress) for readings; EngageNY ELA modules as link-only references.
- **Science 6–8**: OpenSciEd (CC BY 4.0) as core sequence; PhET simulations embedded with attribution; NASA assets for media/examples (PD); other OER Commons NGSS resources link-only unless CC BY.

## Display and Storage Standards
- Always render a visible source line near the resource title (e.g., badge or footer): `Source: {provider} — {license}` with a link to the license.
- Keep original filenames and section labels where practical; never remove embedded copyright/attribution notices.
- For embedded media (video/sims), prefer provider embeds over copies; if copying is required, re-verify license and keep a local license artifact.

## Enforcement Rules
- Reject imports if `license_type` is empty, non-commercial, ND, or unknown.
- For BY-SA imports, mark content as share-alike and avoid mixing with proprietary-only bundles.
- Maintain an audit log of imported items with `source_provider`, `license_type`, `license_url`, and `last_verified_at`.
- Re-run license verification whenever a provider updates terms or on an annual schedule.
