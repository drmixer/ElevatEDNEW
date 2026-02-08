import { describe, expect, it } from 'vitest';
import {
  buildReleaseGateDashboard,
  computeCheckpointEvaluation,
  type CheckpointTelemetryEvent,
} from '../evaluationHarness';

describe('computeCheckpointEvaluation', () => {
  it('computes first-pass and recovery rates from checkpoint telemetry', () => {
    const events: CheckpointTelemetryEvent[] = [
      {
        studentId: 'student-1',
        occurredAt: '2026-02-01T10:00:00.000Z',
        payload: { lessonId: 101, sectionIndex: 0, isCorrect: false },
      },
      {
        studentId: 'student-1',
        occurredAt: '2026-02-01T10:01:00.000Z',
        payload: { lessonId: 101, sectionIndex: 0, isCorrect: true },
      },
      {
        studentId: 'student-2',
        occurredAt: '2026-02-01T10:00:00.000Z',
        payload: { lessonId: 101, sectionIndex: 0, isCorrect: true },
      },
      {
        studentId: 'student-3',
        occurredAt: '2026-02-01T10:00:00.000Z',
        payload: { lessonId: 102, sectionIndex: 1, isCorrect: false },
      },
      {
        studentId: 'student-3',
        occurredAt: '2026-02-01T10:01:00.000Z',
        payload: { lessonId: 102, sectionIndex: 1, isCorrect: false },
      },
      {
        studentId: 'student-3',
        occurredAt: '2026-02-01T10:02:00.000Z',
        payload: { lessonId: 102, sectionIndex: 1, isCorrect: false },
      },
    ];

    const summary = computeCheckpointEvaluation(events);

    expect(summary.attemptCount).toBe(6);
    expect(summary.firstAttemptCount).toBe(3);
    expect(summary.firstPassCount).toBe(1);
    expect(summary.firstPassRate).toBeCloseTo(33.3, 1);
    expect(summary.recoverableCount).toBe(2);
    expect(summary.recoveredWithinTwoCount).toBe(1);
    expect(summary.recoveryRateWithinTwo).toBe(50);
  });

  it('ignores malformed telemetry records', () => {
    const summary = computeCheckpointEvaluation([
      { studentId: null, occurredAt: '2026-02-01T00:00:00.000Z', payload: { lessonId: 1, sectionIndex: 0, isCorrect: true } },
      { studentId: 's1', occurredAt: null, payload: { lessonId: 1, sectionIndex: 0, isCorrect: true } },
      { studentId: 's1', occurredAt: '2026-02-01T00:00:00.000Z', payload: { lessonId: 1, sectionIndex: 0, isCorrect: true } },
    ]);

    expect(summary.attemptCount).toBe(1);
    expect(summary.firstAttemptCount).toBe(1);
    expect(summary.firstPassRate).toBe(100);
  });
});

describe('buildReleaseGateDashboard', () => {
  it('marks release as ready when hard gates pass', () => {
    const result = buildReleaseGateDashboard({
      lookbackDays: 14,
      learningGainPoints: 1.2,
      dailyPlanCompletionRate: 66,
      diagnosticCompletionRate: 84,
      assignmentFollowThroughRate: 74,
      checkpointFirstPassRate: 71,
      checkpointRecoveryRate: 73,
      genericContentRate: 1.5,
      coverageReadinessRate: 85,
      adaptiveErrorRate: 8,
      adaptiveSafetyRate: 11,
      strictNoDataForHardGates: true,
    });

    expect(result.releaseReady).toBe(true);
    expect(result.blockerCount).toBe(0);
    expect(result.failCount).toBe(0);
  });

  it('blocks release when a hard gate is missing in strict mode', () => {
    const result = buildReleaseGateDashboard({
      lookbackDays: 14,
      diagnosticCompletionRate: 90,
      coverageReadinessRate: 82,
      genericContentRate: null,
      adaptiveErrorRate: null,
      strictNoDataForHardGates: true,
    });

    expect(result.releaseReady).toBe(false);
    expect(result.blockers).toContain('Generic content rate');
    expect(result.blockers).toContain('Adaptive error rate');
  });
});
