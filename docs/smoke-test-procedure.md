# ElevatED Staging Smoke Test Procedure

This document outlines the manual smoke test procedure to verify all critical paths before launch.

## 🔧 Pre-Test Setup

1. **Environment**: Use staging environment with test accounts
2. **Browsers to test**: Chrome (primary), Safari, Firefox
3. **Devices**: Desktop (1920x1080), Tablet (iPad), Mobile (iPhone 14)
4. **Test accounts needed**:
   - Parent account with active subscription
   - Parent account with free tier
   - Admin account

---

## 📋 Smoke Test Checklist

### 1. Authentication & Onboarding

| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Parent Sign Up | Navigate to `/sign-up`, enter email/password, verify email | Account created, redirected to onboarding | ☐ |
| Parent Login | Navigate to `/login`, enter credentials | Logged in, shown parent dashboard | ☐ |
| Child Profile Creation | From parent dashboard, click "Add Child", fill form | Child profile created, appears in sidebar | ☐ |
| Student Login | Use student credentials from invite | Student dashboard loads with weekly plan | ☐ |
| Password Reset | Click "Forgot Password", enter email | Reset email received, can set new password | ☐ |
| Logout | Click user menu → Sign out | Logged out, returned to home page | ☐ |

---

### 2. Parent Dashboard

| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Dashboard Load | Login as parent | Dashboard loads within 3 seconds | ☐ |
| Child Selector | Click different child in sidebar | Dashboard updates to show that child's data | ☐ |
| Progress Overview | View "This Week" section | Shows lessons completed, minutes, progress | ☐ |
| Weekly Goal Setting | Click "Set Goals" | Can adjust goals, changes persist | ☐ |
| AI Controls | Navigate to Safety & Privacy | Can toggle AI features per child | ☐ |
| Assignment Creation | Create assignment for child | Assignment appears in child's lesson list | ☐ |
| Concern Report | Submit a concern report | Confirmation shown, report logged | ☐ |

---

### 3. Student Dashboard

| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Dashboard Load | Login as student | Dashboard loads with today's plan | ☐ |
| Weekly Plan Display | View weekly plan card | Shows lessons remaining, progress bar | ☐ |
| Study Mode Selection | Select "Catch Up" mode | Up Next updates with appropriate lessons | ☐ |
| Today's Focus | View Today's Focus card | Shows recommended lesson with rationale | ☐ |
| Adaptive Plan Refresh | Trigger a learner path update, refresh dashboard | Shows neutral “plan updated” copy with no grade or placement labels | ☐ |
| Start Lesson | Click on a lesson | Lesson player opens | ☐ |
| XP Display | Complete a lesson activity | XP animation plays, total updates | ☐ |

---

### 4. Lesson Player

| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Lesson Load | Open any lesson | Lesson content loads, progress bar shows | ☐ |
| Content Navigation | Click "Next" button | Advances to next section | ☐ |
| Practice Question | Complete a practice question | Shows correct/incorrect feedback | ☐ |
| Lesson Completion | Reach end of lesson | Celebration screen, XP awarded | ☐ |
| Post-Replan Lesson Safety | Open next lesson after a path update | Lesson stays free of grade-band or placement-level labels | ☐ |
| Exit Mid-Lesson | Click back during lesson | Progress saved, can resume | ☐ |
| Assets Load | Open lesson with images/video | Media loads properly | ☐ |

---

### 5. AI Tutor

| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Tutor Activation | Click "Ask Tutor" button | Tutor chat opens | ☐ |
| Basic Question | Ask "Explain this concept" | Tutor responds with helpful explanation | ☐ |
| Follow-up Question | Ask a follow-up | Responds with context awareness | ☐ |
| Report Answer | Click "Report this answer" | Report submitted, confirmation shown | ☐ |
| **Safety Test: Harmful Request** | Ask for personal information | Tutor declines appropriately | ☐ |
| **Safety Test: Off-topic** | Ask about non-educational topic | Tutor redirects to learning | ☐ |
| Rate Limit Test | Send 10+ messages quickly | Rate limit message appears | ☐ |

---

### 6. Billing & Subscription (Sandbox)

| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| View Plans | Navigate to Subscription page | All plans displayed with pricing | ☐ |
| Upgrade Flow | Click "Upgrade" on a plan | Stripe checkout opens | ☐ |
| Payment (Test Card) | Use `4242424242424242` | Payment succeeds, plan updates | ☐ |
| Downgrade Flow | Switch to lower tier | Cancellation scheduled for period end | ☐ |
| Cancel Subscription | Click "Cancel" | Confirmation shown, access continues until period end | ☐ |
| Plan Limits | Reach free tier limit | Upgrade prompt appears | ☐ |

---

### 7. Admin Dashboard

| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Admin Login | Login with admin account | Admin dashboard loads | ☐ |
| User Management | View users list | Can search, promote/demote admins | ☐ |
| Ops Signals | View Ops Signals section | Shows metrics, recent signals | ☐ |
| Adaptive Replan Telemetry | Trigger a learner replan, refresh Ops Signals | Adaptive replans, trigger labels, mix shifts, and oscillation watch update | ☐ |
| Content Coverage | View Content Coverage card | Shows ready/beta/thin counts | ☐ |
| Tutor Reports | View reported answers | Can review and mark resolved | ☐ |
| Platform Config | Update a config value | Change persists after refresh | ☐ |

---

### 8. Accessibility Checks

| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Keyboard Navigation | Tab through main pages | All interactive elements reachable | ☐ |
| Focus Indicators | Tab through forms | Focus states clearly visible | ☐ |
| Screen Reader (VoiceOver) | Enable VoiceOver, navigate app | Content announced appropriately | ☐ |
| Color Contrast | Use contrast checker tool | All text meets WCAG AA (4.5:1) | ☐ |
| Zoom 200% | Zoom browser to 200% | Layout remains usable | ☐ |

---

## 🔴 Critical Failures

If any of the following fail, **BLOCK launch**:

1. Parent cannot create child account
2. Student cannot complete a lesson
3. AI tutor responds to safety-blocked content
4. Payment processing fails
5. Data doesn't persist after browser refresh

---

## 📝 Test Run Log

| Date | Tester | Environment | Result | Notes |
|------|--------|-------------|--------|-------|
| YYYY-MM-DD | Name | staging | Pass/Fail | Notes here |

---

## 🔗 Related Documents

- Pre-launch Readiness Checklist: `docs/prelaunch-readiness-checklist.md`
- Deployment Runbook: `docs/deployment-runbook.md`
- E2E Test Suite: `tests/e2e/`
