import { describe, expect, it } from 'vitest';

import {
  buildSubjectSignalSnapshot,
  deriveExpectedLevel,
  deriveWorkingLevelEstimate,
  hasStableSignalCluster,
} from '../learningPaths.js';

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

  it('marks a core subject for support when live accuracy and mastery stay low', () => {
    const signal = buildSubjectSignalSnapshot({
      subject: 'math',
      state: {
        id: 1,
        student_id: 'student-1',
        subject: 'math',
        expected_level: 6,
        working_level: 4,
        level_confidence: 0.7,
        placement_status: 'completed',
        diagnostic_assessment_id: 10,
        diagnostic_attempt_id: 20,
        diagnostic_completed_at: '2026-04-01T00:00:00.000Z',
        strand_scores: {},
        weak_standard_codes: ['6.NS.A.1'],
        recommended_module_slugs: [],
        last_path_id: 3,
        metadata: {},
        created_at: '2026-04-01T00:00:00.000Z',
        updated_at: '2026-04-01T00:00:00.000Z',
      },
      masteryPct: 59,
      events: [
        {
          subject: 'math',
          eventType: 'practice_answered',
          createdAt: '2026-04-03T09:00:00.000Z',
          accuracy: 0,
          standards: ['6.NS.A.1'],
          completionSignal: false,
          signalDirection: 'support',
        },
        {
          subject: 'math',
          eventType: 'quiz_submitted',
          createdAt: '2026-04-03T08:30:00.000Z',
          accuracy: 0.58,
          standards: ['6.NS.A.1'],
          completionSignal: false,
          signalDirection: 'support',
        },
      ],
    });

    expect(signal.masteryTrend).toBe('support');
    expect(signal.supportPressure).toBeGreaterThanOrEqual(0.65);
    expect(signal.stretchReadiness).toBeLessThan(0.4);
  });

  it('requires three aligned signals before practice-only replanning', () => {
    expect(
      hasStableSignalCluster([
        {
          subject: 'english',
          eventType: 'practice_answered',
          createdAt: '2026-04-03T11:00:00.000Z',
          accuracy: 1,
          standards: ['RI.5.1'],
          completionSignal: false,
          signalDirection: 'stretch',
        },
        {
          subject: 'english',
          eventType: 'practice_answered',
          createdAt: '2026-04-03T10:55:00.000Z',
          accuracy: 1,
          standards: ['RI.5.1'],
          completionSignal: false,
          signalDirection: 'stretch',
        },
        {
          subject: 'english',
          eventType: 'quiz_submitted',
          createdAt: '2026-04-03T10:50:00.000Z',
          accuracy: 0.92,
          standards: ['RI.5.1'],
          completionSignal: false,
          signalDirection: 'stretch',
        },
      ]),
    ).toBe('stretch');

    expect(
      hasStableSignalCluster([
        {
          subject: 'english',
          eventType: 'practice_answered',
          createdAt: '2026-04-03T11:00:00.000Z',
          accuracy: 1,
          standards: ['RI.5.1'],
          completionSignal: false,
          signalDirection: 'stretch',
        },
        {
          subject: 'english',
          eventType: 'practice_answered',
          createdAt: '2026-04-03T10:55:00.000Z',
          accuracy: 0,
          standards: ['RI.5.1'],
          completionSignal: false,
          signalDirection: 'support',
        },
        {
          subject: 'english',
          eventType: 'quiz_submitted',
          createdAt: '2026-04-03T10:50:00.000Z',
          accuracy: 0.92,
          standards: ['RI.5.1'],
          completionSignal: false,
          signalDirection: 'stretch',
        },
      ]),
    ).toBeNull();
  });
});
