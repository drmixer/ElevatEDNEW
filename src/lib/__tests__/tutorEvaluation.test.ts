import fixtures from '../../../docs/tutor-eval-fixtures.json';
import { describe, expect, it } from 'vitest';

import {
  evaluateTutorResponse,
  summarizeTutorEvalResults,
  type TutorEvalFixture,
} from '../tutorEvaluation';

const evalFixtures = fixtures as TutorEvalFixture[];

describe('evaluateTutorResponse', () => {
  it('passes a grounded hint that avoids answer leakage', () => {
    const fixture = evalFixtures.find((entry) => entry.id === 'math-practice-hint-no-leak');
    expect(fixture).toBeTruthy();

    const result = evaluateTutorResponse(
      fixture as TutorEvalFixture,
      'Let’s stay with the perimeter question. Start by counting how many equal sides the square has, then decide what operation matches going all the way around.',
    );

    expect(result.passed).toBe(true);
    expect(result.grounded).toBe(true);
    expect(result.avoidedAnswerLeak).toBe(true);
  });

  it('fails when a hint leaks the correct answer', () => {
    const fixture = evalFixtures.find((entry) => entry.id === 'math-practice-hint-no-leak');
    expect(fixture).toBeTruthy();

    const result = evaluateTutorResponse(
      fixture as TutorEvalFixture,
      'The perimeter of the square is 12, so pick that answer.',
    );

    expect(result.passed).toBe(false);
    expect(result.failures).toContain('answer_leak');
  });

  it('passes a safety refusal for unsafe requests', () => {
    const fixture = evalFixtures.find((entry) => entry.id === 'unsafe-off-topic-refusal');
    expect(fixture).toBeTruthy();

    const result = evaluateTutorResponse(
      fixture as TutorEvalFixture,
      "I can't help with that. I'm here for school-safe learning help, so ask a trusted adult if you need help with safety issues.",
    );

    expect(result.passed).toBe(true);
    expect(result.refusedUnsafe).toBe(true);
  });
});

describe('summarizeTutorEvalResults', () => {
  it('summarizes pass counts and rates', () => {
    const summary = summarizeTutorEvalResults([
      { fixtureId: 'a', passed: true, grounded: true, avoidedAnswerLeak: true, refusedUnsafe: true, failures: [] },
      { fixtureId: 'b', passed: false, grounded: true, avoidedAnswerLeak: false, refusedUnsafe: true, failures: ['answer_leak'] },
    ]);

    expect(summary.total).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.passRate).toBe(50);
    expect(summary.groundedCount).toBe(2);
    expect(summary.noLeakCount).toBe(1);
  });
});

