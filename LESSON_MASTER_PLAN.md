# ElevatED Lesson System Master Plan

> ⚠️ **Note:** This plan has been consolidated into **[MASTER_IMPROVEMENTS_PLAN.md](./MASTER_IMPROVEMENTS_PLAN.md)**. See that document for current status and roadmap. This file is retained for detailed implementation reference.

> **Goal:** Deliver a complete, high-quality lesson experience from UI to content
> 
> **Created:** December 17, 2024  
> **Status:** ✅ COMPLETE - All Content Quality Issues Resolved - See Master Plan
> **Last Updated:** December 18, 2024

---

## Executive Summary

This document consolidates all lesson-related initiatives into a single master plan. It covers:
1. **Lesson Player UI/UX** - The stepper-based lesson experience
2. **Content Quality** - Ensuring all lessons have appropriate, grade-level content
3. **Practice Questions** - Full coverage of interactive assessment
4. **Integration** - Tying everything together into a cohesive system

---

## Current State Assessment

### What's Working ✅
- New stepper-based lesson player implemented (Phases 1-7 of LESSON_REDESIGN_PLAN)
- Phase transition animations
- Keyboard navigation
- Accessibility features (ARIA, reduced motion)
- Content parser for markdown → structured lessons

### Critical Issues 🔴
| Issue | Impact | Status |
|-------|--------|--------|
| ~~60 critical content issues (grade-inappropriate)~~ | ~~Wrong content for grade level~~ | ✅ **Resolved** |
| ~~84% of lessons missing practice questions~~ | ~~Students can't practice~~ | ✅ **Resolved** (100% coverage) |
| ~~37% have placeholder vocabulary~~ | ~~"A key term related to..."~~ | ✅ **Resolved** (443 lessons fixed) |
| ~~52% have structure issues~~ | ~~Missing objectives/examples~~ | ✅ **Resolved** (617 lessons fixed) |
| ~~2% template content~~ | ~~Generic lesson text~~ | ✅ **Resolved** (25 lessons fixed) |
| ~~34 missing practice links~~ | ~~Skills with no questions~~ | ✅ **Resolved** (128 questions added) |

**🎉 FINAL AUDIT: 0 ISSUES REMAINING**

---

## Related Plan Documents

| Document | Focus Area | Status |
|----------|------------|--------|
| [LESSON_REDESIGN_PLAN.md](./LESSON_REDESIGN_PLAN.md) | UI/UX, Stepper, Phases | Phases 1-7 Complete |
| [CONTENT_QUALITY_PLAN.md](./CONTENT_QUALITY_PLAN.md) | Content Audit, Cleanup, Practice | Planning |

---

## Master Timeline & Priorities

### 🔴 Priority 1: Critical Content Fixes (Day 1-2)

**Goal:** Fix the 60 critical issues (grade-inappropriate content/images)

| Task | Status | Owner |
|------|--------|-------|
| Fix `add_lesson_images.ts` to filter by grade | ⬜ Not Started | |
| Remove inappropriate images from lessons | ✅ Done (77 lessons) | |
| Remove advanced concepts from lower grades | ✅ Done | |
| Re-run audit to verify | ✅ Done - 0 critical issues | |

**Deliverable:** ✅ Zero critical issues in audit report (2,335 → 2,275 issues, -60 critical)

---

### ✅ Priority 2: Practice Question Coverage (Days 2-5) - COMPLETE

**Goal:** Every lesson has at least 3-4 practice questions

| Task | Status | Owner |
|------|--------|-------|
| Create skill → lesson linkage script | ✅ Done (seed_practice_questions.ts) | |
| Seed authored practice items from JSON files | ✅ Done (3,156 questions) | |
| Generate questions for uncovered lessons | ✅ Done (generate_practice_for_all_lessons.ts) | |
| Update stepper to show practice phase | ✅ Done (Phase 7 complete) | |

**Deliverable:** ✅ 100% complete (1,190/1,190 lessons have practice questions, 23,969 total questions)

---

### ✅ Priority 3: Content Quality Cleanup (Days 3-7) - COMPLETE

**Goal:** All content is grade-appropriate with real vocabulary

| Task | Status | Owner |
|------|--------|-------|
| Replace placeholder vocabulary | ✅ Done (443 lessons, 2,215 replacements) | |
| Add missing learning objectives | ✅ Done (in structure fix) | |
| Add examples to lessons lacking them | ✅ Done (617 lessons fixed) | |
| Seed authored lesson content from JSON | ⬜ Not Started | |

**Deliverable:** ✅ 0% placeholder vocabulary, 100% have examples (59 total issues remaining: 34 false-positive practice, 25 template content)

---

### 🎨 Priority 4: Lesson Player Polish (Days 5-10)

**Goal:** Complete remaining UI/UX polish from LESSON_REDESIGN_PLAN

| Task | Status | Owner |
|------|--------|-------|
| Phase 3: Welcome & Learn phases | ✅ Complete | |
| Phase 4: Practice phase | ✅ Complete | |
| Phase 5: Review & Complete phases | ✅ Complete | |
| Performance optimization (lazy loading) | ⬜ Not Started | |
| Cross-browser testing | ⬜ Not Started | |
| Teacher/Facilitator view (Phase 8) | ⬜ Not Started | |
| User testing feedback | ⬜ Not Started | |

**Deliverable:** Polished, tested lesson player

---

### 📊 Priority 5: Ongoing Quality (Continuous)

**Goal:** Maintain content quality over time

| Task | Status | Owner |
|------|--------|-------|
| Quality dashboard in admin | ⬜ Not Started | |
| User feedback integration | ⬜ Not Started | |
| Monthly audit reviews | ⬜ Not Started | |
| CI/CD quality gates | ⬜ Not Started | |

**Deliverable:** Self-sustaining quality process

---

## Audit Results Summary

Run on: December 17, 2024

```
Total lessons: 1,190
Total issues found: 2,335
Lessons needing review: 1,190 (100%)

Issues by Type:
  missing_practice: 1,190 (100%)
  structure_issue: 617 (52%)
  placeholder_vocabulary: 443 (37%)
  grade_inappropriate: 39 (3%)
  template_content: 25 (2%)
  inappropriate_image: 21 (2%)

Issues by Severity:
  🔴 critical: 60
  ⚠️ high: 1,633
  📋 medium: 642
```

Full report: `data/audits/content_quality_report.json`

---

## Scripts & Tools

| Script | Purpose | Status |
|--------|---------|--------|
| `scripts/audit_content_quality.ts` | Analyze all lessons for issues | ✅ Created |
| `scripts/add_lesson_images.ts` | Add images to lessons | 🔧 Needs Grade Fix |
| `scripts/seed_lessons.ts` | Seed basic lessons | ✅ Exists |
| `scripts/seed_authored_launch_lessons.ts` | Seed quality authored content | ⬜ To Create |
| `scripts/link_lesson_skills.ts` | Link skills to lessons | ⬜ To Create |
| `scripts/generate_practice_questions.ts` | Generate practice Qs | ⬜ To Create |
| `scripts/cleanup_lesson_content.ts` | Fix placeholder content | ⬜ To Create |

---

## Data Sources

### Authored Lessons (High Quality)
Located in `data/lessons/`:
- `authored_launch_lessons.json` - 135KB, Math/Social Studies
- `ela_authored_launch_lessons.json` - 90KB, ELA specific
- `science_authored_launch_lessons.json` - 216KB, Science specific
- `arts_music_authored_launch_lessons.json` - 30KB
- `cs_authored_launch_lessons.json` - 29KB
- `health_pe_authored_launch_lessons.json` - 21KB
- `financial_literacy_authored_launch_lessons.json` - 15KB

### Practice Questions
Located in `data/practice/`:
- `authored_practice_items.json` - 694KB
- `science_authored_practice_items.json` - 825KB
- `ela_authored_practice_items.json` - 442KB
- Plus 10+ grade-specific question files

### Standards
Located in `data/standards/`:
- CCSS Math, ELA standards
- NGSS Science standards

---

## Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Lessons with practice questions | 0% | 100% | Day 5 |
| Critical content issues | 60 | 0 | Day 2 |
| Placeholder vocabulary | 37% | 0% | Day 7 |
| Lessons with objectives | 48% | 100% | Day 7 |
| User-reported issues | Unknown | <5/week | Week 2+ |
| Quality score ≥80% | Unknown | 95% | Week 2+ |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    LESSON PLAYER UI                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │ Welcome │→│  Learn  │→│Practice │→│ Review  │→│Complete │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
│       │           │           │           │           │      │
│  LessonStepperProvider (manages phase state)                 │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CONTENT LAYER                             │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ lessonContent-   │  │ Practice Questions               │ │
│  │ Parser.ts        │  │ (fetchLessonCheckQuestions)      │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────────┐│
│  │ modules │→│ lessons │→│ lesson_ │→│ question_skills     ││
│  │         │ │         │ │ skills  │ │ → question_bank     ││
│  └─────────┘ └─────────┘ └─────────┘ └─────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2024-12-17 | Use stepper-based lesson flow | Better engagement than scroll-based |
| 2024-12-17 | Skip practice phase if no questions | Graceful degradation |
| 2024-12-17 | Audit before fixing | Understand scope first |
| 2024-12-17 | Fix critical issues first | User-facing impact highest |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Practice Q generation quality | Students get poor questions | Review sample before bulk |
| Breaking changes during cleanup | Lessons become unavailable | Run in dry-run mode first |
| Performance with many lessons | Slow load times | Implement pagination, caching |
| Standards alignment | Wrong standards linked | Verify with curriculum team |

---

## Next Immediate Actions

1. **Fix `add_lesson_images.ts`** to be grade-appropriate
2. **Run cleanup script** to remove inappropriate images
3. **Create `link_lesson_skills.ts`** to establish skill connections
4. **Seed practice questions** from authored JSON files
5. **Update lesson player** to dynamically show/hide practice phase

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2024-12-17 | 1.0 | Initial master plan consolidating all lesson initiatives |

