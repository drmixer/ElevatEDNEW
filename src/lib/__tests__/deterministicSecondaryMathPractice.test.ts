import { describe, expect, it } from 'vitest';

import { getDeterministicSecondaryMathPracticeQuestion } from '../deterministicSecondaryMathPractice';

describe('getDeterministicSecondaryMathPracticeQuestion', () => {
  it('builds a functions fallback question from lesson context', () => {
    const question = getDeterministicSecondaryMathPracticeQuestion({
      lessonId: 210,
      lessonTitle: 'Functions (intro)',
      lessonContent: 'A function table maps each input to exactly one output. Use y = 2x + 3.',
    });

    expect(question.prompt).toMatch(/function y = 2x \+ 3/i);
    expect(question.options.some((option) => option.isCorrect)).toBe(true);
  });

  it('builds a ratio fallback question for unit-rate lessons', () => {
    const question = getDeterministicSecondaryMathPracticeQuestion({
      lessonId: 211,
      lessonTitle: 'Ratios and unit rates',
      lessonContent: 'A runner travels 24 miles in 4 hours.',
    });

    expect(question.prompt).toMatch(/unit rate/i);
    expect(question.explanation).toMatch(/divide/i);
  });
});

