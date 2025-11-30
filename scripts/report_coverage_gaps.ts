import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createServiceRoleClient } from './utils/supabase.js';

type CoverageRow = {
  grade_band: string;
  subject: string;
  module_slug: string;
  module_title: string | null;
  standard_framework: string | null;
  standard_code: string | null;
  public_lesson_count: number | null;
  practice_items_total: number | null;
  practice_items_aligned: number | null;
  assessment_count: number | null;
  external_resource_count: number | null;
  practice_target: number | null;
  meets_explanation_baseline: boolean;
  meets_practice_baseline: boolean;
  meets_assessment_baseline: boolean;
  meets_external_baseline: boolean;
};

type RollupRow = {
  grade_band: string;
  subject: string;
  modules: number;
  modules_with_explanations: number;
  modules_meeting_practice_baseline: number;
  modules_with_assessments: number;
  modules_with_external_resources: number;
  modules_needing_attention: number;
};

type Gap = {
  row: CoverageRow;
  issues: string[];
  practiceGap: number;
};

// Focus on launch scope to keep queries fast on remote Supabase
const TARGET_GRADES = ['3', '4', '5', '6', '7', '8'];
const TARGET_SUBJECTS = ['Mathematics', 'English Language Arts', 'Science'];

const PRACTICE_BASELINE_FALLBACK = 20;

const loadCoverageCells = async (supabase: SupabaseClient): Promise<CoverageRow[]> => {
  const { data, error } = await supabase
    .from('coverage_dashboard_cells')
    .select(
      [
        'grade_band',
        'subject',
        'module_slug',
        'module_title',
        'standard_framework',
        'standard_code',
        'public_lesson_count',
        'practice_items_total',
        'practice_items_aligned',
        'assessment_count',
        'external_resource_count',
        'practice_target',
        'meets_explanation_baseline',
        'meets_practice_baseline',
        'meets_assessment_baseline',
        'meets_external_baseline',
      ].join(','),
    )
    .in('grade_band', TARGET_GRADES)
    .in('subject', TARGET_SUBJECTS);

  if (error) {
    throw new Error(`Failed to load coverage dashboard cells: ${error.message}`);
  }

  return (data ?? []) as CoverageRow[];
};

const loadRollups = async (supabase: SupabaseClient): Promise<RollupRow[]> => {
  const { data, error } = await supabase
    .from('coverage_dashboard_rollup')
    .select(
      [
        'grade_band',
        'subject',
        'modules',
        'modules_with_explanations',
        'modules_meeting_practice_baseline',
        'modules_with_assessments',
        'modules_with_external_resources',
        'modules_needing_attention',
      ].join(','),
    )
    .in('grade_band', TARGET_GRADES)
    .in('subject', TARGET_SUBJECTS)
    .order('grade_band', { ascending: true })
    .order('subject', { ascending: true });

  if (error) {
    throw new Error(`Failed to load coverage rollups: ${error.message}`);
  }

  return (data ?? []) as RollupRow[];
};

const buildGaps = (rows: CoverageRow[]): Gap[] => {
  return rows
    .map((row) => {
      const practiceTarget = row.practice_target ?? PRACTICE_BASELINE_FALLBACK;
      const practiceCount =
        typeof row.practice_items_aligned === 'number' && !Number.isNaN(row.practice_items_aligned)
          ? row.practice_items_aligned
          : row.practice_items_total ?? 0;

      const issues: string[] = [];
      if (!row.meets_explanation_baseline) {
        issues.push('no public lesson');
      }
      if (!row.meets_practice_baseline) {
        issues.push(`practice ${practiceCount}/${practiceTarget}`);
      }
      if (!row.meets_assessment_baseline) {
        issues.push('no unit assessment');
      }
      if (!row.meets_external_baseline) {
        issues.push('no external resources');
      }

      const practiceGap = Math.max(0, practiceTarget - practiceCount);

      return { row, issues, practiceGap };
    })
    .filter((entry) => entry.issues.length > 0)
    .sort((a, b) => {
      if (b.issues.length !== a.issues.length) {
        return b.issues.length - a.issues.length;
      }
      if (b.practiceGap !== a.practiceGap) {
        return b.practiceGap - a.practiceGap;
      }
      const gradeA = Number.parseInt(a.row.grade_band, 10) || 0;
      const gradeB = Number.parseInt(b.row.grade_band, 10) || 0;
      if (gradeA !== gradeB) {
        return gradeA - gradeB;
      }
      return a.row.subject.localeCompare(b.row.subject);
    });
};

const printRollups = (rows: RollupRow[]) => {
  if (rows.length === 0) {
    return;
  }

  console.log('Rollup (per grade/subject):');
  for (const row of rows) {
    const missingPractice = row.modules - row.modules_meeting_practice_baseline;
    const missingAssessments = row.modules - row.modules_with_assessments;
    const missingExplanations = row.modules - row.modules_with_explanations;
    const missingExternal = row.modules - row.modules_with_external_resources;

    console.log(
      `- Grade ${row.grade_band} ${row.subject}: ${row.modules} modules | gaps -> lessons ${missingExplanations}, practice ${missingPractice}, assessments ${missingAssessments}, external ${missingExternal}, attention ${row.modules_needing_attention}`,
    );
  }
  console.log('');
};

const printGaps = (gaps: Gap[]) => {
  if (gaps.length === 0) {
    console.log('No coverage gaps detected for current baseline.');
    return;
  }

  console.log(`Coverage gaps (${gaps.length} cells):`);
  for (const entry of gaps) {
    const { row, issues, practiceGap } = entry;
    const practiceTarget = row.practice_target ?? PRACTICE_BASELINE_FALLBACK;
    const practiceCount =
      typeof row.practice_items_aligned === 'number' && !Number.isNaN(row.practice_items_aligned)
        ? row.practice_items_aligned
        : row.practice_items_total ?? 0;
    const standardLabel = row.standard_code
      ? `${row.standard_framework ?? ''} ${row.standard_code}`.trim()
      : 'No standard tagged';
    const moduleLabel = row.module_title ? `${row.module_slug} (${row.module_title})` : row.module_slug;
    const gapDetails =
      !row.meets_practice_baseline && practiceGap > 0
        ? ` (needs ${practiceGap} more practice to hit ${practiceTarget})`
        : '';

    console.log(
      `- Grade ${row.grade_band} ${row.subject} — ${moduleLabel} [${standardLabel}]: ${issues.join(
        '; ',
      )}${gapDetails} | lessons ${row.public_lesson_count ?? 0}, practice ${practiceCount}/${practiceTarget}, assessments ${
        row.assessment_count ?? 0
      }, external ${row.external_resource_count ?? 0}`,
    );
  }
};

const main = async () => {
  const supabase = createServiceRoleClient();
  const [cells, rollups] = await Promise.all([loadCoverageCells(supabase), loadRollups(supabase)]);
  printRollups(rollups);

  const gaps = buildGaps(cells);
  printGaps(gaps);
};

const invokedFromCli =
  process.argv[1]?.includes('report_coverage_gaps.ts') || process.argv[1]?.includes('report_coverage_gaps.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
