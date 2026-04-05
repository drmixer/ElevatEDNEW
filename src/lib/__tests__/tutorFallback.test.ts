import { describe, expect, it } from 'vitest';

import { buildTutorDeterministicFallback } from '../tutorFallback';

describe('buildTutorDeterministicFallback', () => {
  it('returns a grounded math practice hint when problem context exists', () => {
    const response = buildTutorDeterministicFallback({
      userMessage: 'I need help',
      helpMode: 'hint',
      lessonContext: {
        phase: 'practice',
        subject: 'Math',
        questionStem: 'What is the perimeter of a square with side length 3?',
        answerChoices: ['6', '9', '12'],
      },
      studentXp: 120,
      studentStreakDays: 4,
      studentStrengths: ['math'],
      studentWeaknesses: ['fractions'],
    });

    expect(response).toContain('What is the perimeter of a square with side length 3?');
    expect(response).toContain('A. 6');
    expect(response).toContain('Show me your first step');
  });

  it('falls back to a lesson-reading scaffold for learn context', () => {
    const response = buildTutorDeterministicFallback({
      userMessage: 'Explain this',
      helpMode: 'another_way',
      lessonContext: {
        phase: 'learn',
        lessonTitle: 'Photosynthesis',
        visibleText: 'Plants use sunlight to make food.',
      },
      studentXp: 40,
      studentStreakDays: 2,
      studentStrengths: ['science'],
      studentWeaknesses: ['writing'],
    });

    expect(response).toContain('Photosynthesis');
    expect(response).toContain('most important idea');
  });
});

