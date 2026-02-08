import { describe, expect, it } from 'vitest';

import { getPracticeQuestionVisual, getSectionVisual } from '../lessonVisuals';

describe('lessonVisuals', () => {
  it('keeps deterministic perimeter visuals for math perimeter lessons', () => {
    const visual = getSectionVisual({
      lessonTitle: 'Perimeter Basics',
      subject: 'Mathematics',
      gradeBand: '2',
      sectionTitle: 'Rectangle perimeter',
      sectionContent: 'A rectangle is 4 feet tall and 2 feet wide. Perimeter = 4 + 2 + 4 + 2 = 12 feet.',
    });
    expect(visual).not.toBeNull();
    expect(visual?.alt).toContain('Rectangle');
    expect(visual?.svg.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('returns generalized K-5 visuals for non-perimeter math topics', () => {
    const placeValueVisual = getSectionVisual({
      lessonTitle: 'Place Value to 1,000',
      subject: 'Mathematics',
      gradeBand: '3',
      sectionTitle: 'Hundreds, tens, and ones',
      sectionContent: 'Write 472 in expanded form and explain each digit value.',
    });
    expect(placeValueVisual?.alt).toBe('Place value chart');

    const fractionVisual = getPracticeQuestionVisual({
      lessonTitle: 'Equivalent Fractions',
      subject: 'Mathematics',
      gradeBand: '4',
      prompt: 'Which fraction is equivalent to 2/6?',
    });
    expect(fractionVisual?.alt).toContain('Fraction bar model');
  });

  it('returns null outside K-5 math scope', () => {
    const nonMathVisual = getSectionVisual({
      lessonTitle: 'Reading Comprehension',
      subject: 'English',
      gradeBand: '4',
      sectionTitle: 'Main idea',
      sectionContent: 'Find the main idea and supporting details.',
    });
    expect(nonMathVisual).toBeNull();

    const upperGradeVisual = getPracticeQuestionVisual({
      lessonTitle: 'Algebra',
      subject: 'Mathematics',
      gradeBand: '8',
      prompt: 'Solve 2x + 3 = 11',
    });
    expect(upperGradeVisual).toBeNull();
  });
});
