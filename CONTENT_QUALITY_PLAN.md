# Content Quality Remediation Plan

> ⚠️ **Note:** This plan has been consolidated into **[MASTER_IMPROVEMENTS_PLAN.md](./MASTER_IMPROVEMENTS_PLAN.md)**. See that document for current status and roadmap. This file is retained for detailed implementation reference.

> **Goal:** Ensure all lessons across all grades and subjects have appropriate, grade-level content with proper learning materials and practice questions.
> 
> **Created:** December 17, 2024  
> **Status:** ✅ Major Items Complete - See Master Plan

---

## Executive Summary

An audit of lesson content revealed significant quality issues:
1. **Grade-inappropriate content** (e.g., Pythagorean theorem showing in Grade 1 lessons)
2. **Placeholder vocabulary definitions** (e.g., "A key term related to X")
3. **Missing practice questions** (lessons not linked to skills/questions)
4. **Template-generated content** that lacks real educational substance
5. **Random image selection** that doesn't consider grade level

This plan outlines a systematic approach to audit, remediate, and maintain content quality.

---

## Phase 1: Content Audit
**Estimated Time:** 2-4 hours  
**Priority:** Critical

### 1.1 Create Audit Scripts

#### Script 1: `audit_lesson_quality.ts`
Analyze all lessons and flag issues:
- [ ] Lessons with placeholder vocabulary ("A key term related to...")
- [ ] Lessons with grade-inappropriate content (regex patterns for advanced terms)
- [ ] Lessons missing learning objectives
- [ ] Lessons with generic/template summaries
- [ ] Lessons under minimum character count (too short)
- [ ] Lessons with no images or inappropriate images

#### Script 2: `audit_practice_coverage.ts`
Check practice question coverage:
- [ ] Modules with no associated skills
- [ ] Skills with no associated questions
- [ ] Lessons with no practice questions available
- [ ] Questions with placeholder prompts

#### Script 3: `audit_grade_appropriateness.ts`
Check grade-level alignment:
- [ ] Detect advanced vocabulary in lower grades (e.g., "Pythagorean" in K-5)
- [ ] Check reading level of content vs grade band
- [ ] Identify images with captions containing grade-inappropriate concepts
- [ ] Flag standard mismatches (standard grade vs lesson grade)

### 1.2 Generate Audit Reports

Create reports in `/data/audits/`:
- `lesson_quality_issues.json` - All flagged lessons with issue types
- `practice_coverage_gaps.json` - Missing practice questions by module
- `grade_alignment_issues.json` - Grade-inappropriate content
- `remediation_priority.json` - Prioritized list for remediation

---

## Phase 2: Fix Immediate Issues
**Estimated Time:** 4-6 hours  
**Priority:** Critical

### 2.1 Fix Image Selection Script

Update `/scripts/add_lesson_images.ts`:
- [ ] Add grade-level filtering to `EDUCATIONAL_IMAGES`
- [ ] Separate images by appropriate grade bands (K-2, 3-5, 6-8, 9-12)
- [ ] Never assign advanced images to lower grades
- [ ] Add `gradeAppropriate: ['K-2', '3-5']` metadata to each image

```typescript
// Example structure
const EDUCATIONAL_IMAGES = {
  'Mathematics': {
    'Geometry': {
      'K-2': [
        { url: '...', alt: 'Basic shapes', caption: 'Circles, squares, and triangles' }
      ],
      '3-5': [
        { url: '...', alt: 'Angles', caption: 'Types of angles' }  
      ],
      '6-8': [
        { url: '...', alt: 'Pythagorean theorem', caption: 'a² + b² = c²' }
      ]
    }
  }
}
```

### 2.2 Create Content Cleanup Script

`/scripts/cleanup_lesson_content.ts`:
- [ ] Remove inappropriate images from lessons
- [ ] Replace placeholder vocabulary with "Definition pending review"
- [ ] Add warning flag in lesson metadata: `{ needsReview: true }`
- [ ] Log all changes for review

### 2.3 Run Initial Cleanup

```bash
npx tsx scripts/audit_lesson_quality.ts --output data/audits/
npx tsx scripts/cleanup_lesson_content.ts --dry-run
npx tsx scripts/cleanup_lesson_content.ts --apply
```

---

## Phase 3: Content Generation Strategy
**Estimated Time:** 8-12 hours  
**Priority:** High

### 3.1 Define Grade-Appropriate Content Templates

Create subject-specific, grade-specific templates in `/data/templates/`:

```
data/templates/
├── mathematics/
│   ├── k-2.json     # Simple language, concrete examples
│   ├── 3-5.json     # Building on concepts, visual learning
│   ├── 6-8.json     # Abstract concepts, real-world applications
│   └── 9-12.json    # Advanced concepts, formal definitions
├── science/
│   ├── k-2.json
│   ├── 3-5.json
│   ├── 6-8.json
│   └── 9-12.json
└── ... (other subjects)
```

Each template includes:
- Age-appropriate vocabulary complexity
- Sentence length guidelines
- Example types (concrete vs abstract)
- Image style recommendations
- Interactive element suggestions

### 3.2 Vocabulary Definition Strategy

For each grade band, define vocabulary approach:

| Grade Band | Vocabulary Style |
|------------|------------------|
| K-2 | Simple 5-7 word definitions, examples from everyday life |
| 3-5 | 10-15 word definitions with one example |
| 6-8 | Precise definitions with context and usage |
| 9-12 | Academic definitions with etymology when relevant |

### 3.3 Content Generation Script

Create `/scripts/generate_lesson_content.ts`:
- [ ] Use grade-appropriate templates
- [ ] Generate vocabulary with real definitions
- [ ] Include age-appropriate examples
- [ ] Add interactive elements suggestions
- [ ] Generate practice question prompts

---

## Phase 4: Practice Question Coverage
**Estimated Time:** 6-8 hours  
**Priority:** High

### 4.1 Skill-Question Mapping

For every module, ensure:
- [ ] Module has at least 1 skill assigned
- [ ] Each skill has at least 4-6 questions
- [ ] Questions are grade-appropriate
- [ ] Questions have proper explanations

### 4.2 Question Generation Templates

Create templates for different question types:

```json
{
  "multiple_choice": {
    "structure": {
      "prompt": "Clear question with context",
      "options": ["4 distinct options", "1 correct", "3 plausible distractors"],
      "explanation": "Why the correct answer is right"
    }
  },
  "fill_in_blank": { ... },
  "matching": { ... },
  "short_answer": { ... }
}
```

### 4.3 Batch Question Generation

Create `/scripts/generate_practice_questions.ts`:
- [ ] Take module + skill as input
- [ ] Generate 4-6 contextual questions
- [ ] Include varied difficulty levels
- [ ] Add feedback for each answer option

### 4.4 Link Skills to Lessons

Create `/scripts/link_lesson_skills.ts`:
- [ ] Parse lesson content for key concepts
- [ ] Match to existing skills or create new ones
- [ ] Insert into `lesson_skills` table
- [ ] Verify question availability

---

## Phase 5: Authored Content Integration
**Estimated Time:** 4-6 hours  
**Priority:** High

### 5.1 Audit Existing Authored Content

The `/data/lessons/` folder has high-quality authored lessons:
- `authored_launch_lessons.json` - Well-structured lesson plans
- `ela_authored_launch_lessons.json` - ELA specific
- `science_authored_launch_lessons.json` - Science specific
- etc.

These have:
- Proper objectives
- Age-appropriate hooks
- Detailed instruction segments
- Materials lists

### 5.2 Seed Authored Content

Create `/scripts/seed_authored_lessons.ts`:
- [ ] Parse authored lesson JSON files
- [ ] Convert lesson outlines to full markdown content
- [ ] Generate grade-appropriate vocabulary from content
- [ ] Create associated practice questions
- [ ] Link to appropriate standards

### 5.3 Merge with Generated Content

- [ ] Replace template-generated lessons with authored content where available
- [ ] Mark remaining lessons as "Generated - Review Needed"
- [ ] Track authored vs generated lessons in metadata

---

## Phase 6: Quality Validation
**Estimated Time:** 2-3 hours  
**Priority:** High

### 6.1 Automated Quality Checks

Create `/scripts/validate_content_quality.ts`:

```typescript
const QUALITY_RULES = {
  vocabulary: {
    minDefinitionLength: 20,
    noPlaceholders: true,
    gradeAppropriate: true
  },
  lessonContent: {
    hasObjectives: true,
    minLength: 500,
    hasExamples: true,
    noAdvancedTermsInLowerGrades: true
  },
  practiceQuestions: {
    minPerLesson: 3,
    hasExplanations: true,
    correctOptionSet: true
  },
  images: {
    gradeAppropriate: true,
    hasAltText: true
  }
}
```

### 6.2 CI/CD Integration

Add quality checks to deployment pipeline:
- [ ] Pre-commit hooks for content changes
- [ ] CI step to validate new content
- [ ] Automated reports on content quality metrics

### 6.3 Quality Dashboard

Add to admin panel:
- [ ] Content quality score per subject/grade
- [ ] Practice question coverage percentage
- [ ] Lessons needing review count
- [ ] Recent quality trend

---

## Phase 7: Ongoing Maintenance
**Estimated Time:** Ongoing  
**Priority:** Medium

### 7.1 Content Review Workflow

1. **Flag for Review**: Lessons can be flagged by users or automation
2. **Review Queue**: Admin dashboard shows content needing review
3. **Edit & Approve**: Teacher/admin reviews and approves changes
4. **Quality Score**: Track improvements over time

### 7.2 User Feedback Loop

- [ ] Add "Report Content Issue" button to lessons
- [ ] Capture issue type (wrong grade level, missing content, errors)
- [ ] Route to appropriate review queue
- [ ] Track similar issues for bulk fixes

### 7.3 Regular Audits

Schedule monthly/quarterly:
- [ ] Re-run audit scripts
- [ ] Review new content additions
- [ ] Check practice question coverage
- [ ] Update quality metrics dashboard

---

## Implementation Priority

### Immediate (Day 1-2)
1. ✅ Fix LearnPhase button label (Done)
2. Create and run `audit_lesson_quality.ts`
3. Fix `add_lesson_images.ts` grade filtering
4. Run initial content cleanup

### Short-term (Week 1)
1. Implement skill-lesson linking
2. Generate missing practice questions for top 50 lessons
3. Seed authored lesson content
4. Create validation scripts

### Medium-term (Week 2-3)
1. Full practice question coverage
2. Replace all placeholder vocabulary
3. Quality dashboard in admin panel
4. User feedback integration

### Long-term (Ongoing)
1. CI/CD quality gates
2. Monthly audit reviews
3. Continuous content improvement
4. Teacher content contributions

---

## Database Schema Considerations

### New Tables/Columns Needed

```sql
-- Add quality metadata to lessons
ALTER TABLE lessons ADD COLUMN quality_score INTEGER;
ALTER TABLE lessons ADD COLUMN needs_review BOOLEAN DEFAULT false;
ALTER TABLE lessons ADD COLUMN review_notes TEXT;
ALTER TABLE lessons ADD COLUMN content_source VARCHAR(50); -- 'generated', 'authored', 'mixed'

-- Content issues tracking
CREATE TABLE content_issues (
  id SERIAL PRIMARY KEY,
  lesson_id INTEGER REFERENCES lessons(id),
  issue_type VARCHAR(50),
  issue_description TEXT,
  reported_by UUID REFERENCES users(id),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ensure lesson-skill linkage
-- (lesson_skills table should already exist)
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Lessons with practice questions | ~10% | 100% |
| Lessons with placeholder vocabulary | ~80% | 0% |
| Grade-appropriate content | ~60% | 100% |
| Quality score ≥ 80 | Unknown | 95% |
| User-reported content issues | Unknown | < 5/week |

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2024-12-17 | 1.0 | Initial plan created |

---

## Next Steps

1. **Create audit script** - Start with `audit_lesson_quality.ts`
2. **Run initial audit** - Generate comprehensive reports
3. **Fix critical issues** - Grade-inappropriate images, placeholder text
4. **Seed quality content** - Use existing authored lessons
5. **Generate practice questions** - Fill coverage gaps
