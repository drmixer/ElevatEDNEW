import { describe, expect, it } from 'vitest';

import {
  getDeterministicNonMathChallengeQuestion,
  getDeterministicNonMathHint,
  getDeterministicNonMathQuickReview,
  getDeterministicNonMathSteps,
  getNonMathRemediationSubject,
  getNonMathRemediationTopic,
} from '../nonMathRemediation';

describe('nonMathRemediation', () => {
  it('detects supported high-traffic non-math subjects', () => {
    expect(getNonMathRemediationSubject('English Language Arts')).toBe('english');
    expect(getNonMathRemediationSubject('Science')).toBe('science');
    expect(getNonMathRemediationSubject('Social Studies')).toBe('social_studies');
    expect(getNonMathRemediationSubject('Mathematics')).toBeNull();
  });

  it('detects deterministic topic templates from lesson context', () => {
    expect(
      getNonMathRemediationTopic({
        subject: 'english',
        lessonTitle: 'Using Context Clues to Decode Vocabulary',
      }),
    ).toBe('context_clues');

    expect(
      getNonMathRemediationTopic({
        subject: 'science',
        lessonTitle: 'Food Webs in Ecosystems',
      }),
    ).toBe('ecosystems');

    expect(
      getNonMathRemediationTopic({
        subject: 'social_studies',
        lessonTitle: 'Branches of Government',
      }),
    ).toBe('civics');
  });

  it('returns deterministic quick review and hint content', () => {
    const quickReview = getDeterministicNonMathQuickReview({
      subject: 'english',
      lessonTitle: 'Main Idea and Supporting Details',
      questionPrompt: 'Which sentence states the main idea?',
    });
    expect(quickReview).not.toBeNull();
    expect(quickReview?.topic).toBe('main_idea');
    expect(quickReview?.options.length).toBeGreaterThanOrEqual(3);
    expect((quickReview?.correctIndex ?? -1) >= 0).toBe(true);

    const hint = getDeterministicNonMathHint({
      subject: 'science',
      lessonTitle: 'Scientific Method Basics',
    });
    expect(typeof hint).toBe('string');
    expect((hint ?? '').length).toBeGreaterThan(10);
  });

  it('returns deterministic scaffold steps and challenge questions', () => {
    const steps = getDeterministicNonMathSteps({
      subject: 'social_studies',
      lessonTitle: 'Map Skills and Compass Directions',
    });
    expect(steps).toBeTruthy();
    expect((steps ?? []).length).toBeGreaterThanOrEqual(3);

    const challenge = getDeterministicNonMathChallengeQuestion({
      lessonId: 42,
      subject: 'social_studies',
      lessonTitle: 'Map Skills and Compass Directions',
      questionPrompt: 'What does a map legend show?',
    });
    expect(challenge).not.toBeNull();
    expect(challenge?.id).toBe(980_848);
    expect(challenge?.options.length).toBe(4);
    expect(challenge?.options.some((option) => option.isCorrect)).toBe(true);
  });
});
