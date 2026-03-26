import path from 'node:path';
import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadStructuredFile } from './utils/files.js';
import {
  normalizePlacementLevel,
  parsePlacementSubjectList,
  placementSubjectLabel,
  placementWindowForLevel,
  standardsFromValue,
  type PlacementSubjectKey,
} from './utils/placementMetadata.js';
import { createServiceRoleClient } from './utils/supabase.js';
import { extractWriteMode, logWriteMode } from './utils/writeMode.js';
import { assessAssessmentQuestionQuality, incrementQuestionQualityReasonCounts } from '../shared/questionQuality.js';

type DiagnosticOption = {
  text: string;
  isCorrect: boolean;
  feedback?: string | null;
};

type Placement = {
  on_miss?: string[];
  on_mastery?: string[];
};

type DiagnosticItem = {
  id: string;
  prompt: string;
  type?: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank';
  difficulty?: number;
  strand?: string;
  standard?: string;
  options: DiagnosticOption[];
  placement?: Placement;
};

type BlueprintSection = {
  id: string;
  strand: string;
  standards: string[];
  itemCount: number;
};

type DiagnosticBlueprint = {
  sections: BlueprintSection[];
};

type DiagnosticConfig = {
  grade_band: string;
  subject: string;
  title: string;
  description?: string;
  estimatedDurationMinutes?: number;
  blueprint: DiagnosticBlueprint;
  items: DiagnosticItem[];
};

type DiagnosticFile = Record<string, DiagnosticConfig>;

type SubjectRecord = {
  id: number;
  name: string;
};

const DEFAULT_FILE = path.resolve(process.cwd(), 'data/assessments/diagnostics_phase13.json');
const DEFAULT_TARGET_GRADE_BAND = '6-8';
const DEFAULT_SOURCE_GRADE = '7';
const DEFAULT_ITEMS_PER_SUBJECT = 6;
const DEFAULT_SUBJECTS: PlacementSubjectKey[] = ['math', 'ela'];

const normalizeSubjectName = (subjectKey: PlacementSubjectKey): string => placementSubjectLabel(subjectKey);
const normalizeStrandKey = (value: string | null | undefined): string => value?.trim().toLowerCase() ?? '';

const printHelp = () => {
  console.log(`
seed_placement_assessment.ts

Seeds subject-specific placement assessments for onboarding.

Usage:
  npx tsx scripts/seed_placement_assessment.ts [--apply] [--file <path>] [--grade-band <band>] [--source-grade <6|7|8>]
      [--items-per-subject <n>] [--subjects math,ela] [--overwrite]

Defaults:
  --file              data/assessments/diagnostics_phase13.json
  --grade-band        6-8
  --source-grade      7
  --items-per-subject 6
  --subjects          math,ela
  --overwrite         false
`.trim());
};

const parseArgs = (argv: string[]) => {
  const { apply, rest } = extractWriteMode(argv);
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, true);
      continue;
    }
    args.set(key, next);
    i += 1;
  }
  const file = (args.get('file') as string | undefined) ?? DEFAULT_FILE;
  const gradeBand = (args.get('grade-band') as string | undefined) ?? DEFAULT_TARGET_GRADE_BAND;
  const sourceGrade = (args.get('source-grade') as string | undefined) ?? DEFAULT_SOURCE_GRADE;
  const itemsPerSubjectRaw = (args.get('items-per-subject') as string | undefined) ?? String(DEFAULT_ITEMS_PER_SUBJECT);
  const itemsPerSubject = Number.parseInt(itemsPerSubjectRaw, 10);
  const subjects = parsePlacementSubjectList((args.get('subjects') as string | undefined) ?? DEFAULT_SUBJECTS.join(','));
  const overwrite = Boolean(args.get('overwrite'));
  const help = Boolean(args.get('help')) || Boolean(args.get('h'));
  return { apply, file, gradeBand, sourceGrade, itemsPerSubject, subjects, overwrite, help };
};

const fetchExistingPlacementAssessments = async (
  supabase: SupabaseClient,
  gradeBand: string,
  subjectKey: PlacementSubjectKey,
): Promise<Array<{ id: number; title: string | null }>> => {
  const { data, error } = await supabase
    .from('assessments')
    .select('id, title, metadata')
    .is('module_id', null)
    .contains('metadata', { purpose: 'placement', grade_band: gradeBand });

  if (error) {
    throw new Error(`Failed to check existing placement assessments: ${error.message}`);
  }

  return (data ?? [])
    .filter((row) => {
      const metadata = (row.metadata as Record<string, unknown> | null | undefined) ?? null;
      const directSubject = typeof metadata?.subject_key === 'string' ? metadata.subject_key.trim().toLowerCase() : null;
      if (directSubject === subjectKey) return true;

      if (!Array.isArray(metadata?.subjects)) return false;
      return metadata.subjects.length === 1 && metadata.subjects[0] === subjectKey;
    })
    .map((row) => ({
      id: row.id as number,
      title: (row.title as string | null | undefined) ?? null,
    }));
};

const fetchSubjects = async (supabase: SupabaseClient): Promise<Map<string, SubjectRecord>> => {
  const { data, error } = await supabase.from('subjects').select('id, name');
  if (error) {
    throw new Error(`Failed to load subjects: ${error.message}`);
  }
  const map = new Map<string, SubjectRecord>();
  (data ?? []).forEach((row) => {
    const name = (row.name as string | null | undefined)?.trim();
    if (name) {
      map.set(name, { id: row.id as number, name });
    }
  });
  return map;
};

const pickItems = (config: DiagnosticConfig, targetCount: number): DiagnosticItem[] => {
  const items = Array.isArray(config.items) ? config.items : [];
  const sections = Array.isArray(config.blueprint?.sections) ? config.blueprint.sections : [];
  if (!items.length) return [];
  if (targetCount <= 0) return [];

  const byStrand = new Map<string, DiagnosticItem[]>();
  for (const item of items) {
    const strandKey = (item.strand ?? '').trim().toLowerCase();
    const list = byStrand.get(strandKey) ?? [];
    list.push(item);
    byStrand.set(strandKey, list);
  }

  const picked: DiagnosticItem[] = [];
  const usedIds = new Set<string>();

  for (const section of sections) {
    const key = (section.strand ?? '').trim().toLowerCase();
    const candidates = byStrand.get(key) ?? [];
    for (const item of candidates) {
      if (picked.length >= targetCount) break;
      if (usedIds.has(item.id)) continue;
      picked.push(item);
      usedIds.add(item.id);
    }
    if (picked.length >= targetCount) break;
  }

  if (picked.length < targetCount) {
    for (const item of items) {
      if (picked.length >= targetCount) break;
      if (usedIds.has(item.id)) continue;
      picked.push(item);
      usedIds.add(item.id);
    }
  }

  return picked;
};

const deleteExistingPlacementAssessment = async (
  supabase: SupabaseClient,
  gradeBand: string,
  subjectKey: PlacementSubjectKey,
  overwrite: boolean,
): Promise<void> => {
  const existing = await fetchExistingPlacementAssessments(supabase, gradeBand, subjectKey);
  const existingIds = existing.map((row) => row.id);
  if (!existingIds.length) return;

  if (!overwrite) {
    const titles = existing.map((row) => row.title ?? `id:${row.id}`).join(', ');
    throw new Error(
      `${normalizeSubjectName(subjectKey)} placement assessment already exists for grade band ${gradeBand} (${titles}). Re-run with --overwrite to replace.`,
    );
  }

  const { data: sections, error: sectionsError } = await supabase
    .from('assessment_sections')
    .select('id')
    .in('assessment_id', existingIds);

  if (sectionsError) {
    throw new Error(`Failed to load existing placement sections: ${sectionsError.message}`);
  }

  const sectionIds = (sections ?? []).map((row) => row.id as number);
  let questionIds: number[] = [];

  if (sectionIds.length) {
    const { data: links, error: linkError } = await supabase
      .from('assessment_questions')
      .select('question_id')
      .in('section_id', sectionIds);
    if (linkError) {
      throw new Error(`Failed to load existing placement question links: ${linkError.message}`);
    }
    questionIds = Array.from(new Set((links ?? []).map((row) => row.question_id as number)));

    const { error: deleteLinksError } = await supabase.from('assessment_questions').delete().in('section_id', sectionIds);
    if (deleteLinksError) {
      throw new Error(`Failed to delete existing placement links: ${deleteLinksError.message}`);
    }

    const { error: deleteSectionsError } = await supabase.from('assessment_sections').delete().in('id', sectionIds);
    if (deleteSectionsError) {
      throw new Error(`Failed to delete existing placement sections: ${deleteSectionsError.message}`);
    }
  }

  const { error: deleteAssessmentsError } = await supabase.from('assessments').delete().in('id', existingIds);
  if (deleteAssessmentsError) {
    throw new Error(`Failed to delete existing placement assessments: ${deleteAssessmentsError.message}`);
  }

  if (questionIds.length) {
    const { data: bankRows, error: bankError } = await supabase
      .from('question_bank')
      .select('id, metadata')
      .in('id', questionIds);
    if (bankError) {
      throw new Error(`Failed to load existing placement question bank entries: ${bankError.message}`);
    }
    const generatedIds = (bankRows ?? [])
      .filter((row) => (row.metadata as Record<string, unknown> | null | undefined)?.generated_by === 'seed_placement_assessment')
      .map((row) => row.id as number);

    if (generatedIds.length) {
      const { error: deleteQuestionsError } = await supabase.from('question_bank').delete().in('id', generatedIds);
      if (deleteQuestionsError) {
        throw new Error(`Failed to delete generated placement questions: ${deleteQuestionsError.message}`);
      }
    }
  }
};

const seedPlacementAssessment = async (supabase: SupabaseClient, options: {
  apply: boolean;
  filePath: string;
  gradeBand: string;
  sourceGrade: string;
  itemsPerSubject: number;
  subjects: PlacementSubjectKey[];
  overwrite: boolean;
}): Promise<void> => {
  const { apply, filePath, gradeBand, sourceGrade, itemsPerSubject, subjects, overwrite } = options;
  logWriteMode(apply, 'placement assessment rows');
  if (!Number.isFinite(itemsPerSubject) || itemsPerSubject < 4 || itemsPerSubject > 12) {
    throw new Error('items-per-subject must be between 4 and 12.');
  }

  const diagnostics = await loadStructuredFile<DiagnosticFile>(filePath);

  const resolveConfig = (subjectKey: string): DiagnosticConfig => {
    const key = `${subjectKey}_${sourceGrade}`;
    const config = diagnostics[key];
    if (!config) {
      throw new Error(`Missing diagnostic config "${key}" in ${filePath}.`);
    }
    return config;
  };

  const subjectConfigs = new Map<PlacementSubjectKey, DiagnosticConfig>();
  subjects.forEach((subjectKey) => {
    subjectConfigs.set(subjectKey, resolveConfig(subjectKey));
  });

  const subjectMap = await fetchSubjects(supabase);
  const subjectIds = new Map<PlacementSubjectKey, number>();
  subjectConfigs.forEach((config, subjectKey) => {
    const subjectId = subjectMap.get(normalizeSubjectName(subjectKey))?.id ?? null;
    if (!subjectId) {
      throw new Error(`Missing subject row for ${normalizeSubjectName(subjectKey)} in subjects table.`);
    }
    subjectIds.set(subjectKey, subjectId);
  });

  let blockedCount = 0;
  const blockedReasonCounts: Record<string, number> = {};

  const collectValidItems = (payload: {
    config: DiagnosticConfig;
    subjectKey: 'math' | 'ela' | 'science';
  }): DiagnosticItem[] => {
    const { config, subjectKey } = payload;
    const picked = pickItems(config, itemsPerSubject);
    if (picked.length < 2) {
      throw new Error(`Not enough items for ${subjectKey} to seed placement.`);
    }

    const validItems: DiagnosticItem[] = [];
    for (const item of picked) {
      if (!item.prompt?.trim().length) {
        throw new Error(`Item ${item.id} is missing a prompt.`);
      }
      if (!Array.isArray(item.options) || item.options.length < 2) {
        throw new Error(`Item ${item.id} is missing options.`);
      }

      const quality = assessAssessmentQuestionQuality({
        prompt: item.prompt,
        type: item.type ?? 'multiple_choice',
        options: item.options.map((option) => ({
          text: option.text,
          isCorrect: option.isCorrect,
        })),
      });
      if (quality.shouldBlock) {
        blockedCount += 1;
        incrementQuestionQualityReasonCounts(blockedReasonCounts, quality.reasons);
        console.warn('[seed_placement_assessment] Blocking low-quality placement item', {
          source: 'scripts/seed_placement_assessment.ts',
          subjectKey,
          itemId: item.id,
          reasons: quality.reasons,
        });
        continue;
      }

      validItems.push(item);
    }

    if (validItems.length < 2) {
      throw new Error(`Quality gate left too few placement questions for ${subjectKey} (${validItems.length}).`);
    }

    return validItems;
  };

  const validItemsBySubject = new Map<PlacementSubjectKey, DiagnosticItem[]>();
  subjectConfigs.forEach((config, subjectKey) => {
    validItemsBySubject.set(subjectKey, collectValidItems({ config, subjectKey }));
  });

  if (!apply) {
    for (const subjectKey of subjects) {
      const existingAssessments = await fetchExistingPlacementAssessments(supabase, gradeBand, subjectKey);
      if (existingAssessments.length) {
        console.log(
          `Would replace ${existingAssessments.length} existing ${subjectKey} placement assessment(s) for grade band ${gradeBand}.`,
        );
      }
      console.log(
        `Would seed ${normalizeSubjectName(subjectKey)} placement assessment with ${validItemsBySubject.get(subjectKey)?.length ?? 0} questions.`,
      );
    }
    return;
  }

  const insertQuestion = async (payload: {
    subjectId: number;
    subjectKey: PlacementSubjectKey;
    item: DiagnosticItem;
  }): Promise<number> => {
    const { subjectId, subjectKey, item } = payload;
    const placementLevel = normalizePlacementLevel(sourceGrade);
    const standards = standardsFromValue(item.standard);

    const { data: questionRow, error: questionError } = await supabase
      .from('question_bank')
      .insert({
        subject_id: subjectId,
        question_type: item.type ?? 'multiple_choice',
        prompt: item.prompt,
        difficulty: item.difficulty ?? 3,
        tags: [...standards, item.strand].filter((tag): tag is string => typeof tag === 'string' && tag.trim().length),
        metadata: {
          placement: item.placement ?? {},
          strand: item.strand,
          standard: item.standard,
          standards,
          purpose: 'placement',
          grade_band: gradeBand,
          subject_key: subjectKey,
          placement_level: placementLevel,
          placement_window: placementWindowForLevel(placementLevel),
          phase: 'subject_placement_v1',
          source_diagnostic_grade: sourceGrade,
          generated_by: 'seed_placement_assessment',
          generated_at: new Date().toISOString(),
        },
      })
      .select('id')
      .single();

    if (questionError || !questionRow?.id) {
      throw new Error(`Failed to insert placement question ${item.id}: ${questionError?.message ?? 'unknown error'}`);
    }

    const questionId = questionRow.id as number;
    const options = (item.options ?? []).map((option, index) => ({
      question_id: questionId,
      option_order: index + 1,
      content: option.text,
      is_correct: option.isCorrect,
      feedback: option.feedback ?? null,
    }));

    if (options.length < 2) {
      throw new Error(`Placement question ${item.id} missing options.`);
    }

    const { error: optionError } = await supabase.from('question_options').insert(options);
    if (optionError) {
      throw new Error(`Failed to insert options for placement question ${item.id}: ${optionError.message}`);
    }

    return questionId;
  };

  const seedSubject = async (payload: {
    subjectId: number;
    subjectKey: PlacementSubjectKey;
    config: DiagnosticConfig;
    validItems: DiagnosticItem[];
  }) => {
    const { subjectId, subjectKey, config, validItems } = payload;
    await deleteExistingPlacementAssessment(supabase, gradeBand, subjectKey, overwrite);

    const placementLevel = normalizePlacementLevel(sourceGrade);
    const assessmentTitle = `${normalizeSubjectName(subjectKey)} Placement (Grade Band ${gradeBand})`;
    const { data: assessmentRow, error: assessmentError } = await supabase
      .from('assessments')
      .insert({
        title: assessmentTitle,
        description: `A short ${normalizeSubjectName(subjectKey).toLowerCase()} placement assessment for onboarding.`,
        subject_id: subjectId,
        module_id: null,
        is_adaptive: true,
        estimated_duration_minutes: Math.max(8, Math.min(20, validItems.length * 2)),
        metadata: {
          purpose: 'placement',
          grade_band: gradeBand,
          subject_key: subjectKey,
          subjects: [subjectKey],
          placement_level: placementLevel,
          placement_window: placementWindowForLevel(placementLevel),
          phase: 'subject_placement_v1',
          source_diagnostic_grade: sourceGrade,
          generated_by: 'seed_placement_assessment',
          generated_at: new Date().toISOString(),
        },
      })
      .select('id')
      .single();

    if (assessmentError || !assessmentRow?.id) {
      throw new Error(
        `Failed to create ${subjectKey} placement assessment: ${assessmentError?.message ?? 'unknown error'}`,
      );
    }

    const sectionSource = config.blueprint.sections.filter((section) =>
      validItems.some((item) => normalizeStrandKey(item.strand) === normalizeStrandKey(section.strand)),
    );
    const sectionInserts = (sectionSource.length ? sectionSource : config.blueprint.sections).map((section, index) => ({
      assessment_id: assessmentRow.id as number,
      section_order: index + 1,
      title: section.strand,
      instructions: `Answer a few ${normalizeSubjectName(subjectKey).toLowerCase()} questions to calibrate your starting level.`,
    }));

    const { data: sectionRows, error: sectionError } = await supabase
      .from('assessment_sections')
      .insert(sectionInserts)
      .select('id, title');

    if (sectionError || !sectionRows?.length) {
      throw new Error(
        `Failed to create ${subjectKey} placement sections: ${sectionError?.message ?? 'unknown error'}`,
      );
    }

    const sectionIdByStrand = new Map<string, number>();
    sectionRows.forEach((row) => {
      sectionIdByStrand.set(normalizeStrandKey(row.title as string), row.id as number);
    });

    const questionOrderBySection = new Map<number, number>();
    let insertedForSubject = 0;
    for (const item of validItems) {
      const sectionId = sectionIdByStrand.get(normalizeStrandKey(item.strand)) ?? sectionRows[0]?.id;
      if (!sectionId) {
        throw new Error(`Missing section id for ${subjectKey} placement assessment.`);
      }
      const questionId = await insertQuestion({ subjectId, subjectKey, item });
      const nextQuestionOrder = (questionOrderBySection.get(sectionId as number) ?? 0) + 1;
      questionOrderBySection.set(sectionId as number, nextQuestionOrder);
      const { error: linkError } = await supabase
        .from('assessment_questions')
        .insert({
          section_id: sectionId as number,
          question_id: questionId,
          question_order: nextQuestionOrder,
          weight: 1.0,
          metadata: {
            generated_by: 'seed_placement_assessment',
            subject_key: subjectKey,
            standards: standardsFromValue(item.standard),
            strand: item.strand,
            placement_level: placementLevel,
          },
        });

      if (linkError) {
        throw new Error(`Failed to link placement question ${item.id}: ${linkError.message}`);
      }

      insertedForSubject += 1;
    }

    if (insertedForSubject < 2) {
      throw new Error(`Quality gate left too few placement questions for ${subjectKey} (${insertedForSubject}).`);
    }

    console.log(
      `Seeded ${normalizeSubjectName(subjectKey)} placement assessment ${assessmentRow.id} for grade band ${gradeBand} (source grade ${sourceGrade}).`,
    );
  };

  for (const subjectKey of subjects) {
    await seedSubject({
      subjectId: subjectIds.get(subjectKey) as number,
      subjectKey,
      config: subjectConfigs.get(subjectKey) as DiagnosticConfig,
      validItems: validItemsBySubject.get(subjectKey) as DiagnosticItem[],
    });
  }

  if (blockedCount > 0) {
    console.warn('[seed_placement_assessment] Quality gate blocked placement items', {
      source: 'scripts/seed_placement_assessment.ts',
      blockedCount,
      reasonCounts: blockedReasonCounts,
    });
  }
};

export async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const supabase = createServiceRoleClient();
  await seedPlacementAssessment(supabase, {
    apply: args.apply,
    filePath: args.file,
    gradeBand: args.gradeBand,
    sourceGrade: args.sourceGrade,
    itemsPerSubject: args.itemsPerSubject,
    subjects: args.subjects,
    overwrite: args.overwrite,
  });
}

const isDirectRun =
  process.argv[1]?.includes('seed_placement_assessment.ts') ||
  process.argv[1]?.includes('seed_placement_assessment.js');

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
