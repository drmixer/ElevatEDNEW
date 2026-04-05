import { describe, expect, it } from 'vitest';

import { shouldTrackTutorRetryAfterHint } from '../tutorTelemetry';

describe('shouldTrackTutorRetryAfterHint', () => {
  it('returns true for a recent practice hint on the same lesson and question', () => {
    expect(
      shouldTrackTutorRetryAfterHint(
        {
          lessonId: 12,
          phase: 'practice',
          questionStem: 'What is 3 + 4?',
          helpMode: 'hint',
          deliveryMode: 'ai_direct',
          timestamp: 1_000,
        },
        { lessonId: 12, questionStem: 'What is 3 + 4?', now: 2_000 },
      ),
    ).toBe(true);
  });

  it('returns false when the hint is stale or for a different question', () => {
    expect(
      shouldTrackTutorRetryAfterHint(
        {
          lessonId: 12,
          phase: 'practice',
          questionStem: 'What is 3 + 4?',
          helpMode: 'break_down',
          deliveryMode: 'deterministic_fallback',
          timestamp: 1_000,
        },
        { lessonId: 12, questionStem: 'What is 5 + 4?', now: 2_000 },
      ),
    ).toBe(false);

    expect(
      shouldTrackTutorRetryAfterHint(
        {
          lessonId: 12,
          phase: 'practice',
          questionStem: 'What is 3 + 4?',
          helpMode: 'another_way',
          deliveryMode: 'ai_direct',
          timestamp: 1_000,
        },
        { lessonId: 12, questionStem: 'What is 3 + 4?', now: 1_000 + 10 * 60 * 1000 + 1 },
      ),
    ).toBe(false);
  });
});

