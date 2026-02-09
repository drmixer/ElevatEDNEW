import process from 'node:process';

import { createServiceRoleClient } from './utils/supabase.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type CliOptions = {
  lookbackDays: number;
  seedTag: string;
  replaceExisting: boolean;
  dryRun: boolean;
  retentionCohortSize: number;
  recentCheckpointCohortSize: number;
  adaptiveAttemptCount: number;
  diagnosticEligibleCount: number;
  diagnosticCompletedCount: number;
};

type AnalyticsInsertRow = {
  event_name: string;
  actor_role: 'system';
  student_id: null;
  parent_id: null;
  occurred_at: string;
  payload: Record<string, unknown>;
};

const parsePositiveInt = (value: string, name: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer for ${name}.`);
  }
  return parsed;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    lookbackDays: 7,
    seedTag: 'phase_bc_synthetic_v1',
    replaceExisting: true,
    dryRun: false,
    retentionCohortSize: 10,
    recentCheckpointCohortSize: 10,
    adaptiveAttemptCount: 60,
    diagnosticEligibleCount: 14,
    diagnosticCompletedCount: 12,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--lookback-days') {
      options.lookbackDays = parsePositiveInt(args[i + 1] ?? '', '--lookback-days');
      i += 1;
      continue;
    }
    if (arg === '--tag') {
      const value = (args[i + 1] ?? '').trim();
      if (!value) throw new Error('Expected non-empty value after --tag');
      options.seedTag = value;
      i += 1;
      continue;
    }
    if (arg === '--retention-cohort-size') {
      options.retentionCohortSize = parsePositiveInt(args[i + 1] ?? '', '--retention-cohort-size');
      i += 1;
      continue;
    }
    if (arg === '--recent-checkpoint-cohort-size') {
      options.recentCheckpointCohortSize = parsePositiveInt(
        args[i + 1] ?? '',
        '--recent-checkpoint-cohort-size',
      );
      i += 1;
      continue;
    }
    if (arg === '--adaptive-attempt-count') {
      options.adaptiveAttemptCount = parsePositiveInt(args[i + 1] ?? '', '--adaptive-attempt-count');
      i += 1;
      continue;
    }
    if (arg === '--diagnostic-eligible-count') {
      options.diagnosticEligibleCount = parsePositiveInt(args[i + 1] ?? '', '--diagnostic-eligible-count');
      i += 1;
      continue;
    }
    if (arg === '--diagnostic-completed-count') {
      options.diagnosticCompletedCount = parsePositiveInt(args[i + 1] ?? '', '--diagnostic-completed-count');
      i += 1;
      continue;
    }
    if (arg === '--append') {
      options.replaceExisting = false;
      continue;
    }
    if (arg === '--replace') {
      options.replaceExisting = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.diagnosticCompletedCount > options.diagnosticEligibleCount) {
    throw new Error('--diagnostic-completed-count cannot be greater than --diagnostic-eligible-count');
  }

  return options;
};

const eventNameForSource = (source: 'pilot' | 'k5'): string =>
  source === 'pilot' ? 'success_pilot_checkpoint_answered' : 'success_k5_math_checkpoint_answered';

const subjectForSource = (source: 'pilot' | 'k5'): string => (source === 'pilot' ? 'math' : 'math');

const gradeBandForSource = (source: 'pilot' | 'k5'): string => (source === 'pilot' ? '2' : 'k5');

const topicForIndex = (index: number): string => {
  const topics = ['place_value', 'fractions', 'measurement', 'geometry', 'addition_subtraction'];
  return topics[index % topics.length] ?? 'general';
};

const chunk = <T>(rows: T[], size: number): T[][] => {
  const parts: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    parts.push(rows.slice(i, i + size));
  }
  return parts;
};

const buildRows = (options: CliOptions): AnalyticsInsertRow[] => {
  const now = Date.now();
  const rows: AnalyticsInsertRow[] = [];

  const basePayload = {
    synthetic: true,
    seedTag: options.seedTag,
    source: 'synthetic_telemetry_seed',
  };

  const pushCheckpointAttempt = (input: {
    source: 'pilot' | 'k5';
    studentId: string;
    lessonId: number;
    sectionIndex: number;
    isCorrect: boolean;
    whenMs: number;
    topic: string;
    segment: 'retention' | 'recent';
  }) => {
    rows.push({
      event_name: eventNameForSource(input.source),
      actor_role: 'system',
      student_id: null,
      parent_id: null,
      occurred_at: new Date(input.whenMs).toISOString(),
      payload: {
        ...basePayload,
        studentId: input.studentId,
        lessonId: input.lessonId,
        sectionIndex: input.sectionIndex,
        isCorrect: input.isCorrect,
        subject: subjectForSource(input.source),
        gradeBand: gradeBandForSource(input.source),
        topic: input.topic,
        segment: input.segment,
      },
    });
  };

  // Retention cohort: baseline (older) + 7-day follow-up (inside lookback), with a small miss bucket.
  for (let i = 0; i < options.retentionCohortSize; i += 1) {
    const source: 'pilot' | 'k5' = i % 2 === 0 ? 'pilot' : 'k5';
    const studentId = `synthetic-retention-${i + 1}`;
    const lessonId = 9500 + i;
    const sectionIndex = i % 3;
    const topic = topicForIndex(i);

    const baselineMs = now - (options.lookbackDays + 5.5) * ONE_DAY_MS - i * 60_000;
    const followUpMs = now - 4.5 * ONE_DAY_MS - i * 60_000;
    const retained = i % 5 !== 0; // 80% retained

    pushCheckpointAttempt({
      source,
      studentId,
      lessonId,
      sectionIndex,
      isCorrect: true,
      whenMs: baselineMs,
      topic,
      segment: 'retention',
    });
    pushCheckpointAttempt({
      source,
      studentId,
      lessonId,
      sectionIndex,
      isCorrect: retained,
      whenMs: followUpMs,
      topic,
      segment: 'retention',
    });

    // Add a quick recovery attempt for non-retained keys so checkpoint recovery has explicit samples.
    if (!retained) {
      pushCheckpointAttempt({
        source,
        studentId,
        lessonId,
        sectionIndex,
        isCorrect: true,
        whenMs: followUpMs + 10 * 60_000,
        topic,
        segment: 'retention',
      });
    }
  }

  // Recent cohort: explicit first-pass and recovery coverage in the direct lookback window.
  for (let i = 0; i < options.recentCheckpointCohortSize; i += 1) {
    const source: 'pilot' | 'k5' = i % 2 === 0 ? 'pilot' : 'k5';
    const studentId = `synthetic-recent-${i + 1}`;
    const lessonId = 9700 + i;
    const sectionIndex = i % 4;
    const topic = topicForIndex(i + 20);
    const firstAttemptMs = now - (1.5 * ONE_DAY_MS + i * 60_000);
    const firstCorrect = i % 5 !== 0; // 80% first-pass

    pushCheckpointAttempt({
      source,
      studentId,
      lessonId,
      sectionIndex,
      isCorrect: firstCorrect,
      whenMs: firstAttemptMs,
      topic,
      segment: 'recent',
    });

    if (!firstCorrect) {
      pushCheckpointAttempt({
        source,
        studentId,
        lessonId,
        sectionIndex,
        isCorrect: true,
        whenMs: firstAttemptMs + 10 * 60_000,
        topic,
        segment: 'recent',
      });
    }
  }

  // Adaptive outcomes in lookback window: mostly success with small error/safety buckets.
  for (let i = 0; i < options.adaptiveAttemptCount; i += 1) {
    const whenMs = now - (0.5 * ONE_DAY_MS + i * 45_000);
    const outcome = i % 20 === 0 ? 'safety_block' : i % 10 === 0 ? 'error' : 'success';

    rows.push({
      event_name: 'success_adaptive_tutor_outcome',
      actor_role: 'system',
      student_id: null,
      parent_id: null,
      occurred_at: new Date(whenMs).toISOString(),
      payload: {
        ...basePayload,
        studentId: `synthetic-adaptive-${(i % 12) + 1}`,
        outcome,
        subject: 'math',
        gradeBand: i % 2 === 0 ? '2' : 'k5',
        topic: topicForIndex(i + 40),
      },
    });
  }

  // Diagnostic cohort for no-user environments.
  for (let i = 0; i < options.diagnosticEligibleCount; i += 1) {
    const studentId = `synthetic-diagnostic-${i + 1}`;
    const eligibleMs = now - (1.2 * ONE_DAY_MS + i * 30_000);
    const completedMs = now - (1.0 * ONE_DAY_MS + i * 30_000);
    rows.push({
      event_name: 'success_diagnostic_eligible',
      actor_role: 'system',
      student_id: null,
      parent_id: null,
      occurred_at: new Date(eligibleMs).toISOString(),
      payload: {
        ...basePayload,
        studentId,
        subject: 'math',
      },
    });
    if (i < options.diagnosticCompletedCount) {
      rows.push({
        event_name: 'success_diagnostic_completed',
        actor_role: 'system',
        student_id: null,
        parent_id: null,
        occurred_at: new Date(completedMs).toISOString(),
        payload: {
          ...basePayload,
          studentId,
          scorePct: 82,
          subject: 'math',
        },
      });
    }
  }

  return rows;
};

const summarizeRows = (rows: AnalyticsInsertRow[]) => {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    counts.set(row.event_name, (counts.get(row.event_name) ?? 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  const supabase = createServiceRoleClient();
  const rows = buildRows(options);

  console.log(`Synthetic telemetry seed tag: ${options.seedTag}`);
  console.log(`Rows planned: ${rows.length}`);
  summarizeRows(rows).forEach(([name, count]) => {
    console.log(`- ${name}: ${count}`);
  });

  if (options.dryRun) {
    console.log('Dry run only; no rows inserted.');
    return;
  }

  if (options.replaceExisting) {
    const { error: deleteError } = await supabase
      .from('analytics_events')
      .delete()
      .contains('payload', { synthetic: true, seedTag: options.seedTag });

    if (deleteError) {
      throw new Error(`Failed to clear existing synthetic rows: ${deleteError.message}`);
    }
  }

  const batches = chunk(rows, 500);
  for (const batch of batches) {
    const { error } = await supabase.from('analytics_events').insert(batch);
    if (error) {
      throw new Error(`Failed to insert synthetic telemetry batch: ${error.message}`);
    }
  }

  console.log(`Inserted ${rows.length} rows into analytics_events.`);
  console.log(
    'Run `npm run eval:release-gates -- --lookback-days 7 --allow-missing-hard-gates --telemetry-mode synthetic` to verify.',
  );
};

const invokedFromCli =
  process.argv[1]?.includes('seed_synthetic_success_telemetry.ts') ||
  process.argv[1]?.includes('seed_synthetic_success_telemetry.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
