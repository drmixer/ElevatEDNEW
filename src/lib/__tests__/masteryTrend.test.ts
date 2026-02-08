import { describe, expect, it } from 'vitest';

import { evaluateMasteryTrend } from '../masteryTrend';

describe('masteryTrend', () => {
  it('recommends acceleration when accuracy and trajectory are strong', () => {
    const result = evaluateMasteryTrend({
      attempts: [
        { isCorrect: true, usedHint: false },
        { isCorrect: true, usedHint: false },
        { isCorrect: true, usedHint: false },
        { isCorrect: false, usedHint: false },
        { isCorrect: true, usedHint: false },
      ],
      questionCount: 5,
      quickReviewShown: false,
      quickReviewCorrect: null,
    });

    expect(result.recommendation).toBe('accelerate');
    expect(result.shouldOfferChallenge).toBe(true);
    expect(result.shouldTriggerQuickReview).toBe(false);
  });

  it('recommends review when misses and hints indicate struggle', () => {
    const result = evaluateMasteryTrend({
      attempts: [
        { isCorrect: false, usedHint: true },
        { isCorrect: false, usedHint: true },
        { isCorrect: true, usedHint: true },
      ],
      questionCount: 4,
      quickReviewShown: false,
      quickReviewCorrect: null,
    });

    expect(result.recommendation).toBe('review');
    expect(result.shouldTriggerQuickReview).toBe(true);
    expect(result.shouldOfferChallenge).toBe(false);
  });

  it('falls back to steady when signals are mixed', () => {
    const result = evaluateMasteryTrend({
      attempts: [
        { isCorrect: true, usedHint: false },
        { isCorrect: false, usedHint: true },
        { isCorrect: true, usedHint: true },
        { isCorrect: true, usedHint: false },
      ],
      questionCount: 4,
      quickReviewShown: false,
      quickReviewCorrect: null,
    });

    expect(result.recommendation).toBe('steady');
    expect(result.shouldOfferChallenge).toBe(false);
    expect(result.shouldTriggerQuickReview).toBe(false);
  });

  it('suppresses repeated review trigger after successful quick review', () => {
    const result = evaluateMasteryTrend({
      attempts: [
        { isCorrect: false, usedHint: true },
        { isCorrect: true, usedHint: true },
        { isCorrect: true, usedHint: false },
      ],
      questionCount: 4,
      quickReviewShown: true,
      quickReviewCorrect: true,
    });

    expect(result.shouldTriggerQuickReview).toBe(false);
  });
});
