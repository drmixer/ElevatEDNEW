import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { createServiceRoleClient, fetchAllPaginated } from './utils/supabase.js';
import { normalizePlacementLevel, placementWindowForLevel } from './utils/placementMetadata.js';

type SubjectKey = 'math' | 'ela';
type CoverageSubject = 'Mathematics' | 'English Language Arts';

type AssessmentRow = {
  id: number;
  title: string;
  metadata: Record<string, unknown> | null;
};

type AssessmentSectionRow = {
  id: number;
  assessment_id: number;
};

type AssessmentQuestionRow = {
  section_id: number;
  question_id: number;
};

type QuestionRow = {
  id: number;
  difficulty: number | null;
  metadata: Record<string, unknown> | null;
};

type CoverageRollupRow = {
  grade_band: string;
  subject: CoverageSubject;
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

type ModuleRow = {
  id: number;
  slug: string;
  subject: CoverageSubject;
  grade_band: string;
};

type ModuleStandardRow = {
  module_id: number;
  standard_id: number;
};

type StandardRow = {
  id: number;
  code: string;
  framework: string;
  grade_band: string | null;
  subject: string | null;
};

type Args = {
  jsonOut: string;
};

const SUBJECTS: SubjectKey[] = ['math', 'ela'];
const FOUNDATIONAL_GRADES = ['K', '1', '2', '3'];
const LOW_END_GRADES = ['K', '1', '2'];
const ALL_AUDIT_GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8'];

const SUBJECT_LABEL: Record<SubjectKey, CoverageSubject> = {
  math: 'Mathematics',
  ela: 'English Language Arts',
};

const parseArgs = (argv: string[]): Args => {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      continue;
    }
    args.set(key, value);
    index += 1;
  }

  return {
    jsonOut:
      args.get('json-out') ??
      path.resolve(process.cwd(), 'data/audits/cat_content_coverage_audit.json'),
  };
};

const toHistogram = (values: Array<string | number | null | undefined>): Record<string, number> => {
  const histogram = new Map<string, number>();
  for (const value of values) {
    const key = value == null ? 'null' : String(value);
    histogram.set(key, (histogram.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(Array.from(histogram.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })));
};

const getMetadataString = (metadata: Record<string, unknown> | null | undefined, keys: string[]): string | null => {
  for (const key of keys) {
    const raw = metadata?.[key];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return null;
};

const getMetadataNumber = (metadata: Record<string, unknown> | null | undefined, keys: string[]): number | null => {
  for (const key of keys) {
    const raw = metadata?.[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === 'string' && raw.trim().length > 0) {
      const parsed = Number.parseFloat(raw.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

const getSubjectKey = (metadata: Record<string, unknown> | null | undefined): SubjectKey | null => {
  const raw = getMetadataString(metadata, ['subject_key', 'subjectKey']);
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'math' || normalized === 'mathematics') return 'math';
  if (normalized === 'ela' || normalized === 'english' || normalized === 'english_language_arts') return 'ela';
  return null;
};

const isDiagnosticish = (row: AssessmentRow): boolean => {
  const purpose = getMetadataString(row.metadata, ['purpose', 'type', 'kind'])?.toLowerCase() ?? '';
  const title = row.title.toLowerCase();
  return (
    purpose === 'placement' ||
    purpose === 'diagnostic' ||
    title.includes('placement') ||
    title.includes('diagnostic')
  );
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createServiceRoleClient();

  const assessmentsData = await fetchAllPaginated<AssessmentRow>(
    (from, to) =>
      supabase
        .from('assessments')
        .select('id, title, metadata')
        .order('id', { ascending: true })
        .range(from, to),
    { logLabel: 'assessments' },
  );

  const assessmentRows = (assessmentsData as AssessmentRow[])
    .filter((row) => isDiagnosticish(row))
    .filter((row) => SUBJECTS.includes(getSubjectKey(row.metadata) ?? ('science' as never)));

  const diagnosticRows = assessmentRows.filter((row) => {
    const purpose = getMetadataString(row.metadata, ['purpose', 'type', 'kind'])?.toLowerCase() ?? '';
    return purpose === 'diagnostic';
  });

  const assessmentIds = diagnosticRows.map((row) => row.id);
  const { data: sectionData, error: sectionError } = await supabase
    .from('assessment_sections')
    .select('id, assessment_id')
    .in('assessment_id', assessmentIds);
  if (sectionError) {
    throw new Error(`Failed to load assessment sections: ${sectionError.message}`);
  }

  const sections = (sectionData ?? []) as AssessmentSectionRow[];
  const sectionIds = sections.map((row) => row.id);
  const { data: linkData, error: linkError } = await supabase
    .from('assessment_questions')
    .select('section_id, question_id')
    .in('section_id', sectionIds);
  if (linkError) {
    throw new Error(`Failed to load assessment questions: ${linkError.message}`);
  }

  const links = (linkData ?? []) as AssessmentQuestionRow[];
  const questionIds = Array.from(new Set(links.map((row) => row.question_id)));
  const { data: questionData, error: questionError } = await supabase
    .from('question_bank')
    .select('id, difficulty, metadata')
    .in('id', questionIds);
  if (questionError) {
    throw new Error(`Failed to load diagnostic question_bank rows: ${questionError.message}`);
  }

  const questions = (questionData ?? []) as QuestionRow[];
  const questionsById = new Map(questions.map((row) => [row.id, row]));
  const sectionIdsByAssessment = new Map<number, number[]>();
  for (const section of sections) {
    sectionIdsByAssessment.set(section.assessment_id, [...(sectionIdsByAssessment.get(section.assessment_id) ?? []), section.id]);
  }

  const assessmentAuditRows = diagnosticRows.map((assessment) => {
    const subjectKey = getSubjectKey(assessment.metadata) as SubjectKey;
    const sectionIdSet = new Set(sectionIdsByAssessment.get(assessment.id) ?? []);
    const localQuestions = links
      .filter((row) => sectionIdSet.has(row.section_id))
      .map((row) => questionsById.get(row.question_id))
      .filter((row): row is QuestionRow => Boolean(row));
    const questionPlacementLevels = localQuestions
      .map((row) => getMetadataNumber(row.metadata, ['placement_level', 'placementLevel', 'target_level', 'targetLevel']))
      .filter((value): value is number => Number.isFinite(value));
    const strands = new Set(
      localQuestions
        .map((row) => getMetadataString(row.metadata, ['strand']))
        .filter((value): value is string => Boolean(value)),
    );
    const standards = new Set(
      localQuestions.flatMap((row) => {
        const raw = row.metadata?.standards;
        if (!Array.isArray(raw)) return [];
        return raw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
      }),
    );
    return {
      id: assessment.id,
      title: assessment.title,
      subject: subjectKey,
      gradeBand: getMetadataString(assessment.metadata, ['grade_band', 'gradeBand', 'grade']) ?? 'unknown',
      assessmentPlacementLevel: getMetadataNumber(assessment.metadata, ['placement_level', 'placementLevel', 'target_level', 'targetLevel']),
      assessmentWindow:
        (assessment.metadata?.placement_window as { min_level?: number; max_level?: number } | undefined) ?? null,
      questionCount: localQuestions.length,
      questionPlacementLevels: Array.from(new Set(questionPlacementLevels)).sort((a, b) => a - b),
      difficultyCounts: toHistogram(localQuestions.map((row) => row.difficulty)),
      strandCount: strands.size,
      standardCount: standards.size,
    };
  });

  const assessmentCoverageBySubject = Object.fromEntries(
    SUBJECTS.map((subject) => {
      const rows = assessmentAuditRows.filter((row) => row.subject === subject);
      const subjectQuestionCount = rows.reduce((sum, row) => sum + row.questionCount, 0);
      const placementLevels = Array.from(
        new Set(rows.flatMap((row) => row.questionPlacementLevels)),
      ).sort((a, b) => a - b);
      return [
        subject,
        {
          diagnosticCount: rows.length,
          totalQuestionCount: subjectQuestionCount,
          assessmentPlacementLevels: Array.from(
            new Set(
              rows
                .map((row) => row.assessmentPlacementLevel)
                .filter((value): value is number => Number.isFinite(value)),
            ),
          ).sort((a, b) => a - b),
          questionPlacementLevels: placementLevels,
          gradeBands: rows.map((row) => row.gradeBand),
        },
      ];
    }),
  );

  const foundationalCoverage = Object.fromEntries(
    SUBJECTS.map((subject) => {
      const rows = assessmentAuditRows
        .filter((row) => row.subject === subject && FOUNDATIONAL_GRADES.includes(row.gradeBand))
        .sort((a, b) => FOUNDATIONAL_GRADES.indexOf(a.gradeBand) - FOUNDATIONAL_GRADES.indexOf(b.gradeBand));
      return [
        subject,
        {
          rows,
          distinctQuestionPlacementLevels: Array.from(
            new Set(rows.flatMap((row) => row.questionPlacementLevels)),
          ).sort((a, b) => a - b),
          hasLevelBelowThree: rows.some((row) => row.questionPlacementLevels.some((value) => value < 3)),
          lowEndBandsCollapsedToThree: LOW_END_GRADES.every((gradeBand) =>
            rows.some(
              (row) =>
                row.gradeBand === gradeBand &&
                row.questionPlacementLevels.length === 1 &&
                row.questionPlacementLevels[0] === 3,
            ),
          ),
          lowEndBandsSingleDifficulty: LOW_END_GRADES.every((gradeBand) =>
            rows.some(
              (row) =>
                row.gradeBand === gradeBand &&
                Object.keys(row.difficultyCounts).length === 1 &&
                row.difficultyCounts['1'] === row.questionCount,
            ),
          ),
        },
      ];
    }),
  );

  const coverageRollups: CoverageRollupRow[] = [];
  for (const gradeBand of LOW_END_GRADES) {
    for (const subject of SUBJECTS) {
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
            'modules_missing_explanations',
            'modules_missing_practice',
            'modules_missing_assessments',
            'modules_missing_external_resources',
          ].join(','),
        )
        .eq('grade_band', gradeBand)
        .eq('subject', SUBJECT_LABEL[subject]);

      if (error) {
        throw new Error(`Failed to load coverage rollup for ${gradeBand} ${SUBJECT_LABEL[subject]}: ${error.message}`);
      }
      coverageRollups.push(...((data ?? []) as CoverageRollupRow[]));
    }
  }

  const { data: lowEndModulesData, error: lowEndModulesError } = await supabase
    .from('modules')
    .select('id, slug, subject, grade_band')
    .in('grade_band', LOW_END_GRADES)
    .in('subject', Object.values(SUBJECT_LABEL));
  if (lowEndModulesError) {
    throw new Error(`Failed to load low-end modules: ${lowEndModulesError.message}`);
  }

  const lowEndModules = (lowEndModulesData ?? []) as ModuleRow[];
  const lowEndModuleIds = lowEndModules.map((row) => row.id);
  const { data: moduleStandardsData, error: moduleStandardsError } = await supabase
    .from('module_standards')
    .select('module_id, standard_id')
    .in('module_id', lowEndModuleIds);
  if (moduleStandardsError) {
    throw new Error(`Failed to load module_standards: ${moduleStandardsError.message}`);
  }

  const moduleStandardRows = (moduleStandardsData ?? []) as ModuleStandardRow[];
  const standardIds = Array.from(new Set(moduleStandardRows.map((row) => row.standard_id)));
  const { data: standardsData, error: standardsError } = await supabase
    .from('standards')
    .select('id, framework, code, grade_band, subject')
    .in('id', standardIds);
  if (standardsError) {
    throw new Error(`Failed to load standards: ${standardsError.message}`);
  }

  const standardsById = new Map((standardsData ?? []).map((row) => [(row as StandardRow).id, row as StandardRow]));
  const modulesById = new Map(lowEndModules.map((row) => [row.id, row]));
  const moduleAlignmentRows = moduleStandardRows
    .map((row) => {
      const module = modulesById.get(row.module_id);
      const standard = standardsById.get(row.standard_id);
      if (!module || !standard) return null;
      const mismatch = module.grade_band !== standard.grade_band || module.subject !== standard.subject;
      return {
        moduleSlug: module.slug,
        moduleGradeBand: module.grade_band,
        moduleSubject: module.subject,
        standardCode: standard.code,
        standardGradeBand: standard.grade_band,
        standardSubject: standard.subject,
        mismatch,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const moduleAlignmentSummary = Object.fromEntries(
    LOW_END_GRADES.flatMap((gradeBand) =>
      SUBJECTS.map((subject) => {
        const label = SUBJECT_LABEL[subject];
        const rows = moduleAlignmentRows.filter(
          (row) => row.moduleGradeBand === gradeBand && row.moduleSubject === label,
        );
        return [
          `${gradeBand}:${label}`,
          {
            links: rows.length,
            mismatches: rows.filter((row) => row.mismatch).length,
          },
        ];
      }),
    ),
  );

  const phase3Blockers: string[] = [];
  for (const subject of SUBJECTS) {
    const coverage = foundationalCoverage[subject] as {
      hasLevelBelowThree: boolean;
      lowEndBandsCollapsedToThree: boolean;
      lowEndBandsSingleDifficulty: boolean;
    };
    if (!coverage.hasLevelBelowThree) {
      phase3Blockers.push(`${subject}: no diagnostic item metadata exists below placement level 3`);
    }
    if (coverage.lowEndBandsCollapsedToThree) {
      phase3Blockers.push(`${subject}: K/1/2 diagnostics are collapsed to placement level 3`);
    }
    if (coverage.lowEndBandsSingleDifficulty) {
      phase3Blockers.push(`${subject}: K/1/2 diagnostics only expose one difficulty bucket`);
    }
  }

  const kindergartenAlignmentProblems = Object.entries(moduleAlignmentSummary)
    .filter(([key, value]) => key.startsWith('K:') && value.mismatches > 0)
    .map(([key, value]) => `${key} has ${value.mismatches}/${value.links} module-standard mismatches`);
  phase3Blockers.push(...kindergartenAlignmentProblems);
  const hasDiagnosticLadderBlockers = phase3Blockers.some(
    (entry) => entry.startsWith('math:') || entry.startsWith('ela:'),
  );

  const normalizationSnapshot = {
    K: {
      placementLevel: normalizePlacementLevel('K'),
      placementWindow: placementWindowForLevel(normalizePlacementLevel('K')),
    },
    '1': {
      placementLevel: normalizePlacementLevel('1'),
      placementWindow: placementWindowForLevel(normalizePlacementLevel('1')),
    },
    '2': {
      placementLevel: normalizePlacementLevel('2'),
      placementWindow: placementWindowForLevel(normalizePlacementLevel('2')),
    },
  };

  const audit = {
    generatedAt: new Date().toISOString(),
    scope: {
      subjects: SUBJECTS,
      diagnosticGrades: ALL_AUDIT_GRADES,
      foundationalGrades: FOUNDATIONAL_GRADES,
      lowEndGrades: LOW_END_GRADES,
    },
    currentNormalization: normalizationSnapshot,
    assessmentCoverageBySubject,
    foundationalCoverage,
    lowEndContentRollups: coverageRollups,
    lowEndModuleStandardAlignment: {
      summary: moduleAlignmentSummary,
      mismatchExamples: moduleAlignmentRows.filter((row) => row.mismatch).slice(0, 20),
    },
    diagnostics: assessmentAuditRows,
    recommendation: {
      phase3Ready: phase3Blockers.length === 0,
      blockers: phase3Blockers,
      summary:
        phase3Blockers.length === 0
          ? 'Low-end diagnostic and path content are ready for CAT v2 Phase 3.'
          : hasDiagnosticLadderBlockers
            ? 'Phase 3 should remain blocked. Foundational content exists, but the low-end diagnostic ladder and/or K-grade standards alignment are not ready.'
            : 'Phase 3 should remain blocked. The low-end diagnostic ladder is now live, but Kindergarten standards alignment is still broken.',
    },
  };

  fs.mkdirSync(path.dirname(args.jsonOut), { recursive: true });
  fs.writeFileSync(args.jsonOut, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');

  console.log('CAT content coverage audit');
  console.log(`JSON: ${path.relative(process.cwd(), args.jsonOut)}`);
  console.log('');
  console.log('Assessment coverage by subject:');
  for (const subject of SUBJECTS) {
    const coverage = assessmentCoverageBySubject[subject] as {
      diagnosticCount: number;
      totalQuestionCount: number;
      assessmentPlacementLevels: number[];
      questionPlacementLevels: number[];
    };
    console.log(
      `- ${SUBJECT_LABEL[subject]}: diagnostics ${coverage.diagnosticCount}, questions ${coverage.totalQuestionCount}, assessment levels ${coverage.assessmentPlacementLevels.join(', ') || 'none'}, question levels ${coverage.questionPlacementLevels.join(', ') || 'none'}`,
    );
  }
  console.log('');
  console.log('Foundational content rollup (K-2):');
  for (const row of coverageRollups) {
    console.log(
      `- ${row.grade_band} ${row.subject}: modules ${row.modules}, attention ${row.modules_needing_attention}, missing lessons ${row.modules_missing_explanations}, missing practice ${row.modules_missing_practice}, missing assessments ${row.modules_missing_assessments}`,
    );
  }
  console.log('');
  console.log(audit.recommendation.summary);
  if (phase3Blockers.length > 0) {
    console.log('Blockers:');
    phase3Blockers.forEach((entry) => console.log(`- ${entry}`));
  }
};

const invokedFromCli =
  process.argv[1]?.includes('audit_cat_content_coverage.ts') ||
  process.argv[1]?.includes('audit_cat_content_coverage.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
