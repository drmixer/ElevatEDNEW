type NumericOrNull = number | null | undefined;

export type CheckpointTelemetryEvent = {
  studentId: string | null | undefined;
  occurredAt: string | null | undefined;
  payload: Record<string, unknown> | null | undefined;
};

export type CheckpointEvaluationSummary = {
  attemptCount: number;
  firstAttemptCount: number;
  firstPassCount: number;
  firstPassRate: number | null;
  recoverableCount: number;
  recoveredWithinTwoCount: number;
  recoveryRateWithinTwo: number | null;
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
