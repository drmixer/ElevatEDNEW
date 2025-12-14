import { describe, expect, it } from 'vitest';

import { HttpError } from '../httpError.js';
import { isPlaceholderOptionText, validatePlacementQuestions } from '../placementValidation.js';

describe('placementValidation', () => {
  it('detects known placeholder option patterns', () => {
    expect(isPlaceholderOptionText('Correct answer (on-grade).')).toBe(true);
    expect(isPlaceholderOptionText('Common misconception.')).toBe(true);
    expect(isPlaceholderOptionText('Partially correct idea.')).toBe(true);
    expect(isPlaceholderOptionText('Off-topic choice.')).toBe(true);
    expect(isPlaceholderOptionText('')).toBe(true);
    expect(isPlaceholderOptionText('2')).toBe(false);
  });

  it('rejects questions with placeholder options', () => {
    expect(() =>
      validatePlacementQuestions(
        [
          {
            bankQuestionId: 1,
            prompt: 'Pick one',
            type: 'multiple_choice',
            options: [
              { id: 11, text: 'Correct answer (on-grade).', isCorrect: true },
              { id: 12, text: 'Common misconception.', isCorrect: false },
            ],
          },
        ],
        { assessmentId: 99 },
      ),
    ).toThrow(HttpError);
  });

  it('dedupes options and requires at least two meaningful choices', () => {
    const result = validatePlacementQuestions([
      {
        bankQuestionId: 2,
        prompt: 'What is 1+1?',
        type: 'multiple_choice',
        options: [
          { id: 21, text: ' 2 ', isCorrect: true },
          { id: 22, text: '2', isCorrect: false },
          { id: 23, text: '  ', isCorrect: false },
          { id: 24, text: '3', isCorrect: false },
        ],
      },
    ]);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]?.options.map((opt) => opt.text)).toEqual(['2', '3']);
  });

  it('rejects unsupported question types', () => {
    expect(() =>
      validatePlacementQuestions([
        {
          bankQuestionId: 3,
          prompt: 'Explain your reasoning.',
          type: 'essay',
          options: [],
        },
      ]),
    ).toThrow(HttpError);
  });
});

