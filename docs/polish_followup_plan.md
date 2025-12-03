# ElevatED Follow-Up Plan — Personalized, Engaging, Adaptive

Phased actions building on the current product polish backlog to tighten reliability, perceived adaptivity, and engagement.

## Phase 1 — Reliability & UX Polish (now)
- Add adaptive flash regression tests: emit `quiz_submitted` → verify flash persisted and banner renders once on Student Dashboard.
- Snapshot the “Why this?” copy map to prevent accidental ID/label regressions.
- Up Next reshuffle affordance: show a brief “updated just now” badge and gentle fade/stagger animation when entries change.
- In-lesson sidebar: add “Why this?” rationale below each Up Next item so context carries into play.

## Phase 2 — Adaptive Depth (next 1–2 sprints)
- Tutor guardrails: rate-limit repeated identical prompts; sample-log 1–2% of tutor replies for QA; add lightweight hallucination filter (e.g., ban obvious non-existent standards).
- Tutor intent awareness: let students pick a weekly intent (“precision”, “speed”, “stretch”) that nudges hint tone and XP bonus copy; reflect intent in tutor guardrails.
- Adaptive loop telemetry: instrument banner trigger rates and Up Next reshuffle causes (placement vs remediation vs stretch) to ensure coverage.

## Phase 3 — Engagement & Motivation (2–4 sprints)
- Personalization knob: weekly focus chip on dashboard (balanced/review/stretch) that tunes hint style and small XP bonuses; show the current mode in tutor and XP rows.
- Micro-motions: add meaningful reveal on adaptive banners and difficulty chips when they change.
- Parent follow-through: add “share progress” and “nudge” templates (email/SMS) tied to weekly delta and struggle flags; measure click → assignment conversion.

## Phase 4 — Observability & Ops (parallel/ongoing)
- Admin “adaptive health” panel: counts of remediation/stretch inserts, average targetDifficulty drift, banner firing rates, and failures.
- Alerting: notify if adaptive flashes drop below a threshold or if tutor guardrail blocks spike.
- Content QA: weekly sampled review of logged tutor responses and “Why this?” outputs by subject lead.

## Success Signals
- Perceived adaptivity: ≥70% of post-lesson sessions see a banner or rationale change; user feedback mentions “updates fast”.
- Safety/quality: <1% flagged tutor responses in sampled QA; hallucination filter <0.1% false positives.
- Engagement: +X% clickthrough on parent alerts → assignments; increased repeat opens of tutor when intent is active.
