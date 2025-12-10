# ElevatED Gap Report — 12/9

Actionable plan to close gaps between the current app and the stated vision (K–12 adaptive, AI-assisted, parent-friendly at-home learning). Each item includes goals and completion criteria.

## 1) Adaptive Path Visibility & Control
- **Goal:** Make the adaptive learning path visible to students and parents with clear “up next” and rationale.
- **Completion Criteria:**
  - Student “Today” view shows 3–5 upcoming tasks (lesson/practice/recap) with a short reason (e.g., “Based on last quiz: fractions accuracy 62%”).
  - Parent dashboard has a “This week’s plan” card derived from diagnostics and recent performance.
  - “Up next” updates after diagnostic results and after completing/struggling on tasks without manual refresh.

## 2) Tutor Depth: Hints & Explanations
- **Goal:** Provide multi-tier help and alternative explanations inside tutor flows.
- **Completion Criteria:**
  - Add buttons for “Show hint,” “Break it down,” and “Explain another way” that request progressively more scaffolding.
  - Tutor responses tag the subject/concept and log which hint level was used.
  - At least one subject (Math + ELA) has curated alternative explanation templates integrated into AI prompts.

## 3) Daily Practice Cadence & Spaced Review
- **Goal:** Encourage short daily sessions and spaced retrieval.
- **Completion Criteria:**
  - “15-minute plan” lane on student home with 2–3 micro-tasks (new + review).
  - Spaced-review prompt surfaced daily (e.g., “Review yesterday’s concept in 3 minutes”) with tracking of completion.
  - Streak UI references daily micro-plan completion, not just logins.

## 4) Parent Insight: Trends & Next Steps
- **Goal:** Give parents trendline clarity and actionable follow-through.
- **Completion Criteria:**
  - Parent dashboard shows per-subject trend deltas (accuracy/time-on-task) for the past week, with “up/down” indicators.
  - Alert cards link to actions (assign module, schedule diagnostic) and show completion stats (e.g., “2 of 3 follow-ups done”).
  - Downloadable/emailed report includes a “What changed this week” summary (top 3 improvements, top 3 risks).

## 5) Motivation & Habits (Student)
- **Goal:** Reinforce effort with lightweight nudges and celebrations.
- **Completion Criteria:**
  - In-app student nudges: “1-minute recap,” “Quick check,” or “Try again” surfaced contextually after tasks.
  - Celebration moments trigger in student UI for streaks, accuracy gains, and mastery unlocks.
  - Parent “check-in” snippets can be sent in-app (or easily copied) with confirmation of receipt by the student.

### Phase 5 implementation plan
- **Gaps:** Nudges are limited to generic banners; celebrations only fire for last badge or 7/30-day streaks; parent “Send check-in” is copy-only with no delivery or seen state.
- **Workstreams:** (1) After-task nudges, (2) Celebration expansions, (3) Parent check-ins with delivery + receipt.

#### 1) After-task nudges (recap, quick check, try again)
- **Trigger sources:** Student event responses (`sendStudentEvent`) + `AdaptiveFlash` in `useStudentData.ts` and recent `student_progress` rows in `dashboardService.ts`.
- **Logic:** Try again if lesson/checkpoint accuracy <70% or `adaptive.misconceptions` exists; Quick check if 70–85% accuracy or lesson stuck in progress >1 day; 1-minute recap if ≥85% accuracy or `nextReason=stretch`. Use `target_standard_codes`/`primaryStandard` to label the concept and link to the same lesson or a 3-question check-in.
- **UX:** Add a compact `NudgeCard` near the Today lane with CTA chips (`Start recap (1 min)`, `Do quick check (3 Q)`, `Try again`) plus a dismiss link. Show a one-line reason like “Because fractions accuracy was 62%” using `humanizeStandard`.
- **Instrumentation:** Emit `student_nudge_shown/completed/dismissed` with {type, subject, standard, source_event, accuracy_band}. Cache taken nudges per event (`nudge:{studentId}:{eventId}`) to avoid repeats.

#### 2) Celebration moments (streaks, accuracy gains, mastery)
- **New triggers:** Streak milestones at 3/7/14/30 days (today only 7/30), accuracy gain when `subjectTrends.accuracyDelta` or avg accuracy improves ≥5–10pp week-over-week, mastery unlock when `modulesMastered.items` grows or `subjectMastery.mastery` crosses 80/90%.
- **Backend updates:** Extend `buildCelebrationMoments` in `dashboardService.ts` to emit the above with unique ids and `notifyParent=true` for streak ≥7, mastery unlocks, and >10pp accuracy gains. Keep `occurredAt` stable so the seen set works.
- **UI polish:** Reuse `celebrationQueue`; cap to two per load; map CTAs (`Start next lesson` for streak/accuracy, `View mastered module` when module slug exists); keep 5th-grade copy and `celebration_*` events intact.

#### 3) Parent check-ins with delivery + receipt
- **Data/API:** Add `parent_check_ins` table (id, parent_id, student_id, message, topic, status enum sent|delivered|seen, delivered_at, seen_at, created_at, source). Endpoints: `POST /api/v1/parent/check-ins`, `GET /api/v1/student/check-ins`, `POST /api/v1/student/check-ins/:id/ack`.
- **Parent UI:** Update `handleQuickCheckIn` in `ParentDashboard.tsx` to call the API (fallback to copy if it fails), show status chips Sent/Delivered/Seen with timestamps, and keep “Copy snippet” for out-of-band sharing.
- **Student UI:** Add a “From your grown-up” card on StudentDashboard listing the latest check-in, with CTAs `I saw this` (acks) and `Reply in tutor` (prefills LearningAssistant prompt). Announce arrivals via `aria-live` and log `parent_checkin_seen`.
- **Notifications:** On ack, show parent toast and optional email in the weekly report hook; store `seen_at` so parent dashboard stats can count confirmation rate.

#### Definition of done (Phase 5)
- After completing a task, students see one contextual nudge (recap, quick check, or try again) tied to their last result with a working CTA.
- Celebration queue covers streaks, accuracy gains, and mastery unlocks with at least one parent-notifiable moment when applicable.
- Parent check-in snippets are persisted, appear in the student UI, and flip to Seen once acknowledged (with copy fallback preserved).

## 6) Student Simplicity & Mobile Focus
- **Goal:** Keep the student experience focused and low-friction, especially on mobile.
- **Completion Criteria:**
  - Student home defaults to a single “Do this now” panel plus a “Need help? Ask” tutor entrypoint.
  - Mobile layout keeps the daily plan and tutor entry above the fold; large tap targets and minimal typing.
  - Guardrail status shown in tutor UI (e.g., “School-safe mode on”) with a quick way to return to the current lesson context.

## 7) Cross-Subject Variety & Electives
- **Goal:** Maintain variety without overwhelm; leverage electives.
- **Completion Criteria:**
  - Weekly plan auto-includes 1–2 mixed-in practice items (e.g., apply math in science) when core load is light.
  - Electives are suggested when a learner finishes core tasks early; parents can toggle elective emphasis per child.
  - Opt-out controls so families can limit mix-ins to core subjects only.

## 8) Academic Analytics & Trust
- **Goal:** Add lightweight accuracy/time-on-task metrics and keep parents informed.
- **Completion Criteria:**
  - Parent and student views show “Avg accuracy this week” and “Time on task” per subject with prior-week comparison.
  - Data rights and safety logs remain visible; academic analytics do not expose PII or raw content.
  - Alerts/metrics exportable in the data rights export bundle.

## 9) Onboarding Flow (Student & Parent)
- **Goal:** Ensure first-run produces a baseline plan and tutor guidance.
- **Completion Criteria:**
  - Student first-run flow ends with a baseline plan (diagnostic scheduled/run or starter placement) and a “How to ask for help” mini-guide in chat.
  - Parent onboarding confirms guardian link, sets grade, and prompts a diagnostic within the first session.
  - Completion tracking for onboarding (e.g., “3 steps done”) and nudge if diagnostic not run within 48 hours.

## 10) Responsive Parent Dashboard Refinements
- **Goal:** Keep priority items above the fold on mobile and tighten visual hierarchy.
- **Completion Criteria:**
  - Mobile-first ordering: alerts, daily/weekly plan, trends, then secondary cards.
  - Consistent card heights/typography scale across priority panels; restrained animations (no layout jumps).
  - Safety/data rights panel remains accessible with clear timestamps and statuses.

## 11) Performance & Stability Checks
- **Goal:** Ensure adaptive queries and coverage audits complete reliably.
- **Completion Criteria:**
  - Coverage rollup runs without timeouts on the full grade set (adjust Supabase timeout or paginate queries).
  - Key dashboards (parent/student) load under target time on 3G/slow devices; add skeletons where needed.
  - Error logging captures tutor/safety/adaptive failures without leaking PII.

## 12) Success Metrics & Tracking
- **Goal:** Track the impact of the above changes.
- **Completion Criteria:**
  - Define and log: alert resolution time, diagnostic completion rate, assignment follow-through, weekly accuracy delta, daily plan completion rate.
  - Parent reports include a small “impact” section (e.g., “2 alerts resolved; accuracy +4% in math”).
  - Dashboards show these metrics with tooltips explaining how they’re calculated.
