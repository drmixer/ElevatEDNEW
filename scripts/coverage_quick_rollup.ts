import process from 'node:process';

import { createServiceRoleClient } from './utils/supabase.js';

type RollupRow = {
  grade_band: string;
  subject: string;
  modules: number;
  modules_with_explanations: number;
  modules_meeting_practice_baseline: number;
  modules_with_assessments: number;
  modules_with_external_resources: number;
  modules_needing_attention: number;
  modules_missing_explanations: number;
  modules_missing_practice: number;
  modules_missing_assessments: number;
  modules_missing_external_resources: number;
};

const TARGET_GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const parseArgs = (): string[] | null => {
  const args = process.argv.slice(2);
  const grades: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--grades' || arg === '--grade-bands') {
      const value = args[i + 1];
      if (!value) throw new Error(`Expected comma-separated grades after ${arg}`);
      grades.push(
        ...value
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean),
      );
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return grades.length > 0 ? grades : null;
};

const main = async (): Promise<void> => {
  const grades = parseArgs();
  const supabase = createServiceRoleClient();
  const selectColumns = [
    'grade_band',
    'subject',
    'modules',
    'modules_with_explanations',
    'modules_meeting_practice_baseline',
    'modules_with_assessments',
    'modules_with_external_resources',
    'modules_needing_attention',
    'modules_missing_explanations',
    'modules_missing_practice',
    'modules_missing_assessments',
    'modules_missing_external_resources',
  ].join(',');

  const gradeList = grades ?? TARGET_GRADES;
  const data: RollupRow[] = [];

  // Query one grade at a time to avoid broad view scans that can hit statement timeout in CI.
  for (const grade of gradeList) {
    const { data: rows, error } = await supabase
      .from('coverage_dashboard_rollup')
      .select(selectColumns)
      .eq('grade_band', grade)
      .order('subject', { ascending: true });
    if (error) {
      throw new Error(`Failed to fetch coverage rollup for grade ${grade}: ${error.message}`);
    }
    data.push(...((rows ?? []) as RollupRow[]));
  }

  data.sort((a, b) => {
    if (a.grade_band !== b.grade_band) {
      return a.grade_band.localeCompare(b.grade_band, undefined, { numeric: true });
    }
    return a.subject.localeCompare(b.subject);
  });

  for (const row of data) {
    const fullyCovered = Math.max(0, (row.modules ?? 0) - (row.modules_needing_attention ?? 0));
    const coveragePercent = row.modules === 0 ? 0 : Math.round((fullyCovered / row.modules) * 100);
    console.log(
      `${row.grade_band} ${row.subject}: modules ${row.modules}, missing lessons ${row.modules_missing_explanations}, practice ${row.modules_missing_practice}, assessments ${row.modules_missing_assessments}, external ${row.modules_missing_external_resources}`,
    );
    console.log(
      `  -> fully covered ${fullyCovered} (${coveragePercent}%), needs attention ${row.modules_needing_attention}`,
    );
  }
};

const invokedFromCli =
  process.argv[1]?.includes('coverage_quick_rollup.ts') || process.argv[1]?.includes('coverage_quick_rollup.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
