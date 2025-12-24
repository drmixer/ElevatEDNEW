# ElevatED Platform Remediation Plan

> **Created:** December 24, 2024
> **Status:** Active
> **Goal:** Transform ElevatED into a clean, intuitive, and truly helpful learning platform

---

## Executive Summary

The platform has accumulated technical debt and design complexity that undermines the user experience. This plan addresses three major areas:

1. **Dashboard Simplification** - Reduce clutter, focus on what matters
2. **Content Quality** - Fix lesson content, questions, and grade alignment
3. **Lesson Experience** - Ensure the learning flow is intuitive

---

## Priority 1: Dashboard Simplification (Critical)

### Current State
- ParentDashboard.tsx: **7,315 lines** (massively over-engineered)
- StudentDashboard.tsx: **5,213 lines** (same problem)
- Too many cards, sections, and features competing for attention

### Vision
A clean, focused dashboard that answers these questions instantly:
- **Student**: "What should I work on next?" + "How am I doing?"
- **Parent**: "How is my child doing?" + "What can I do to help?"

### Action Items

#### 1.1 Student Dashboard Redesign
- [ ] **Reduce to 3 primary sections:**
  1. **Today's Focus** - The ONE lesson/activity to do next
  2. **Progress Snapshot** - Simple XP, streak, mastery percentage
  3. **Recent Activity** - Quick wins and celebration moments
  
- [ ] **Remove or collapse:**
  - Complex weekly planning controls
  - Study mode selection (move to settings)
  - Elective emphasis toggles
  - Mix-in mode controls
  - Multiple overlapping stats cards
  
- [ ] **Implementation approach:**
  - Create new `StudentDashboardSimplified.tsx` (~500 lines max)
  - Move helper functions to `src/lib/dashboard/`
  - Use feature flag to swap between old/new

#### 1.2 Parent Dashboard Redesign
- [ ] **Reduce to 3 primary sections:**
  1. **Child Overview Cards** - One clean card per child with key stats
  2. **Alerts & Actions** - Only show if attention needed
  3. **Weekly Summary** - High-level progress graph

- [ ] **Remove or collapse:**
  - Granular goal-setting controls (move to dedicated settings page)
  - Tutor controls panel (move to child settings)
  - Privacy/concern forms (move to account settings)
  - Billing details (move to billing page)

- [ ] **Implementation approach:**
  - Create new `ParentDashboardSimplified.tsx` (~800 lines max)
  - Extract modals to separate files
  - Create `src/pages/ParentSettingsPage.tsx` for advanced controls

---

## Priority 2: Content Quality Fix (High)

### Current State
- ~80% lessons have placeholder vocabulary
- ~10% lessons have practice questions
- Grade-inappropriate content (advanced topics in lower grades)
- Questions/answers that don't make sense

### Action Items

#### 2.1 Audit Existing Content
- [ ] Run content quality audit script
- [ ] Generate reports:
  - Lessons with placeholder text
  - Lessons with no practice questions
  - Grade mismatches

#### 2.2 Fix Diagnostic Assessments
- [ ] Audit all diagnostic JSON files for:
  - Questions appropriate to grade level
  - Sensible answer options (no obvious wrong answers)
  - Clear, unambiguous prompts
  
- [ ] Create validation script to check:
  - Difficulty 1-2 questions have simple language for K-2
  - No advanced vocabulary in lower grade diagnostics
  - All correct answers are definitively correct

#### 2.3 Fix Lesson Content
- [ ] Prioritize the first 20 lessons per subject/grade
- [ ] For each lesson ensure:
  - Real vocabulary definitions (not placeholders)
  - Age-appropriate language
  - Relevant examples
  - At least 5 practice questions

#### 2.4 Practice Question Quality
- [ ] Review all questions in `/data/practice/` folder
- [ ] Fix issues:
  - Ambiguous prompts → Clear, specific questions
  - Easy distractors → Plausible wrong answers
  - Missing explanations → Add why each answer is correct/wrong

---

## Priority 3: Lesson Experience Polish (Medium)

### Current State
- Lesson stepper UI exists (LESSON_REDESIGN_PLAN.md mostly complete)
- But content quality undermines the experience

### Action Items
- [ ] Verify lesson stepper phases work correctly
- [ ] Fix any remaining navigation bugs
- [ ] Ensure mobile responsiveness
- [ ] Add loading states for slow content

---

## Implementation Order

### Sprint 1 (Days 1-2): Foundation ✅ COMPLETE
1. ✅ Fix runtime crash (null safety in StudentDashboard)
2. ✅ Create simplified dashboard prototypes (mockups approved)
3. ✅ Get user approval on dashboard layout

### Sprint 2 (Days 3-4): Dashboard Simplification ✅ IN PROGRESS
1. ✅ Build StudentDashboardSimplified component (~560 lines)
2. ✅ Build ParentDashboardSimplified component (~485 lines)
3. ✅ Add feature flag to switch (`USE_SIMPLIFIED_DASHBOARDS = true`)
4. 🔄 Testing with real data - found subject mislabeling issue

### Sprint 3 (Days 5-7): Content Quality 🔄 IN PROGRESS
1. 🔄 Run content audits
2. ✅ Fixed Maya grandmother's farm assessment question (diagnostics_grades35.json)
3. ✅ Created subject mislabeling detection script (scripts/fix_subject_mislabeling.ts)
4. [ ] Fix top 20 lessons per grade
5. [ ] Add practice questions to priority lessons

### Sprint 4 (Day 8+): Polish
1. [ ] Full user testing
2. [ ] Bug fixes
3. [ ] Performance optimization
4. [ ] Add tutor persona settings to Settings page

---

## Design Principles Going Forward

1. **Less is more** - Every element must earn its place
2. **One action at a time** - Guide users, don't overwhelm
3. **Content quality over quantity** - 50 great lessons > 500 mediocre ones
4. **Mobile-first** - Most learners are on phones/tablets
5. **Celebrate progress** - Make learning feel rewarding

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Dashboard load time | Unknown | < 2s |
| Lines of code (StudentDashboard) | 5,213 | < 800 |
| Lines of code (ParentDashboard) | 7,315 | < 1,000 |
| Lessons with real vocabulary | ~20% | 100% |
| Lessons with 5+ questions | ~10% | 100% |
| Grade-appropriate content | ~60% | 100% |

---

## Files to Create

### New Dashboard Components
- `src/components/Student/StudentDashboardSimplified.tsx`
- `src/components/Parent/ParentDashboardSimplified.tsx`

### Dashboard Helper Libraries
- `src/lib/dashboard/studentHelpers.ts`
- `src/lib/dashboard/parentHelpers.ts`
- `src/lib/dashboard/statsFormatters.ts`

### Content Audit Scripts
- `scripts/audit/auditLessons.ts`
- `scripts/audit/auditDiagnostics.ts`
- `scripts/audit/auditPracticeQuestions.ts`

---

## Next Steps

**Immediate question for you:** Would you like me to:

**A) Start with dashboard simplification** - Create cleaner dashboard designs first

**B) Start with content fixes** - Fix the diagnostic questions and lesson content first

**C) Show you a design mockup** - Generate images of what the simplified dashboards could look like

The choice depends on what feels most broken to you right now. If users are bouncing because the dashboards are overwhelming, start with A. If users are confused by bad questions/content, start with B.
