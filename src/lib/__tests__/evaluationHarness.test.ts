import { describe, expect, it } from 'vitest';
import {
  buildReleaseGateDashboard,
  computeAdaptiveEvaluation,
  computeCheckpointEvaluation,
  computeRetentionEvaluation,
  resolveAdaptiveRateForGates,
  resolveRetentionRateForGates,
  shouldIncludeTelemetryPayload,
  type AdaptiveTelemetryEvent,
  type CheckpointTelemetryEvent,
} from '../evaluationHarness';

describe('computeCheckpointEvaluation', () => {
  it('computes first-pass and recovery rates from checkpoint telemetry', () => {
    const events: CheckpointTelemetryEvent[] = [
      {
        studentId: 'student-1',
        occurredAt: '2026-02-01T10:00:00.000Z',
        eventName: 'success_pilot_checkpoint_answered',
        payload: { lessonId: 101, sectionIndex: 0, isCorrect: false },
      },
      {
        studentId: 'student-1',
        occurredAt: '2026-02-01T10:01:00.000Z',
        eventName: 'success_pilot_checkpoint_answered',
        payload: { lessonId: 101, sectionIndex: 0, isCorrect: true },
      },
      {
        studentId: 'student-2',
        occurredAt: '2026-02-01T10:00:00.000Z',
        eventName: 'success_k5_math_checkpoint_answered',
        payload: { lessonId: 101, sectionIndex: 0, isCorrect: true },
      },
      {
        studentId: 'student-3',
        occurredAt: '2026-02-01T10:00:00.000Z',
        eventName: 'success_k5_math_checkpoint_answered',
        payload: { lessonId: 102, sectionIndex: 1, isCorrect: false },
      },
      {
        studentId: 'student-3',
        occurredAt: '2026-02-01T10:01:00.000Z',
        eventName: 'success_k5_math_checkpoint_answered',
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
    expect(summary.pilotAttemptCount).toBe(2);
    expect(summary.k5AttemptCount).toBe(3);
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
    expect(summary.pilotAttemptCount).toBe(0);
    expect(summary.k5AttemptCount).toBe(0);
    expect(summary.firstAttemptCount).toBe(1);
    expect(summary.firstPassRate).toBe(100);
  });

  it('uses payload studentId fallback when row student_id is null', () => {
    const summary = computeCheckpointEvaluation([
      {
        studentId: null,
        occurredAt: '2026-02-01T00:00:00.000Z',
        eventName: 'success_pilot_checkpoint_answered',
        payload: { studentId: 'synthetic-student-1', lessonId: 1, sectionIndex: 0, isCorrect: true },
      },
    ]);

    expect(summary.attemptCount).toBe(1);
    expect(summary.firstAttemptCount).toBe(1);
    expect(summary.firstPassRate).toBe(100);
  });

  it('filters telemetry rows by requested mode', () => {
    const events: CheckpointTelemetryEvent[] = [
      {
        studentId: 'live-student',
        occurredAt: '2026-02-01T00:00:00.000Z',
        eventName: 'success_k5_math_checkpoint_answered',
        payload: { lessonId: 11, sectionIndex: 0, isCorrect: true },
      },
      {
        studentId: 'synthetic-student',
        occurredAt: '2026-02-01T00:01:00.000Z',
        eventName: 'success_pilot_checkpoint_answered',
        payload: { synthetic: true, lessonId: 22, sectionIndex: 0, isCorrect: true },
      },
    ];

    expect(computeCheckpointEvaluation(events, { telemetryMode: 'live' }).attemptCount).toBe(1);
    expect(computeCheckpointEvaluation(events, { telemetryMode: 'synthetic' }).attemptCount).toBe(1);
    expect(computeCheckpointEvaluation(events, { telemetryMode: 'all' }).attemptCount).toBe(2);
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
      adaptiveAttemptCount: 18,
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
      adaptiveAttemptCount: null,
      adaptiveErrorRate: null,
      strictNoDataForHardGates: true,
    });

    expect(result.releaseReady).toBe(false);
    expect(result.blockers).toContain('Generic content rate');
    expect(result.blockers).toContain('Adaptive telemetry volume');
  });

  it('uses adaptive telemetry volume as explicit blocker when attempts are missing', () => {
    const result = buildReleaseGateDashboard({
      lookbackDays: 14,
      diagnosticCompletionRate: 90,
      coverageReadinessRate: 82,
      genericContentRate: 0,
      adaptiveAttemptCount: 0,
      adaptiveErrorRate: null,
      strictNoDataForHardGates: true,
    });

    expect(result.releaseReady).toBe(false);
    expect(result.blockers).toContain('Adaptive telemetry volume');
    expect(result.blockers).not.toContain('Adaptive error rate');
  });

  it('does not block soft launch when adaptive telemetry is still sparse', () => {
    const result = buildReleaseGateDashboard({
      lookbackDays: 14,
      releaseMode: 'soft_launch',
      diagnosticCompletionRate: 90,
      coverageReadinessRate: 82,
      genericContentRate: 0,
      adaptiveAttemptCount: 0,
      adaptiveErrorRate: null,
      strictNoDataForHardGates: true,
    });

    expect(result.releaseMode).toBe('soft_launch');
    expect(result.releaseReady).toBe(true);
    expect(result.blockers).not.toContain('Adaptive telemetry volume');
    expect(result.blockers).not.toContain('Adaptive error rate');
    expect(result.gates.find((gate) => gate.key === 'adaptive_telemetry_volume')?.hardGate).toBe(false);
    expect(result.gates.find((gate) => gate.key === 'adaptive_error_rate')?.hardGate).toBe(false);
  });

  it('still blocks soft launch when core readiness gates fail', () => {
    const result = buildReleaseGateDashboard({
      lookbackDays: 14,
      releaseMode: 'soft_launch',
      diagnosticCompletionRate: 90,
      coverageReadinessRate: 68,
      genericContentRate: 0,
      adaptiveAttemptCount: 0,
      adaptiveErrorRate: null,
      strictNoDataForHardGates: true,
    });

    expect(result.releaseReady).toBe(false);
    expect(result.blockers).toContain('Coverage readiness');
  });
});

describe('computeRetentionEvaluation', () => {
  it('computes 3-day and 7-day retention rates plus coverage', () => {
    const events: CheckpointTelemetryEvent[] = [
      {
        studentId: 'student-1',
        occurredAt: '2026-01-01T10:00:00.000Z',
        payload: { lessonId: 101, sectionIndex: 0, isCorrect: true },
      },
      {
        studentId: 'student-1',
        occurredAt: '2026-01-05T10:00:00.000Z',
        payload: { lessonId: 101, sectionIndex: 0, isCorrect: true },
      },
      {
        studentId: 'student-1',
        occurredAt: '2026-01-09T10:00:00.000Z',
        payload: { lessonId: 101, sectionIndex: 0, isCorrect: false },
      },
      {
        studentId: 'student-2',
        occurredAt: '2026-01-01T10:00:00.000Z',
        payload: { lessonId: 102, sectionIndex: 1, isCorrect: true },
      },
      {
        studentId: 'student-2',
        occurredAt: '2026-01-05T10:00:00.000Z',
        payload: { lessonId: 102, sectionIndex: 1, isCorrect: false },
      },
      {
        studentId: 'student-2',
        occurredAt: '2026-01-09T10:00:00.000Z',
        payload: { lessonId: 102, sectionIndex: 1, isCorrect: true },
      },
      {
        studentId: 'student-3',
        occurredAt: '2026-01-08T10:00:00.000Z',
        payload: { lessonId: 103, sectionIndex: 2, isCorrect: true },
      },
    ];

    const summary = computeRetentionEvaluation(events);

    expect(summary.baselineMasteredCount).toBe(3);
    expect(summary.eligible3DayCount).toBe(2);
    expect(summary.observed3DayCount).toBe(2);
    expect(summary.retained3DayCount).toBe(1);
    expect(summary.retention3DayRate).toBe(50);
    expect(summary.retention3DayCoverageRate).toBe(100);
    expect(summary.eligible7DayCount).toBe(2);
    expect(summary.observed7DayCount).toBe(2);
    expect(summary.retained7DayCount).toBe(1);
    expect(summary.retention7DayRate).toBe(50);
    expect(summary.retention7DayCoverageRate).toBe(100);
  });
});

describe('computeAdaptiveEvaluation', () => {
  it('computes adaptive error and safety rates from outcomes', () => {
    const events: AdaptiveTelemetryEvent[] = [
      {
        occurredAt: '2026-02-01T00:00:00.000Z',
        payload: { outcome: 'success' },
      },
      {
        occurredAt: '2026-02-01T00:01:00.000Z',
        payload: { outcome: 'error' },
      },
      {
        occurredAt: '2026-02-01T00:02:00.000Z',
        payload: { outcome: 'safety_block' },
      },
      {
        occurredAt: '2026-02-01T00:03:00.000Z',
        payload: { outcome: 'success' },
      },
    ];

    const summary = computeAdaptiveEvaluation(events);
    expect(summary.attemptCount).toBe(4);
    expect(summary.errorCount).toBe(1);
    expect(summary.safetyBlockCount).toBe(1);
    expect(summary.errorRate).toBe(25);
    expect(summary.safetyRate).toBe(25);
  });

  it('supports telemetry mode filtering', () => {
    const events: AdaptiveTelemetryEvent[] = [
      {
        occurredAt: '2026-02-01T00:00:00.000Z',
        payload: { outcome: 'success' },
      },
      {
        occurredAt: '2026-02-01T00:01:00.000Z',
        payload: { synthetic: true, outcome: 'error' },
      },
    ];

    expect(computeAdaptiveEvaluation(events, { telemetryMode: 'live' }).attemptCount).toBe(1);
    expect(computeAdaptiveEvaluation(events, { telemetryMode: 'synthetic' }).attemptCount).toBe(1);
    expect(computeAdaptiveEvaluation(events, { telemetryMode: 'all' }).attemptCount).toBe(2);
  });
});

describe('shouldIncludeTelemetryPayload', () => {
  it('includes rows based on synthetic flag and telemetry mode', () => {
    expect(shouldIncludeTelemetryPayload({}, 'live')).toBe(true);
    expect(shouldIncludeTelemetryPayload({ synthetic: true }, 'live')).toBe(false);
    expect(shouldIncludeTelemetryPayload({}, 'synthetic')).toBe(false);
    expect(shouldIncludeTelemetryPayload({ synthetic: true }, 'synthetic')).toBe(true);
    expect(shouldIncludeTelemetryPayload({ synthetic: true }, 'all')).toBe(true);
  });
});

describe('resolveRetentionRateForGates', () => {
  it('returns 0 when there are eligible samples but no follow-ups', () => {
    expect(resolveRetentionRateForGates(null, 10, 0)).toBe(0);
  });

  it('returns 0 when there are no eligible samples', () => {
    expect(resolveRetentionRateForGates(null, 0, 0)).toBe(0);
  });
});

describe('resolveAdaptiveRateForGates', () => {
  it('returns no data when adaptive telemetry volume is zero', () => {
    expect(resolveAdaptiveRateForGates(null, 0)).toBeNull();
  });

  it('returns explicit adaptive rate when available', () => {
    expect(resolveAdaptiveRateForGates(11.4, 12)).toBe(11.4);
  });

  it('fails safe to 100 only when attempts exist but rate is unresolved', () => {
    expect(resolveAdaptiveRateForGates(null, 3)).toBe(100);
  });
});
