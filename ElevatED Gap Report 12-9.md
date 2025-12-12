# ElevatED Outstanding Gaps — 12/9

Prioritized, phaseable plan focused only on remaining work.

## Phase 1 — Core Experience & Visibility
- Adaptive path visibility: Student “Today” view needs 3–5 upcoming tasks with rationales; parent “This week’s plan” card must derive from diagnostics/performance; “Up next” should live-update after diagnostics/task outcomes.
- Tutor depth: Add “Show hint,” “Break it down,” “Explain another way” with subject/concept tagging and logging; integrate curated alternative explanations for Math + ELA.
- Daily cadence/spaced review: 15-minute lane with 2–3 micro-tasks (new + review), daily spaced-review prompt, streak tied to micro-plan completion.

## Phase 2 — Parent Insight & Reports
- Trends card: per-subject accuracy/time-on-task deltas with up/down indicators.
- Alerts → actions: Follow-up cards with assignment/diagnostic links and completion stats.
- Weekly report: “What changed this week” summary (top 3 improvements/risks) in download/email.

## Phase 3 — Motivation & Habits
- Contextual nudges after tasks (recap/quick check/try again) using events + misconceptions; track shown/completed/dismissed.
- Celebration moments: streaks (3/7/14/30), accuracy gains, mastery unlocks with stable IDs, CTAs, and parent notifications.
- Parent check-ins: API-backed send/list/ack with delivery/seen status; student “From your grown-up” card and parent toast/report hook.

## Phase 4 — Student Simplicity & Mobile
- Above-the-fold simplification: single “Do this now” card + primary tutor CTA.
- Mobile layout pinning daily plan/tutor; 44px+ targets; quick replies.
- Tutor guardrail pill: always-visible context/safety with “Return to lesson.”

## Phase 5 — Variety & Electives (remaining polish)
- Mix-ins now surface; ensure server opt-outs respected (done). Still refine mix-in pairing from `student_progress` if thin weeks need better subject matches.
- Electives: ensure category rotation + allowed-subject limits respected in UI/plan; keep dismiss/opt-out synced.

## Phase 6 — Analytics, Onboarding, Dashboard Polish
- Academic analytics: avg accuracy/time-on-task with prior-week comparison (student + parent) and data-rights visibility.
- Onboarding: student baseline plan + tutor mini-guide; parent onboarding with guardian link, grade, diagnostic prompt, and completion tracking.
- Parent dashboard responsive order: alerts, daily/weekly plan, trends, safety panel accessible.

## Phase 7 — Performance & Stability
- Coverage rollup reliability (timeouts/pagination).
- Dashboard load under slow/3G with skeletons.
- Error logging for tutor/safety/adaptive without PII.

## Phase 8 — Success Metrics
- Define/log: alert resolution time, diagnostic completion, assignment follow-through, weekly accuracy delta, daily plan completion rate.
- Surface “impact” snippet in parent reports and metrics with tooltips in dashboards. 
