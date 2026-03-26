import { describe, expect, it } from 'vitest';

import { deriveExpectedLevel, deriveWorkingLevelEstimate } from '../learningPaths.js';

describe('learningPaths placement helpers', () => {
  it('derives expected level from age and grade with clamping', () => {
    expect(deriveExpectedLevel({ ageYears: 13, gradeLevel: 6 })).toBe(7);
    expect(deriveExpectedLevel({ ageYears: 8, gradeLevel: null })).toBe(3);
    expect(deriveExpectedLevel({ ageYears: null, gradeLevel: 10 })).toBe(8);
  });

  it('derives working level from tested question levels and strand evidence', () => {
    const estimate = deriveWorkingLevelEstimate({
      expectedLevel: 6,
      responsesForScoring: [
        {
          isCorrect: true,
          question: {
            id: 'q1',
            bankQuestionId: 1,
            prompt: 'Question 1',
            type: 'multiple_choice',
            options: [],
            weight: 1,
            difficulty: 3,
            strand: 'ratios',
            targetStandards: ['6.RP.A.1'],
            metadata: { placement_level: 6 },
          },
        },
        {
          isCorrect: true,
          question: {
            id: 'q2',
            bankQuestionId: 2,
            prompt: 'Question 2',
            type: 'multiple_choice',
            options: [],
            weight: 1,
            difficulty: 3,
            strand: 'ratios',
            targetStandards: ['6.RP.A.2'],
            metadata: { placement_level: 6 },
          },
        },
        {
          isCorrect: true,
          question: {
            id: 'q3',
            bankQuestionId: 3,
            prompt: 'Question 3',
            type: 'multiple_choice',
            options: [],
            weight: 1,
            difficulty: 3,
            strand: 'expressions',
            targetStandards: ['7.EE.A.1'],
            metadata: { placement_level: 7 },
          },
        },
        {
          isCorrect: false,
          question: {
            id: 'q4',
            bankQuestionId: 4,
            prompt: 'Question 4',
            type: 'multiple_choice',
            options: [],
            weight: 1,
            difficulty: 3,
            strand: 'expressions',
            targetStandards: ['7.EE.A.1'],
            metadata: { placement_level: 7 },
          },
        },
        {
          isCorrect: false,
          question: {
            id: 'q5',
            bankQuestionId: 5,
            prompt: 'Question 5',
            type: 'multiple_choice',
            options: [],
            weight: 1,
            difficulty: 3,
            strand: 'geometry',
            targetStandards: ['7.G.A.1'],
            metadata: { placement_level: 8 },
          },
        },
        {
          isCorrect: false,
          question: {
            id: 'q6',
            bankQuestionId: 6,
            prompt: 'Question 6',
            type: 'multiple_choice',
            options: [],
            weight: 1,
            difficulty: 3,
            strand: 'geometry',
            targetStandards: ['7.G.A.1'],
            metadata: { placement_level: 8 },
          },
        },
      ],
    });

    expect(estimate.workingLevel).toBe(6);
    expect(estimate.levelConfidence).toBe(0.65);
    expect(estimate.weakStandardCodes).toContain('7.G.A.1');
    expect(estimate.strandEstimates.find((entry) => entry.strand === 'ratios')?.accuracyPct).toBe(100);
  });
});
