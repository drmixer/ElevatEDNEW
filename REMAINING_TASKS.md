# Remaining Tasks for ElevatED Launch

> **Generated:** December 18, 2024  
> **Status:** Pre-Launch Completion Tasks

This document consolidates all unfinished tasks from the various plan documents to provide a single action list for wrapping up the project.

---

## ⚠️ Pre-Launch Blockers

These items should be completed before public beta launch:

### 1. Content Coverage Definition (from `prelaunch-readiness-checklist.md` §4.1)
**Priority:** High | **Effort:** 2-4 hours | **Status:** ✅ Complete

- [x] Define "minimum viable coverage" for each grade/subject (`shared/contentCoverage.ts`)
- [x] Create coverage evaluation service (`server/contentCoverage.ts`)
- [x] Add admin API endpoints for coverage data (`/api/v1/admins/content-coverage`)
- [x] Add coverage display in admin dashboard UI (`AdminDashboard.tsx` → "Content Coverage" card)
- [ ] Integrate coverage filtering into recommendations service (optional enhancement)
- [ ] Flag experimental or low-quality lessons in catalog UI (optional enhancement)

**Why it matters:** Students shouldn't encounter "empty" learning paths.

---

### 2. Diagnostic Verification (from `prelaunch-readiness-checklist.md` §4.2)
**Priority:** High | **Effort:** 2-3 hours | **Status:** ⚙️ 43% Complete

- [x] Add QA script for end-to-end diagnostic → path flow (`scripts/verify_diagnostics.ts`)
- [x] Verify diagnostics exist for each in-scope grade/subject (**IMPROVED: 14% → 43% coverage**)
- [x] Seed Math/ELA/Science diagnostics for grades 6-8 (`scripts/seed_diagnostic_assessments.ts` ✅ RAN)
- [x] Add `diagnostic_status` column migration (`supabase/migrations/046_diagnostic_status.sql`)
- [x] Apply migration to production database ✅ Applied
- [ ] Create diagnostics for grades K-5 (data files needed)
- [x] Verify adaptive pathing uses diagnostic signals (✅ 6 students have learning_path data)

**Verification Results (from script):**
| Category | Status |
|----------|--------|
| Science Grades 6-8 | ✅ Have diagnostics (8-9 questions each) |
| Math Grades 6-8 | ✅ Seeded (20 questions each) |
| ELA Grades 6-8 | ✅ Seeded (18 questions each) |
| Math/ELA K-5 | ❌ Need diagnostic data files |
| Student profiles | 📋 Migration created, needs to be applied |
| Adaptive pathing | ✅ Working (6 students have paths) |

**To apply the migration, run this SQL in Supabase:**
```sql
-- See supabase/migrations/046_diagnostic_status.sql
ALTER TABLE student_profiles
ADD COLUMN IF NOT EXISTS diagnostic_status text,
ADD COLUMN IF NOT EXISTS diagnostic_completed_at timestamptz;
```

**Run verification:**
```bash
npx tsx scripts/verify_diagnostics.ts --verbose
```

---

### 3. Ops Dashboard UI (from `prelaunch-readiness-checklist.md` §5.1)
**Priority:** Medium | **Effort:** 4-6 hours | **Status:** ✅ Already implemented

The backend metrics exist (`opsMetrics.ts`) and are already exposed in the admin dashboard:

- [x] Add internal "ops dashboard" view in admin panel (`AdminDashboard.tsx` → "Ops Signals" section)
- [x] Show error rate metrics with totals
- [x] Display top safety-block reasons
- [x] Show top routes causing failures
- [x] Show recent signals with details
- [x] Content coverage API added (`/api/v1/admins/content-coverage`)

**Note:** The Ops Signals panel in AdminDashboard.tsx already displays all these metrics. This task is complete.

---

## 📋 QA & Sign-offs (Process Items)

From `prelaunch-readiness-checklist.md` §6-7:

### E2E Test Coverage
- [x] Add test: Subscription upgrade/downgrade enforcement → `tests/e2e/subscription-flows.spec.ts`
- [x] Add test: Unsafe chat scenario triggering guardrails → `tests/e2e/guardrail-report.spec.ts`
- [ ] Verify events/logs emitted as expected in tests

### Manual Smoke Test Checklist
- [x] Document staging smoke test procedure → `docs/smoke-test-procedure.md`
  - ✅ Authentication & Onboarding tests
  - ✅ Parent Dashboard tests  
  - ✅ Student Dashboard tests
  - ✅ Lesson Player tests
  - ✅ AI Tutor tests (including safety)
  - ✅ Billing & Subscription tests (sandbox)
  - ✅ Admin Dashboard tests
  - ✅ Accessibility checks

### Launch Sign-offs
- [ ] Product sign-off on first-run experience
- [ ] Safety/compliance sign-off on assistant behavior
- [ ] Eng/Ops sign-off on monitoring/runbooks
- [ ] Data sign-off on KPI measurement

---

## 🔧 Optional Improvements (Post-Launch OK)

These can be done after launch but improve the experience:

### From `LESSON_REDESIGN_PLAN.md`
- [ ] **Phase 7.6:** Cross-browser testing (Safari, Firefox, Edge)
- [ ] **Phase 7.7:** User testing feedback incorporation
- [ ] **Phase 8:** Facilitator View (teacher "see all at once" mode)

### From `CONTENT_QUALITY_PLAN.md`
- [ ] Add `quality_score` column to lessons table
- [ ] Build content quality dashboard in admin panel
- [ ] Add "Report Content Issue" button in lesson player
- [ ] Implement scheduled content audit workflow
- [ ] Add pre-commit hooks for content changes

### From `student-experience-improvements.md`
- [ ] XP animation feel tuning
- [ ] Micro-animations for weekly plan updates
- [ ] Standalone "Tutor Explainer Panel"

### From `parent-experience-improvements.md`  
- [ ] Explicit "On-Track/At-Risk/Off-Track" status labels
- [ ] Parent onboarding 3-step tour
- [ ] Parent dashboard component refactoring (7K+ lines)

### From `beta-steps.md`
- [ ] Define in-scope grades/subjects for beta
- [ ] Pick 2-4 anchor standards per grade/subject
- [ ] Run beta coverage audit commands

---

## ✅ Already Completed

For reference, these major items are DONE:

### Content
- [x] 1,190 lessons with 0 quality issues
- [x] 24,000+ practice questions (100% coverage)
- [x] All placeholder vocabulary fixed
- [x] All structure issues fixed
- [x] All template content replaced

### Student Experience
- [x] Weekly Plan Card (lessons/minutes/progress)
- [x] Study Mode Selector (catch up/keep up/get ahead)
- [x] Today's Focus Card with rationale
- [x] Celebration moments system
- [x] Tutor persona selection
- [x] "Report this answer" in tutor chat

### Parent Experience
- [x] AI controls per learner
- [x] Safety & Privacy panel
- [x] Concern reporting system
- [x] Weekly coaching suggestions
- [x] Assignment system

### Operational
- [x] Sentry monitoring with error spike detection
- [x] Ops metrics tracking (`opsMetrics.ts`)
- [x] API instrumentation (`instrumentation.ts`)
- [x] Deployment runbook (`docs/deployment-runbook.md`)
- [x] E2E tests for critical paths

---

## Recommended Priority Order

1. **Content Coverage Definition** - Define what grades/subjects are "ready"
2. **Diagnostic Verification** - Ensure adaptive path works end-to-end
3. **Manual Smoke Test Checklist** - Document the QA procedure
4. **Sign-offs** - Get stakeholder approval
5. **Cross-browser testing** - Manual testing session
6. **Post-launch improvements** - Iterate based on user feedback

---

## Commands

```bash
# Start dev server
npm run dev

# Run lint (should pass with 0 errors, 1 warning)
npm run lint

# Run content audit
npx tsx scripts/audit_content_quality.ts

# Run E2E tests
RUN_E2E=true npm run test:e2e
```

---

*Last updated: December 18, 2024*
