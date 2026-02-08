type NumericOrNull = number | null | undefined;

export type CheckpointTelemetryEvent = {
  studentId: string | null | undefined;
  occurredAt: string | null | undefined;
  payload: Record<string, unknown> | null | undefined;
  eventName?: string | null | undefined;
};

export type CheckpointEvaluationSummary = {
  attemptCount: number;
  pilotAttemptCount: number;
  k5AttemptCount: number;
  firstAttemptCount: number;
  firstPassCount: number;
  firstPassRate: number | null;
  recoverableCount: number;
  recoveredWithinTwoCount: number;
  recoveryRateWithinTwo: number | null;
};

export type AdaptiveTelemetryEvent = {
  occurredAt: string | null | undefined;
  payload: Record<string, unknown> | null | undefined;
};

export type AdaptiveEvaluationSummary = {
  attemptCount: number;
  errorCount: number;
  safetyBlockCount: number;
  errorRate: number | null;
  safetyRate: number | null;
};

export type RetentionEvaluationSummary = {
  baselineMasteredCount: number;
  eligible3DayCount: number;
  observed3DayCount: number;
  retained3DayCount: number;
  retention3DayRate: number | null;
  retention3DayCoverageRate: number | null;
  eligible7DayCount: number;
  observed7DayCount: number;
  retained7DayCount: number;
  retention7DayRate: number | null;
  retention7DayCoverageRate: number | null;
};

export type ReleaseGateStatus = 'pass' | 'warn' | 'fail' | 'no_data';

export type ReleaseGateResult = {
  key:
    | 'learning_gain'
    | 'daily_plan_completion'
    | 'diagnostic_completion'
    | 'assignment_follow_through'
    | 'checkpoint_first_pass'
    | 'checkpoint_recovery'
    | 'retention_3day'
    | 'retention_7day'
    | 'generic_content_rate'
    | 'coverage_readiness'
    | 'adaptive_error_rate'
    | 'adaptive_safety_rate';
  label: string;
  value: number | null;
  unit: 'percent' | 'points';
  status: ReleaseGateStatus;
  target: string;
  hardGate: boolean;
  isBlocker: boolean;
};

export type ReleaseGateDashboard = {
  lookbackDays: number;
  generatedAt: string;
  releaseReady: boolean;
  passCount: number;
  warnCount: number;
  failCount: number;
  noDataCount: number;
  blockerCount: number;
  blockers: string[];
  gates: ReleaseGateResult[];
};

export type BuildReleaseGateInput = {
  lookbackDays: number;
  learningGainPoints?: NumericOrNull;
  dailyPlanCompletionRate?: NumericOrNull;
  diagnosticCompletionRate?: NumericOrNull;
  assignmentFollowThroughRate?: NumericOrNull;
  checkpointFirstPassRate?: NumericOrNull;
  checkpointRecoveryRate?: NumericOrNull;
  retention3DayRate?: NumericOrNull;
  retention7DayRate?: NumericOrNull;
  genericContentRate?: NumericOrNull;
  coverageReadinessRate?: NumericOrNull;
  adaptiveErrorRate?: NumericOrNull;
  adaptiveSafetyRate?: NumericOrNull;
  strictNoDataForHardGates?: boolean;
};

const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

const parseFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return null;
};

const normalizeNumeric = (value: NumericOrNull): number | null => {
  if (value == null || !Number.isFinite(value)) return null;
  return roundToTenth(value);
};

const normalizeEventName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : null;
};

const metricStatusForLowerBound = (
  value: number | null,
  passAtOrAbove: number,
  warnAtOrAbove: number,
): ReleaseGateStatus => {
  if (value == null) return 'no_data';
  if (value >= passAtOrAbove) return 'pass';
  if (value >= warnAtOrAbove) return 'warn';
  return 'fail';
};

const metricStatusForUpperBound = (
  value: number | null,
  passAtOrBelow: number,
  warnAtOrBelow: number,
): ReleaseGateStatus => {
  if (value == null) return 'no_data';
  if (value <= passAtOrBelow) return 'pass';
  if (value <= warnAtOrBelow) return 'warn';
  return 'fail';
};

export const computeCheckpointEvaluation = (
  events: CheckpointTelemetryEvent[],
): CheckpointEvaluationSummary => {
  const attemptsByCheckpoint = new Map<string, Array<{ ts: number; isCorrect: boolean }>>();
  let attemptCount = 0;
  let pilotAttemptCount = 0;
  let k5AttemptCount = 0;

  events.forEach((event) => {
    const payload = event.payload ?? {};
    const studentId = (event.studentId ?? '').toString().trim();
    const lessonId = parseFiniteNumber(payload.lessonId);
    const sectionIndex = parseFiniteNumber(payload.sectionIndex);
    const isCorrect = parseBoolean(payload.isCorrect);
    const ts = Date.parse(event.occurredAt ?? '');

    if (
      !studentId ||
      lessonId == null ||
      sectionIndex == null ||
      isCorrect == null ||
      !Number.isFinite(ts)
    ) {
      return;
    }

    const key = `${studentId}:${lessonId}:${sectionIndex}`;
    const attempts = attemptsByCheckpoint.get(key) ?? [];
    attempts.push({ ts, isCorrect });
    attemptsByCheckpoint.set(key, attempts);
    attemptCount += 1;

    const eventName = normalizeEventName(event.eventName);
    if (eventName === 'success_pilot_checkpoint_answered') {
      pilotAttemptCount += 1;
    } else if (eventName === 'success_k5_math_checkpoint_answered') {
      k5AttemptCount += 1;
    }
  });

  let firstAttemptCount = 0;
  let firstPassCount = 0;
  let recoverableCount = 0;
  let recoveredWithinTwoCount = 0;

  attemptsByCheckpoint.forEach((attempts) => {
    if (!attempts.length) return;
    attempts.sort((a, b) => a.ts - b.ts);

    const firstAttempt = attempts[0];
    if (!firstAttempt) return;

    firstAttemptCount += 1;
    if (firstAttempt.isCorrect) {
      firstPassCount += 1;
      return;
    }

    recoverableCount += 1;
    const followUps = attempts.slice(1, 3);
    if (followUps.some((attempt) => attempt.isCorrect)) {
      recoveredWithinTwoCount += 1;
    }
  });

  return {
    attemptCount,
    pilotAttemptCount,
    k5AttemptCount,
    firstAttemptCount,
    firstPassCount,
    firstPassRate:
      firstAttemptCount > 0 ? roundToTenth((firstPassCount / firstAttemptCount) * 100) : null,
    recoverableCount,
    recoveredWithinTwoCount,
    recoveryRateWithinTwo:
      recoverableCount > 0
        ? roundToTenth((recoveredWithinTwoCount / recoverableCount) * 100)
        : null,
  };
};

const parseAdaptiveOutcome = (payload: Record<string, unknown>): 'success' | 'error' | 'safety_block' | null => {
  const explicitOutcome = normalizeEventName(payload.outcome);
  if (explicitOutcome === 'success' || explicitOutcome === 'error' || explicitOutcome === 'safety_block') {
    return explicitOutcome;
  }

  const fallbackStatus = parseBoolean(payload.isCorrect);
  if (fallbackStatus === true) return 'success';
  if (fallbackStatus === false) return 'error';
  return null;
};

export const computeAdaptiveEvaluation = (
  events: AdaptiveTelemetryEvent[],
): AdaptiveEvaluationSummary => {
  let attemptCount = 0;
  let errorCount = 0;
  let safetyBlockCount = 0;

  events.forEach((event) => {
    const payload = event.payload ?? {};
    const occurredAt = Date.parse(event.occurredAt ?? '');
    if (!Number.isFinite(occurredAt)) return;

    const outcome = parseAdaptiveOutcome(payload);
    if (!outcome) return;

    attemptCount += 1;
    if (outcome === 'error') {
      errorCount += 1;
    } else if (outcome === 'safety_block') {
      safetyBlockCount += 1;
    }
  });

  return {
    attemptCount,
    errorCount,
    safetyBlockCount,
    errorRate: attemptCount > 0 ? roundToTenth((errorCount / attemptCount) * 100) : null,
    safetyRate: attemptCount > 0 ? roundToTenth((safetyBlockCount / attemptCount) * 100) : null,
  };
};

export const computeRetentionEvaluation = (
  events: CheckpointTelemetryEvent[],
): RetentionEvaluationSummary => {
  const attemptsByCheckpoint = new Map<string, Array<{ ts: number; isCorrect: boolean }>>();
  let maxTimestamp = Number.NEGATIVE_INFINITY;

  events.forEach((event) => {
    const payload = event.payload ?? {};
    const studentId = (event.studentId ?? '').toString().trim();
    const lessonId = parseFiniteNumber(payload.lessonId);
    const sectionIndex = parseFiniteNumber(payload.sectionIndex);
    const isCorrect = parseBoolean(payload.isCorrect);
    const ts = Date.parse(event.occurredAt ?? '');

    if (
      !studentId ||
      lessonId == null ||
      sectionIndex == null ||
      isCorrect == null ||
      !Number.isFinite(ts)
    ) {
      return;
    }

    maxTimestamp = Math.max(maxTimestamp, ts);
    const key = `${studentId}:${lessonId}:${sectionIndex}`;
    const attempts = attemptsByCheckpoint.get(key) ?? [];
    attempts.push({ ts, isCorrect });
    attemptsByCheckpoint.set(key, attempts);
  });

  if (!Number.isFinite(maxTimestamp) || attemptsByCheckpoint.size === 0) {
    return {
      baselineMasteredCount: 0,
      eligible3DayCount: 0,
      observed3DayCount: 0,
      retained3DayCount: 0,
      retention3DayRate: null,
      retention3DayCoverageRate: null,
      eligible7DayCount: 0,
      observed7DayCount: 0,
      retained7DayCount: 0,
      retention7DayRate: null,
      retention7DayCoverageRate: null,
    };
  }

  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  let baselineMasteredCount = 0;
  let eligible3DayCount = 0;
  let observed3DayCount = 0;
  let retained3DayCount = 0;
  let eligible7DayCount = 0;
  let observed7DayCount = 0;
  let retained7DayCount = 0;

  attemptsByCheckpoint.forEach((attempts) => {
    if (!attempts.length) return;
    attempts.sort((a, b) => a.ts - b.ts);

    const baseline = attempts.find((attempt) => attempt.isCorrect);
    if (!baseline) return;

    baselineMasteredCount += 1;

    const boundary3 = baseline.ts + threeDaysMs;
    const boundary7 = baseline.ts + sevenDaysMs;

    if (boundary3 <= maxTimestamp) {
      eligible3DayCount += 1;
      const followUp3 = attempts.find((attempt) => attempt.ts >= boundary3);
      if (followUp3) {
        observed3DayCount += 1;
        if (followUp3.isCorrect) {
          retained3DayCount += 1;
        }
      }
    }

    if (boundary7 <= maxTimestamp) {
      eligible7DayCount += 1;
      const followUp7 = attempts.find((attempt) => attempt.ts >= boundary7);
      if (followUp7) {
        observed7DayCount += 1;
        if (followUp7.isCorrect) {
          retained7DayCount += 1;
        }
      }
    }
  });

  return {
    baselineMasteredCount,
    eligible3DayCount,
    observed3DayCount,
    retained3DayCount,
    retention3DayRate:
      observed3DayCount > 0 ? roundToTenth((retained3DayCount / observed3DayCount) * 100) : null,
    retention3DayCoverageRate:
      eligible3DayCount > 0 ? roundToTenth((observed3DayCount / eligible3DayCount) * 100) : null,
    eligible7DayCount,
    observed7DayCount,
    retained7DayCount,
    retention7DayRate:
      observed7DayCount > 0 ? roundToTenth((retained7DayCount / observed7DayCount) * 100) : null,
    retention7DayCoverageRate:
      eligible7DayCount > 0 ? roundToTenth((observed7DayCount / eligible7DayCount) * 100) : null,
  };
};

export const resolveRetentionRateForGates = (
  rate: number | null,
  eligibleCount: number,
  observedCount: number,
): number | null => {
  if (rate != null) return rate;
  if (eligibleCount >= 0 && observedCount >= 0) return 0;
  return null;
};

export const resolveAdaptiveRateForGates = (
  rate: number | null,
  attemptCount: number,
): number | null => {
  if (rate != null) return rate;
  if (attemptCount >= 0) return 100;
  return null;
};

export const buildReleaseGateDashboard = (
  input: BuildReleaseGateInput,
): ReleaseGateDashboard => {
  const strictNoDataForHardGates = Boolean(input.strictNoDataForHardGates);
  const learningGainPoints = normalizeNumeric(input.learningGainPoints);
  const dailyPlanCompletionRate = normalizeNumeric(input.dailyPlanCompletionRate);
  const diagnosticCompletionRate = normalizeNumeric(input.diagnosticCompletionRate);
  const assignmentFollowThroughRate = normalizeNumeric(input.assignmentFollowThroughRate);
  const checkpointFirstPassRate = normalizeNumeric(input.checkpointFirstPassRate);
  const checkpointRecoveryRate = normalizeNumeric(input.checkpointRecoveryRate);
  const retention3DayRate = normalizeNumeric(input.retention3DayRate);
  const retention7DayRate = normalizeNumeric(input.retention7DayRate);
  const genericContentRate = normalizeNumeric(input.genericContentRate);
  const coverageReadinessRate = normalizeNumeric(input.coverageReadinessRate);
  const adaptiveErrorRate = normalizeNumeric(input.adaptiveErrorRate);
  const adaptiveSafetyRate = normalizeNumeric(input.adaptiveSafetyRate);

  const gates: ReleaseGateResult[] = [
    {
      key: 'learning_gain',
      label: 'Learning gain',
      value: learningGainPoints,
      unit: 'points',
      status: metricStatusForLowerBound(learningGainPoints, 0, -2),
      target: '>= 0 pts (warn >= -2)',
      hardGate: false,
      isBlocker: false,
    },
    {
      key: 'daily_plan_completion',
      label: 'Daily plan completion',
      value: dailyPlanCompletionRate,
      unit: 'percent',
      status: metricStatusForLowerBound(dailyPlanCompletionRate, 60, 50),
      target: '>= 60% (warn >= 50%)',
      hardGate: false,
      isBlocker: false,
    },
    {
      key: 'diagnostic_completion',
      label: 'Diagnostic completion',
      value: diagnosticCompletionRate,
      unit: 'percent',
      status: metricStatusForLowerBound(diagnosticCompletionRate, 80, 65),
      target: '>= 80% (warn >= 65%)',
      hardGate: true,
      isBlocker: false,
    },
    {
      key: 'assignment_follow_through',
      label: 'Assignment follow-through',
      value: assignmentFollowThroughRate,
      unit: 'percent',
      status: metricStatusForLowerBound(assignmentFollowThroughRate, 70, 55),
      target: '>= 70% (warn >= 55%)',
      hardGate: false,
      isBlocker: false,
    },
    {
      key: 'checkpoint_first_pass',
      label: 'Checkpoint first-pass',
      value: checkpointFirstPassRate,
      unit: 'percent',
      status: metricStatusForLowerBound(checkpointFirstPassRate, 70, 60),
      target: '>= 70% (warn >= 60%)',
      hardGate: false,
      isBlocker: false,
    },
    {
      key: 'checkpoint_recovery',
      label: 'Checkpoint recovery <=2',
      value: checkpointRecoveryRate,
      unit: 'percent',
      status: metricStatusForLowerBound(checkpointRecoveryRate, 70, 60),
      target: '>= 70% (warn >= 60%)',
      hardGate: false,
      isBlocker: false,
    },
    {
      key: 'retention_3day',
      label: 'Retention stability (3-day)',
      value: retention3DayRate,
      unit: 'percent',
      status: metricStatusForLowerBound(retention3DayRate, 70, 60),
      target: '>= 70% (warn >= 60%)',
      hardGate: false,
      isBlocker: false,
    },
    {
      key: 'retention_7day',
      label: 'Retention stability (7-day)',
      value: retention7DayRate,
      unit: 'percent',
      status: metricStatusForLowerBound(retention7DayRate, 65, 55),
      target: '>= 65% (warn >= 55%)',
      hardGate: false,
      isBlocker: false,
    },
    {
      key: 'generic_content_rate',
      label: 'Generic content rate',
      value: genericContentRate,
      unit: 'percent',
      status: metricStatusForUpperBound(genericContentRate, 2, 5),
      target: '<= 2% (warn <= 5%)',
      hardGate: true,
      isBlocker: false,
    },
    {
      key: 'coverage_readiness',
      label: 'Coverage readiness',
      value: coverageReadinessRate,
      unit: 'percent',
      status: metricStatusForLowerBound(coverageReadinessRate, 80, 70),
      target: '>= 80% (warn >= 70%)',
      hardGate: true,
      isBlocker: false,
    },
    {
      key: 'adaptive_error_rate',
      label: 'Adaptive error rate',
      value: adaptiveErrorRate,
      unit: 'percent',
      status: metricStatusForUpperBound(adaptiveErrorRate, 12, 18),
      target: '<= 12% (warn <= 18%)',
      hardGate: true,
      isBlocker: false,
    },
    {
      key: 'adaptive_safety_rate',
      label: 'Adaptive safety block rate',
      value: adaptiveSafetyRate,
      unit: 'percent',
      status: metricStatusForUpperBound(adaptiveSafetyRate, 15, 25),
      target: '<= 15% (warn <= 25%)',
      hardGate: false,
      isBlocker: false,
    },
  ].map((gate) => {
    const isMissingHardGate = gate.hardGate && gate.status === 'no_data' && strictNoDataForHardGates;
    const isBlocker = gate.hardGate && (gate.status === 'fail' || isMissingHardGate);
    return {
      ...gate,
      isBlocker,
    };
  });

  const blockers = gates.filter((gate) => gate.isBlocker).map((gate) => gate.label);

  const passCount = gates.filter((gate) => gate.status === 'pass').length;
  const warnCount = gates.filter((gate) => gate.status === 'warn').length;
  const failCount = gates.filter((gate) => gate.status === 'fail').length;
  const noDataCount = gates.filter((gate) => gate.status === 'no_data').length;

  return {
    lookbackDays: input.lookbackDays,
    generatedAt: new Date().toISOString(),
    releaseReady: blockers.length === 0,
    passCount,
    warnCount,
    failCount,
    noDataCount,
    blockerCount: blockers.length,
    blockers,
    gates,
  };
};
