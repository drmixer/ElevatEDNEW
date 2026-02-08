import process from 'node:process';

import { assessPracticeQuestionQuality } from '../shared/questionQuality.js';
import {
  buildReleaseGateDashboard,
  computeCheckpointEvaluation,
  computeRetentionEvaluation,
  type CheckpointTelemetryEvent,
} from '../src/lib/evaluationHarness.js';
import { createServiceRoleClient, fetchAllPaginated } from './utils/supabase.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type CliOptions = {
  lookbackDays: number;
  strictNoDataForHardGates: boolean;
};

type QuestionQualitySampleRow = {
  id: number;
  prompt: string;
  question_type: string | null;
  question_options?: Array<{
    content: string;
    is_correct: boolean;
  }> | null;
};

type CoverageRollupRow = {
  grade_band: string;
  subject: string;
  modules: number;
  modules_needing_attention: number;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    lookbackDays: 14,
    strictNoDataForHardGates: true,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--lookback-days') {
      const value = Number.parseInt(args[i + 1] ?? '', 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Expected positive integer after --lookback-days');
      }
      options.lookbackDays = value;
      i += 1;
      continue;
    }
    if (arg === '--allow-missing-hard-gates') {
      options.strictNoDataForHardGates = false;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

const TARGET_GRADES = ['3', '4', '5', '6', '7', '8'];
const TARGET_SUBJECTS = ['Mathematics', 'English Language Arts'];

const computeGenericContentSummary = (
  rows: QuestionQualitySampleRow[],
): { sampleCount: number; genericCount: number; genericRate: number | null } => {
  if (!rows.length) {
    return { sampleCount: 0, genericCount: 0, genericRate: null };
  }

  let genericCount = 0;
  rows.forEach((row) => {
    const quality = assessPracticeQuestionQuality({
      prompt: row.prompt,
      type: row.question_type,
      options: (row.question_options ?? []).map((option) => ({
        text: option.content,
        isCorrect: option.is_correct,
      })),
    });
    if (quality.isGeneric) {
      genericCount += 1;
    }
  });

  return {
    sampleCount: rows.length,
    genericCount,
    genericRate: roundToTenth((genericCount / rows.length) * 100),
  };
};

const formatValue = (value: number | null, unit: 'percent' | 'points'): string => {
  if (value == null) return 'no data';
  return `${value}${unit === 'percent' ? '%' : ' pts'}`;
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  const supabase = createServiceRoleClient();
  const lookbackIso = new Date(Date.now() - options.lookbackDays * ONE_DAY_MS).toISOString();

  const [
    diagnosticsTotalResult,
    diagnosticsCompletedResult,
    assignmentsTotalResult,
    assignmentsCompletedResult,
    successRollupResult,
    checkpointResult,
    questionQualityResult,
  ] = await Promise.all([
    supabase.from('student_profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('student_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('assessment_completed', true),
    supabase
      .from('student_assignments')
      .select('id', { count: 'exact', head: true })
      .gte('updated_at', lookbackIso),
    supabase
      .from('student_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('updated_at', lookbackIso),
    supabase.from('admin_success_metrics_rollup').select('*').single(),
    supabase
      .from('analytics_events')
      .select('student_id, occurred_at, payload')
      .in('event_name', ['success_pilot_checkpoint_answered', 'success_k5_math_checkpoint_answered'])
      .gte('occurred_at', lookbackIso)
      .order('occurred_at', { ascending: true })
      .limit(10000),
    supabase
      .from('question_bank')
      .select('id, prompt, question_type, question_options(content, is_correct)')
      .gte('created_at', lookbackIso)
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  if (diagnosticsTotalResult.error) {
    throw new Error(`Failed to load diagnostics denominator: ${diagnosticsTotalResult.error.message}`);
  }
  if (diagnosticsCompletedResult.error) {
    throw new Error(`Failed to load diagnostics numerator: ${diagnosticsCompletedResult.error.message}`);
  }
  if (assignmentsTotalResult.error) {
    throw new Error(`Failed to load assignment denominator: ${assignmentsTotalResult.error.message}`);
  }
  if (assignmentsCompletedResult.error) {
    throw new Error(`Failed to load assignment numerator: ${assignmentsCompletedResult.error.message}`);
  }
  if (successRollupResult.error) {
    throw new Error(`Failed to load admin_success_metrics_rollup: ${successRollupResult.error.message}`);
  }
  if (checkpointResult.error) {
    throw new Error(`Failed to load checkpoint telemetry: ${checkpointResult.error.message}`);
  }
  if (questionQualityResult.error) {
    throw new Error(`Failed to load question quality sample: ${questionQualityResult.error.message}`);
  }

  const diagnosticsTotal = diagnosticsTotalResult.count ?? 0;
  const diagnosticsCompleted = diagnosticsCompletedResult.count ?? 0;
  const diagnosticCompletionRate =
    diagnosticsTotal > 0 ? roundToTenth((diagnosticsCompleted / diagnosticsTotal) * 100) : null;

  const assignmentsTotal = assignmentsTotalResult.count ?? 0;
  const assignmentsCompleted = assignmentsCompletedResult.count ?? 0;
  const assignmentFollowThroughRate =
    assignmentsTotal > 0 ? roundToTenth((assignmentsCompleted / assignmentsTotal) * 100) : null;

  const rollup = successRollupResult.data ?? null;
  const learningGainPoints =
    rollup?.weekly_accuracy_delta_avg != null
      ? roundToTenth(Number(rollup.weekly_accuracy_delta_avg))
      : null;
  const dailyPlanCompletionRate =
    rollup?.daily_plan_completion_rate_avg != null
      ? roundToTenth(Number(rollup.daily_plan_completion_rate_avg))
      : null;

  const checkpointSummary = computeCheckpointEvaluation(
    ((checkpointResult.data ?? []) as Array<{
      student_id: string | null;
      occurred_at: string | null;
      payload: Record<string, unknown> | null;
    }>).map<CheckpointTelemetryEvent>((row) => ({
      studentId: row.student_id,
      occurredAt: row.occurred_at,
      payload: row.payload,
    })),
  );

  const retentionSummary = computeRetentionEvaluation(
    ((checkpointResult.data ?? []) as Array<{
      student_id: string | null;
      occurred_at: string | null;
      payload: Record<string, unknown> | null;
    }>).map<CheckpointTelemetryEvent>((row) => ({
      studentId: row.student_id,
      occurredAt: row.occurred_at,
      payload: row.payload,
    })),
  );

  let questionSampleRows = (questionQualityResult.data as QuestionQualitySampleRow[] | null) ?? [];
  if (!questionSampleRows.length) {
    const { data: fallbackRows, error: fallbackRowsError } = await supabase
      .from('question_bank')
      .select('id, prompt, question_type, question_options(content, is_correct)')
      .order('created_at', { ascending: false })
      .limit(500);

    if (fallbackRowsError) {
      throw new Error(`Failed to load fallback question quality sample: ${fallbackRowsError.message}`);
    }
    questionSampleRows = (fallbackRows as QuestionQualitySampleRow[] | null) ?? [];
  }

  const genericSummary = computeGenericContentSummary(questionSampleRows);

  const coverageRows = await fetchAllPaginated<CoverageRollupRow>(
    (from, to) =>
      supabase
        .from('coverage_dashboard_rollup')
        .select('grade_band, subject, modules, modules_needing_attention')
        .in('grade_band', TARGET_GRADES)
        .in('subject', TARGET_SUBJECTS)
        .order('grade_band', { ascending: true })
        .order('subject', { ascending: true })
        .range(from, to),
    { logLabel: 'coverage_dashboard_rollup' },
  );

  const totalModules = coverageRows.reduce((sum, row) => sum + (row.modules ?? 0), 0);
  const fullyCoveredModules = coverageRows.reduce(
    (sum, row) => sum + Math.max(0, (row.modules ?? 0) - (row.modules_needing_attention ?? 0)),
    0,
  );
  const coverageReadinessRate = totalModules > 0 ? roundToTenth((fullyCoveredModules / totalModules) * 100) : null;

  const snapshot = buildReleaseGateDashboard({
    lookbackDays: options.lookbackDays,
    strictNoDataForHardGates: options.strictNoDataForHardGates,
    learningGainPoints,
    dailyPlanCompletionRate,
    diagnosticCompletionRate,
    assignmentFollowThroughRate,
    checkpointFirstPassRate: checkpointSummary.firstPassRate,
    checkpointRecoveryRate: checkpointSummary.recoveryRateWithinTwo,
    retention3DayRate: retentionSummary.retention3DayRate,
    retention7DayRate: retentionSummary.retention7DayRate,
    genericContentRate: genericSummary.genericRate,
    coverageReadinessRate,
    adaptiveErrorRate: null,
    adaptiveSafetyRate: null,
  });

  console.log(`Release gate evaluation (lookback ${options.lookbackDays} days)`);
  console.log(`Result: ${snapshot.releaseReady ? 'PASS' : 'FAIL'}`);
  console.log(
    `Counts: pass ${snapshot.passCount}, warn ${snapshot.warnCount}, fail ${snapshot.failCount}, no_data ${snapshot.noDataCount}, blockers ${snapshot.blockerCount}`,
  );
  console.log('');
  snapshot.gates.forEach((gate) => {
    console.log(
      `[${gate.status.toUpperCase()}] ${gate.label}: ${formatValue(gate.value, gate.unit)} | target ${gate.target}`,
    );
  });
  console.log('');
  console.log(
    `Telemetry samples: checkpoints ${checkpointSummary.attemptCount}, question_quality ${genericSummary.sampleCount}, coverage_rollup_rows ${coverageRows.length}`,
  );
  console.log(
    `Retention coverage: 3d ${retentionSummary.observed3DayCount}/${retentionSummary.eligible3DayCount} (${formatValue(
      retentionSummary.retention3DayCoverageRate,
      'percent',
    )}), 7d ${retentionSummary.observed7DayCount}/${retentionSummary.eligible7DayCount} (${formatValue(
      retentionSummary.retention7DayCoverageRate,
      'percent',
    )})`,
  );
  if (snapshot.blockers.length) {
    console.log('Blocking gates:');
    snapshot.blockers.forEach((label) => console.log(`- ${label}`));
  }

  if (!snapshot.releaseReady) {
    process.exitCode = 1;
  }
};

const invokedFromCli =
  process.argv[1]?.includes('evaluate_release_gates.ts') ||
  process.argv[1]?.includes('evaluate_release_gates.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
