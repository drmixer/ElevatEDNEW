import { describe, expect, it } from 'vitest';

import { buildBlendedLearningPath } from './learningPaths';

describe('buildBlendedLearningPath', () => {
  it('keeps math and english moving while mixing in science at the nominal grade', () => {
    const path = buildBlendedLearningPath({
      nominalGrade: 6,
      placements: [
        { subject: 'math', expectedLevel: 6, workingLevel: 6 },
        { subject: 'english', expectedLevel: 6, workingLevel: 6 },
      ],
      limit: 4,
    });

    expect(path).toHaveLength(4);
    expect(path.map((item) => item.subject)).toEqual(['math', 'english', 'science', 'social_studies']);
    expect(path[2]?.pathSource).toBe('cross_subject_access');
    expect(path[2]?.themeGrade).toBe(6);
    expect(path[2]?.accessibilityLevel).toBe(6);
    expect(path[3]?.pathSource).toBe('cross_subject_access');
    expect(path[3]?.themeGrade).toBe(6);
    expect(path[3]?.accessibilityLevel).toBe(6);
  });

  it('gives extra slots to the lagging subject when the gap is material', () => {
    const path = buildBlendedLearningPath({
      nominalGrade: 6,
      placements: [
        { subject: 'math', expectedLevel: 6, workingLevel: 4 },
        { subject: 'english', expectedLevel: 6, workingLevel: 6 },
      ],
      limit: 5,
    });

    expect(path).toHaveLength(5);
    expect(path.map((item) => item.subject)).toEqual([
      'math',
      'math',
      'english',
      'science',
      'social_studies',
    ]);
  });

  it('fills the missing core subject from nominal grade when only one placement exists', () => {
    const path = buildBlendedLearningPath({
      nominalGrade: 7,
      placements: [{ subject: 'math', expectedLevel: 7, workingLevel: 5 }],
      limit: 4,
    });

    expect(path).toHaveLength(4);
    expect(path.some((item) => item.subject === 'english')).toBe(true);
    expect(path.some((item) => item.subject === 'math')).toBe(true);
    expect(path.some((item) => item.subject === 'science')).toBe(true);
  });

  it('builds a blended grade 4 path with contextual science and social studies support', () => {
    const path = buildBlendedLearningPath({
      nominalGrade: 4,
      placements: [
        { subject: 'math', expectedLevel: 4, workingLevel: 2 },
        { subject: 'english', expectedLevel: 4, workingLevel: 4 },
      ],
      limit: 6,
    });

    expect(path).toHaveLength(6);
    expect(path.map((item) => item.subject)).toEqual([
      'math',
      'math',
      'english',
      'science',
      'social_studies',
      'math',
    ]);

    const scienceEntry = path.find((item) => item.subject === 'science');
    const socialStudiesEntry = path.find((item) => item.subject === 'social_studies');
    expect(scienceEntry?.themeGrade).toBe(4);
    expect(scienceEntry?.accessibilityLevel).toBe(4);
    expect(scienceEntry?.pathSource).toBe('cross_subject_access');
    expect(socialStudiesEntry?.themeGrade).toBe(4);
    expect(socialStudiesEntry?.accessibilityLevel).toBe(4);
    expect(socialStudiesEntry?.pathSource).toBe('cross_subject_access');
  });

  it('mixes in social studies at the nominal grade when canonical paths exist', () => {
    const path = buildBlendedLearningPath({
      nominalGrade: 8,
      placements: [
        { subject: 'math', expectedLevel: 8, workingLevel: 8 },
        { subject: 'english', expectedLevel: 8, workingLevel: 6 },
      ],
      limit: 6,
    });

    const socialStudiesEntry = path.find((item) => item.subject === 'social_studies');
    expect(socialStudiesEntry).toBeTruthy();
    expect(socialStudiesEntry?.pathSource).toBe('cross_subject_access');
    expect(socialStudiesEntry?.themeGrade).toBe(8);
    expect(socialStudiesEntry?.accessibilityLevel).toBe(6);
  });
});
