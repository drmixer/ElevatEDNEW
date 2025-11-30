# Family-Ready (Phase 0)

## Scope & intent
- Grades 3–8 Math, 3–8 ELA, and 6–8 Science.
- Goal: define what “family-ready” means for the learner and the parent so we can validate activation, weekly value, and clear on-track signals before widening scope or adding new subjects.

## Acceptance checklist (Phase 0)
- ✅ Definition and scope documented (this file).
- ✅ KPIs, events, and on-track rules defined.
- ✅ Consent stance sign-off recorded.
- ✅ Instrumentation plan accepted by Product/Data (events, props, and destinations).
- ✅ Dashboard/email designs align to on-track and activation logic.
- Status tracker:
  - Definition & scope: ✅ (doc)
  - KPIs & events: ✅ (doc)
  - On-track rules: ✅ (doc)
  - Consent stance sign-off: ✅ (signed 2025-11-29)
  - Instrumentation acceptance: ✅ (signed 2025-11-29)
  - Dashboard/email alignment: ✅ (signed 2025-11-29)

## Definition of “family-ready”
- Child success criteria (per subject in scope):
  - Completes an age-appropriate diagnostic in the first session (≤10 minutes Math/ELA, ≤12 minutes Science) and sees a recommended path with at least 3 prioritized modules tied to grade/subject.
  - Can launch the first recommended lesson in ≤2 clicks after diagnostic completion; lesson loads with streak/progress states carried forward.
  - Receives clear guidance on “what’s next” (next lesson + optional practice) and short feedback when struggling (tutor hint or alternate path).
  - Progress, streaks, and mastery checkpoints are saved to the student profile and reflect in the child dashboard within seconds.
- Parent success criteria:
  - Gives or verifies consent once, sees which data are collected, and can revoke/export via the parent dashboard.
  - Understands the child’s recommended path and current status (on-track, at-risk, off-track) for each subject/grade in scope.
  - Can nudge (reminder), assign (module/lesson), or adjust pacing without breaking the child’s path; actions reflect in the child view within the same day.
  - Receives weekly updates that explain progress and risks in plain language (email + dashboard cards).

## Child flow (signup → consent → diagnostic → recommended path)
- Signup: child signs in via parent-created profile or self-starts with a parent email/phone invite; grade/subject preferences captured up front.
- Consent: if under 13 or without a linked guardian, block diagnostics until a parent approves via `/parent` (leveraging COPPA/FERPA stance in `docs/compliance.md`); show read-only preview only.
- Diagnostic: auto-launch subject-specific diagnostic for the selected grade (Math/ELA 3–8; Science 6–8). Allow pause/resume; cap duration as above.
- Recommended path: immediately render the prioritized module list (3–5 items) plus the first lesson start CTA. Store diagnostic summary so the path persists across sessions.
- First lesson: start the top recommendation; log session start, checkpoints, and completion. Upon finish, refresh path with next-best items or practice.

## Parent goals and on-track definition
- Parent goals: visibility (know what the child is doing), confidence (clear progress status), and control (nudge/assign/pause).
- On-track definition (per subject in scope):
  - Baseline: diagnostic completed in the last 90 days for that subject.
  - Pacing: ≥2 recommended lessons/week for Math and ELA; ≥1 recommended lesson/week for Science.
  - Mastery: rolling average score ≥70% on lesson checkpoints or practice for the last 3 sessions.
  - At-risk if pacing is missed for 2 consecutive weeks or mastery drops below 70% twice; off-track if no lesson in 3+ weeks or diagnostic missing/expired.

## KPIs (Phase 0)
- Activation (diagnostic → first lesson): % of new child profiles that start and complete a first lesson within 48 hours of diagnostic completion (per subject).
- Weekly active (WAU): unique child sessions with a lesson or practice event in the last 7 days; parent WAU = unique guardians viewing `/parent` or opening a weekly email summary.
- On-track rate: % of active children meeting on-track criteria above for at least one subject in scope; track per subject and household.
- Suggested reporting cuts: by subject, grade, first-week vs returning, and by presence of parent engagement (e.g., reminder/assignment sent in last 14 days).

## Required events/metrics
- `child_signup_started/completed` (props: grade, subject_interest, source).
- `parent_consent_requested/granted/declined/revoked` (props: child_id, method, timestamp).
- `diagnostic_started/completed` (props: child_id, subject, grade, duration_sec, score_bucket, exited_early).
- `recommended_path_viewed` (props: child_id, subject, modules_shown, generated_at, source=diagnostic|resume).
- `lesson_started/completed` (props: child_id, subject, module_id, lesson_id, duration_sec, checkpoint_score, completion_state).
- `practice_session_started/completed` (props: child_id, subject, item_count, accuracy).
- `weekly_email_sent/opened/clicked` (props: child_id, parent_id, subject_summary).
- `on_track_status_changed` (props: child_id, subject, from_status, to_status, reason=pacing|mastery|diagnostic_expired).
- Derived metrics needed for dashboards: activation funnel (diagnostic → path → lesson start/complete), WAU/DAU, streak length, weekly lessons per subject, time-to-first-lesson, and assignment compliance where used.
- Event destinations: client → analytics pipeline → warehouse tables powering activation funnel and on-track materialized views; feed the same views to weekly digest jobs and dashboards to avoid drift.

### KPI formulas (warehouse-friendly)
- Activation: `count(distinct child_id where lesson_completed within 48h of diagnostic_completed) / count(distinct child_id with diagnostic_completed)` per subject and cohort (new vs returning).
- WAU (child): distinct child_id with `lesson_completed` or `practice_session_completed` in last 7 days; WAU (parent): distinct parent_id with `/parent` session or `weekly_email_opened` in last 7 days.
- On-track rate: distinct child_id with latest `on_track_status = on_track` / distinct active child_id (same window); compute per subject and household.
- Time-to-first-lesson: median minutes from `diagnostic_completed` to first `lesson_started`.
- Weekly lessons per subject: average completed recommended lessons per subject per active child (filter subject ∈ {Math, ELA, Science 6–8}).

## UX surfaces
- Child dashboard (`/student`):
  - Shows current streak, next up (first recommended lesson), and a short “why this” note from the diagnostic.
  - Allows resume diagnostic if unfinished; otherwise highlights the first lesson with expected time.
  - Provides a small “I’m stuck” path to hints or alternative practice without breaking pacing.
- Parent view (`/parent`):
  - Status cards per subject with on-track/at-risk/off-track labels and the key driver (pacing, mastery, diagnostic stale).
  - Controls to approve/deny consent, send reminders, assign a module/lesson, and adjust weekly goals (e.g., lessons per week).
  - Weekly digest panel mirrors the email summary and links into the child’s next steps.

## Consent stance & approvals
- Stance: parent/guardian owns the account; children access via parent-approved profiles. Under-13 flows require verifiable parental consent before storing diagnostics, practice, or PII. Consent is revocable; data rights follow `docs/compliance.md` (export/delete via parent dashboard).
- Sign-off: Product and Legal confirmed consent copy, gating rules for under-13, and data retention scope (signed 2025-11-29).
- Approval table:
  - Product: Approved (User, 2025-11-29)
  - Legal/Privacy: Approved (User, 2025-11-29)
  - Eng lead (for instrumentation readiness): Approved (User, 2025-11-29)
  - Data owner (for KPI definitions): Approved (User, 2025-11-29)

## Notes for instrumentation & delivery
- Grade/subject flags must be captured on profile creation to route diagnostics correctly.
- Activation and on-track KPIs require reliable event timestamps; clock skew and offline caching should be handled in the client to avoid mislabeling status.
- Parent and child dashboards should use the same on-track computation service to avoid mismatched labels between surfaces.
- Recommended destinations: client → analytics pipeline → warehouse tables for activation funnel and on-track materialized views; wire weekly digest jobs to the same view to keep labels consistent.
- QA: simulate under-13 without consent, consent revoked, and diagnostic-expired states to ensure gating and on-track transitions emit `on_track_status_changed`.
- Implementation notes:
  - Create a shared `on_track_status` calculator (server or warehouse) referenced by both `/parent` cards and weekly digests to avoid divergent labels.
  - Add analytic schemas for the listed events (naming stability required): prefer a single `trackEvent` helper with type-safe props to avoid payload drift.
  - For under-13 gating, ensure pre-diagnostic preview does not emit PII-bearing events until consent is granted; log `parent_consent_requested` with a non-identifying correlation id if needed for funnels.
