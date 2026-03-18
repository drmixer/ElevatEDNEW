import { describe, expect, it } from 'vitest';

import { extractPerimeterDimensionsFromText, getPracticeQuestionVisual, getSectionVisual } from '../lessonVisuals';

const decodeSvg = (dataUrl: string): string => decodeURIComponent(dataUrl.split(',')[1] ?? '');

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

  it('extracts square and triangle dimensions from the lesson phrasing used in the pilot', () => {
    expect(
      extractPerimeterDimensionsFromText(
        'Suppose a square sandbox has sides that are each 3 feet long. Add 3 + 3 + 3 + 3 to find the perimeter.',
      ),
    ).toEqual({
      shape: 'square',
      a: 3,
      unit: 'feet',
    });

    expect(
      extractPerimeterDimensionsFromText(
        'Suppose a triangle has side lengths of 2 feet, 3 feet, and 4 feet. Add all the sides.',
      ),
    ).toEqual({
      shape: 'triangle',
      a: 2,
      b: 3,
      c: 4,
      unit: 'feet',
    });
  });

  it('preserves rectangle proportions in perimeter practice visuals', () => {
    const visual = getPracticeQuestionVisual({
      lessonTitle: 'Perimeter (intro) Launch Lesson',
      subject: 'Mathematics',
      gradeBand: '2',
      prompt: 'A rectangle is 4 feet long and 2 feet wide. What is the perimeter?',
    });
    expect(visual?.alt).toContain('Rectangle');

    const svg = decodeSvg(visual?.svg ?? '');
    const rectMatch = svg.match(/<rect x="[^"]+" y="[^"]+" width="(\d+)" height="(\d+)"/);
    expect(rectMatch).not.toBeNull();

    const width = Number.parseInt(rectMatch?.[1] ?? '0', 10);
    const height = Number.parseInt(rectMatch?.[2] ?? '0', 10);
    expect(width).toBeLessThan(height);
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
