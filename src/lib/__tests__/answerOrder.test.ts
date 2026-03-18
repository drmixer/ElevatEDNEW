import { describe, expect, it } from 'vitest';

import { shufflePracticeOptions, shuffleStringsWithCorrectIndex } from '../answerOrder';

describe('answerOrder', () => {
  it('varies checkpoint answer positions across deterministic seeds', () => {
    const indices = [14370012, 14370022, 14370032, 14370042].map((seed) =>
      shuffleStringsWithCorrectIndex(
        ['Correct answer', 'Wrong one', 'Wrong two', 'Wrong three'],
        0,
        seed,
      ).correctIndex,
    );

    expect(new Set(indices).size).toBeGreaterThan(1);
  });

  it('varies practice answer positions across lesson-based seeds', () => {
    const baseOptions = [
      { id: 1, text: 'Correct answer', isCorrect: true },
      { id: 2, text: 'Wrong one', isCorrect: false },
      { id: 3, text: 'Wrong two', isCorrect: false },
      { id: 4, text: 'Wrong three', isCorrect: false },
    ];

    const indices = [848, 1437, 100, 101, 102].map((lessonId) =>
      shufflePracticeOptions(baseOptions, lessonId * 100 + 17).findIndex((option) => option.isCorrect),
    );

    expect(new Set(indices).size).toBeGreaterThan(1);
  });
});
