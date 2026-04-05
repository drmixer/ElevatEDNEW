import { describe, expect, it } from 'vitest';

import { isNonXpEventType } from '../xpService';

describe('isNonXpEventType', () => {
  it('marks tutor usefulness events as zero-XP events', () => {
    expect(isNonXpEventType('tutor_answered_in_lesson')).toBe(true);
    expect(isNonXpEventType('tutor_retried_after_hint')).toBe(true);
    expect(isNonXpEventType('tutor_answer_reported')).toBe(true);
  });

  it('does not mark core learning events as zero-XP events', () => {
    expect(isNonXpEventType('practice_answered')).toBe(false);
    expect(isNonXpEventType('lesson_completed')).toBe(false);
  });
});

