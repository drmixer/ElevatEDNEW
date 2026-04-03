import { describe, expect, it } from 'vitest';

import { parseProfileLearningPath, projectProfileLearningPathEntries } from '../learningPathProjection.js';

describe('learningPathProjection', () => {
  it('parses valid profile learning path items and drops incomplete rows', () => {
    const items = parseProfileLearningPath([
      { id: '6-math-fractions', subject: 'math', topic: 'Fractions', status: 'not_started' },
      { id: '', subject: 'english', topic: 'Reading' },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: '6-math-fractions',
      subject: 'math',
      topic: 'Fractions',
      concept: 'adaptive_path',
    });
  });

  it('projects profile path items into synthetic path entries with metadata', () => {
    const entries = projectProfileLearningPathEntries(
      [
        {
          id: '123',
          subject: 'science',
          topic: 'Plate Tectonics',
          concept: 'cross_subject_access',
          difficulty: 15,
          status: 'mastered',
          xpReward: 60,
          moduleSlug: '6-science-earth-and-space-plate-tectonics',
          standardCodes: ['MS-ESS2-3'],
          pathSource: 'cross_subject_access',
          accessibilityLevel: 6,
          themeGrade: 7,
        },
      ],
      {
        pathId: 42,
        createdAt: '2026-04-02T00:00:00.000Z',
        updatedAt: '2026-04-02T00:00:00.000Z',
      },
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: -1,
      path_id: 42,
      lesson_id: 123,
      status: 'completed',
      target_standard_codes: ['MS-ESS2-3'],
      metadata: expect.objectContaining({
        module_title: 'Plate Tectonics',
        reason: 'cross_subject_access',
        accessibility_level: 6,
        theme_grade: 7,
      }),
    });
  });
});
