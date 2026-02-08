import { describe, expect, it } from 'vitest';

import {
  getDeterministicK5MathChallengeQuestion,
  getDeterministicK5MathCheckpoint,
  getDeterministicK5MathHint,
  getDeterministicK5MathQuickReview,
  getDeterministicK5MathSteps,
  getK5MathAdaptationTopic,
  getK5MathCheckpointHint,
  isK5MathAdaptiveLesson,
} from '../k5MathAdaptation';

describe('k5MathAdaptation', () => {
  it('detects K-5 math topics by lesson context', () => {
    expect(
      getK5MathAdaptationTopic({
        subject: 'Mathematics',
        gradeBand: '4',
        lessonTitle: 'Equivalent Fractions',
      }),
    ).toBe('fractions');

    expect(
      getK5MathAdaptationTopic({
        subject: 'Mathematics',
        gradeBand: '3',
        lessonTitle: 'Multiplication Arrays',
      }),
    ).toBe('multiplication_division');

    expect(
      getK5MathAdaptationTopic({
        subject: 'Mathematics',
        gradeBand: '5',
        lessonTitle: 'Line Plots and Data',
      }),
    ).toBe('data_graphing');
  });

  it('is limited to K-5 math lessons', () => {
    expect(
      getK5MathAdaptationTopic({
        subject: 'Science',
        gradeBand: '4',
        lessonTitle: 'Weather Patterns',
      }),
    ).toBeNull();
    expect(
      getK5MathAdaptationTopic({
        subject: 'Mathematics',
        gradeBand: '6',
        lessonTitle: 'Ratios',
      }),
    ).toBeNull();
    expect(
      isK5MathAdaptiveLesson({
        subject: 'Mathematics',
        gradeBand: '5',
        lessonTitle: 'Area and Perimeter',
      }),
    ).toBe(true);
  });

  it('returns deterministic support artifacts', () => {
    const quickReview = getDeterministicK5MathQuickReview({
      lessonId: 42,
      subject: 'Mathematics',
      gradeBand: '4',
      lessonTitle: 'Equivalent Fractions',
      questionPrompt: 'Which fraction is equivalent to 2/4?',
      topic: 'fractions',
    });
    expect(quickReview?.topic).toBe('fractions');
    expect(quickReview?.options.length).toBeGreaterThanOrEqual(3);

    const hint = getDeterministicK5MathHint({
      subject: 'Mathematics',
      gradeBand: '4',
      lessonTitle: 'Equivalent Fractions',
      topic: 'fractions',
    });
    expect(hint).toContain('numerator');

    const steps = getDeterministicK5MathSteps({
      subject: 'Mathematics',
      gradeBand: '4',
      lessonTitle: 'Equivalent Fractions',
      topic: 'fractions',
    });
    expect((steps ?? []).length).toBeGreaterThanOrEqual(3);

    const challenge = getDeterministicK5MathChallengeQuestion({
      lessonId: 42,
      subject: 'Mathematics',
      gradeBand: '4',
      lessonTitle: 'Equivalent Fractions',
      questionPrompt: 'Find an equivalent fraction.',
      topic: 'fractions',
    });
    expect(challenge?.id).toBe(970_844);
    expect(challenge?.options.length).toBe(4);
    expect(challenge?.options.some((option) => option.isCorrect)).toBe(true);
  });

  it('returns deterministic checkpoint questions by intent', () => {
    const checkpoint = getDeterministicK5MathCheckpoint({
      subject: 'Mathematics',
      gradeBand: '4',
      lessonTitle: 'Equivalent Fractions',
      lessonContent: 'Find equivalent fractions for 2/5.',
      topic: 'fractions',
      intent: 'compute',
      seed: 123,
    });
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.options.length).toBeGreaterThanOrEqual(3);
    expect(checkpoint?.correctIndex).toBeGreaterThanOrEqual(0);
    expect(checkpoint?.question.toLowerCase()).toContain('fraction');

    const scenarioCheckpoint = getDeterministicK5MathCheckpoint({
      subject: 'Mathematics',
      gradeBand: '3',
      lessonTitle: 'Multiplication and Division',
      lessonContent: 'Use equal groups to solve problems.',
      topic: 'multiplication_division',
      intent: 'scenario',
      seed: 456,
    });
    expect(scenarioCheckpoint?.question.toLowerCase()).toContain('groups');
  });

  it('returns deterministic checkpoint hints', () => {
    const computeHint = getK5MathCheckpointHint({
      subject: 'Mathematics',
      gradeBand: '4',
      lessonTitle: 'Equivalent Fractions',
      topic: 'fractions',
      intent: 'compute',
    });
    expect(computeHint).toContain('numerator');

    const fallbackHint = getK5MathCheckpointHint({
      subject: 'Mathematics',
      gradeBand: '5',
      lessonTitle: 'Area and Perimeter',
      topic: 'geometry_perimeter_area',
      intent: 'define',
    });
    expect(fallbackHint).toContain('Perimeter');
  });
});
