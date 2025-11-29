import process from 'node:process';

import { createServiceRoleClient } from './utils/supabase.js';

type Cell = {
  grade_band: string;
  subject: string;
  meets_explanation_baseline: boolean;
  meets_practice_baseline: boolean;
  meets_assessment_baseline: boolean;
  meets_external_baseline: boolean;
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
  const { data, error } = await supabase
    .from('coverage_dashboard_cells')
    .select(
      [
        'grade_band',
        'subject',
        'meets_explanation_baseline',
        'meets_practice_baseline',
        'meets_assessment_baseline',
        'meets_external_baseline',
      ].join(','),
    )
    .in('grade_band', grades ?? TARGET_GRADES);

  if (error) {
    throw new Error(`Failed to load coverage dashboard cells: ${error.message}`);
  }

  const rollup = new Map<
    string,
    { modules: number; missing: { lessons: number; practice: number; assessments: number; external: number } }
  >();

  for (const cell of (data ?? []) as Cell[]) {
    const key = `${cell.grade_band}::${cell.subject}`;
    if (!rollup.has(key)) {
      rollup.set(key, { modules: 0, missing: { lessons: 0, practice: 0, assessments: 0, external: 0 } });
    }
    const entry = rollup.get(key)!;
    entry.modules += 1;
    if (!cell.meets_explanation_baseline) entry.missing.lessons += 1;
    if (!cell.meets_practice_baseline) entry.missing.practice += 1;
    if (!cell.meets_assessment_baseline) entry.missing.assessments += 1;
    if (!cell.meets_external_baseline) entry.missing.external += 1;
  }

  const sorted = Array.from(rollup.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, entry] of sorted) {
    const [grade, subject] = key.split('::');
    console.log(
      `${grade} ${subject}: modules ${entry.modules}, missing lessons ${entry.missing.lessons}, practice ${entry.missing.practice}, assessments ${entry.missing.assessments}, external ${entry.missing.external}`,
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
