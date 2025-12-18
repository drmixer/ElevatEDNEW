# Remaining Tasks for ElevatED Launch

> **Generated:** December 18, 2024  
> **Status:** Pre-Launch Completion Tasks

This document consolidates all unfinished tasks from the various plan documents to provide a single action list for wrapping up the project.

---

## ⚠️ Pre-Launch Blockers

These items should be completed before public beta launch:

### 1. Content Coverage Definition (from `prelaunch-readiness-checklist.md` §4.1)
**Priority:** High | **Effort:** 2-4 hours

- [ ] Define "minimum viable coverage" for each grade/subject
- [ ] Ensure paths don't surface thin/empty strands  
- [ ] Hide or down-rank strands/modules below content bar
- [ ] Flag experimental or low-quality lessons

**Why it matters:** Students shouldn't encounter "empty" learning paths.

---

### 2. Diagnostic Verification (from `prelaunch-readiness-checklist.md` §4.2)
**Priority:** High | **Effort:** 2-3 hours

- [ ] Verify diagnostics exist for each in-scope grade/subject
- [ ] Confirm diagnostic results are written to student profiles
- [ ] Verify adaptive pathing uses diagnostic signals
- [ ] Add QA scripts for end-to-end diagnostic → path flow

**Why it matters:** The adaptive learning experience depends on proper diagnostics.

---

### 3. Ops Dashboard UI (from `prelaunch-readiness-checklist.md` §5.1)
**Priority:** Medium | **Effort:** 4-6 hours

The backend metrics exist (`opsMetrics.ts`) but need to be exposed:

- [ ] Add internal "ops dashboard" view in admin panel
- [ ] Show error rate over time with alert thresholds
- [ ] Display top safety-block reasons
- [ ] Show top routes causing failures

**Note:** Backend already tracks all these metrics; just needs UI.

---

## 📋 QA & Sign-offs (Process Items)

From `prelaunch-readiness-checklist.md` §6-7:

### E2E Test Coverage
- [ ] Add test: Subscription upgrade/downgrade enforcement
- [ ] Add test: Unsafe chat scenario triggering guardrails
- [ ] Verify events/logs emitted as expected in tests

### Manual Smoke Test Checklist
- [ ] Document staging smoke test procedure:
  - Sign in (parent + student) visit dashboards
  - Start lesson, complete checkpoint
  - Send tutor question, receive safe response
  - Trigger billing action (sandbox)
  - Basic accessibility check (keyboard, focus states)

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
