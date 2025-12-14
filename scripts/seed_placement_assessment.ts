import path from 'node:path';
import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadStructuredFile } from './utils/files.js';
import { createServiceRoleClient } from './utils/supabase.js';

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

const SUBJECT_LABELS: Record<string, string> = {
  math: 'Mathematics',
  ela: 'English Language Arts',
  english: 'English Language Arts',
  english_language_arts: 'English Language Arts',
  science: 'Science',
};

const DEFAULT_FILE = path.resolve(process.cwd(), 'data/assessments/diagnostics_phase13.json');
const DEFAULT_TARGET_GRADE_BAND = '6-8';
const DEFAULT_SOURCE_GRADE = '7';
const DEFAULT_ITEMS_PER_SUBJECT = 6;

const normalizeSubjectName = (subjectKey: string): string => {
  const key = subjectKey.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return SUBJECT_LABELS[key] ?? subjectKey;
};

const printHelp = () => {
  console.log(`
seed_placement_assessment.ts

Seeds a single mixed-subject placement assessment for onboarding (core subjects).

Usage:
  npx tsx scripts/seed_placement_assessment.ts [--file <path>] [--grade-band <band>] [--source-grade <6|7|8>]
      [--items-per-subject <n>] [--overwrite]

Defaults:
  --file              data/assessments/diagnostics_phase13.json
  --grade-band        6-8
  --source-grade      7
  --items-per-subject 6
  --overwrite         false
`.trim());
};

const parseArgs = (argv: string[]) => {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
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
  const overwrite = Boolean(args.get('overwrite'));
  const help = Boolean(args.get('help')) || Boolean(args.get('h'));
  return { file, gradeBand, sourceGrade, itemsPerSubject, overwrite, help };
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
  overwrite: boolean,
): Promise<void> => {
  const { data: existing, error } = await supabase
    .from('assessments')
    .select('id, title, metadata')
    .is('module_id', null)
    .contains('metadata', { purpose: 'placement', grade_band: gradeBand });

  if (error) {
    throw new Error(`Failed to check existing placement assessments: ${error.message}`);
  }

  const existingIds = (existing ?? []).map((row) => row.id as number);
  if (!existingIds.length) return;

  if (!overwrite) {
    const titles = (existing ?? []).map((row) => (row.title as string | null | undefined) ?? `id:${row.id}`).join(', ');
    throw new Error(`Placement assessment already exists for grade band ${gradeBand} (${titles}). Re-run with --overwrite to replace.`);
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
  filePath: string;
  gradeBand: string;
  sourceGrade: string;
  itemsPerSubject: number;
  overwrite: boolean;
}): Promise<void> => {
  const { filePath, gradeBand, sourceGrade, itemsPerSubject, overwrite } = options;
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

  const mathConfig = resolveConfig('math');
  const elaConfig = resolveConfig('ela');
  const scienceConfig = resolveConfig('science');

  await deleteExistingPlacementAssessment(supabase, gradeBand, overwrite);

  const subjectMap = await fetchSubjects(supabase);
  const mathSubjectId = subjectMap.get(normalizeSubjectName(mathConfig.subject))?.id ?? null;
  const elaSubjectId = subjectMap.get(normalizeSubjectName(elaConfig.subject))?.id ?? null;
  const scienceSubjectId = subjectMap.get(normalizeSubjectName(scienceConfig.subject))?.id ?? null;

  if (!mathSubjectId || !elaSubjectId || !scienceSubjectId) {
    throw new Error('Missing subject rows (need Mathematics, English Language Arts, and Science in subjects table).');
  }

  const { data: assessmentRow, error: assessmentError } = await supabase
    .from('assessments')
    .insert({
      title: `Core Placement (Grade Band ${gradeBand})`,
      description: 'A short, mixed-subject placement assessment covering core subjects.',
      subject_id: null,
      module_id: null,
      is_adaptive: true,
      estimated_duration_minutes: 15,
      metadata: {
        purpose: 'placement',
        grade_band: gradeBand,
        subjects: ['math', 'ela', 'science'],
        source_diagnostic_grade: sourceGrade,
        generated_by: 'seed_placement_assessment',
        generated_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  if (assessmentError || !assessmentRow?.id) {
    throw new Error(`Failed to create placement assessment: ${assessmentError?.message ?? 'unknown error'}`);
  }

  const assessmentId = assessmentRow.id as number;

  const { data: sectionRows, error: sectionError } = await supabase
    .from('assessment_sections')
    .insert([
      {
        assessment_id: assessmentId,
        section_order: 1,
        title: 'Mathematics',
        instructions: 'Answer a few math questions to help personalize your path.',
      },
      {
        assessment_id: assessmentId,
        section_order: 2,
        title: 'English Language Arts',
        instructions: 'Answer a few reading and writing questions to help personalize your path.',
      },
      {
        assessment_id: assessmentId,
        section_order: 3,
        title: 'Science',
        instructions: 'Answer a few science questions to help personalize your path.',
      },
    ])
    .select('id, title');

  if (sectionError || !sectionRows?.length) {
    throw new Error(`Failed to create placement sections: ${sectionError?.message ?? 'unknown error'}`);
  }

  const sectionIdByTitle = new Map<string, number>();
  sectionRows.forEach((row) => {
    sectionIdByTitle.set((row.title as string).toLowerCase(), row.id as number);
  });

  const insertQuestion = async (payload: {
    subjectId: number;
    subjectKey: 'math' | 'ela' | 'science';
    item: DiagnosticItem;
  }): Promise<number> => {
    const { subjectId, subjectKey, item } = payload;

    const { data: questionRow, error: questionError } = await supabase
      .from('question_bank')
      .insert({
        subject_id: subjectId,
        question_type: item.type ?? 'multiple_choice',
        prompt: item.prompt,
        difficulty: item.difficulty ?? 3,
        tags: [item.standard, item.strand].filter((tag): tag is string => typeof tag === 'string' && tag.trim().length),
        metadata: {
          placement: item.placement ?? {},
          strand: item.strand,
          standard: item.standard,
          purpose: 'placement',
          grade_band: gradeBand,
          subject_key: subjectKey,
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
    config: DiagnosticConfig;
    subjectId: number;
    subjectKey: 'math' | 'ela' | 'science';
    sectionTitle: string;
  }) => {
    const { config, subjectId, subjectKey, sectionTitle } = payload;
    const sectionId = sectionIdByTitle.get(sectionTitle.toLowerCase());
    if (!sectionId) {
      throw new Error(`Missing section id for ${sectionTitle}.`);
    }

    const picked = pickItems(config, itemsPerSubject);
    if (picked.length < 2) {
      throw new Error(`Not enough items for ${subjectKey} to seed placement.`);
    }

    let questionOrder = 1;
    for (const item of picked) {
      if (!item.prompt?.trim().length) {
        throw new Error(`Item ${item.id} is missing a prompt.`);
      }
      if (!Array.isArray(item.options) || item.options.length < 2) {
        throw new Error(`Item ${item.id} is missing options.`);
      }

      const questionId = await insertQuestion({ subjectId, subjectKey, item });
      const { error: linkError } = await supabase
        .from('assessment_questions')
        .insert({
          section_id: sectionId,
          question_id: questionId,
          question_order: questionOrder,
          weight: 1.0,
          metadata: { generated_by: 'seed_placement_assessment', subject_key: subjectKey },
        });

      if (linkError) {
        throw new Error(`Failed to link placement question ${item.id}: ${linkError.message}`);
      }

      questionOrder += 1;
    }
  };

  await seedSubject({ config: mathConfig, subjectId: mathSubjectId, subjectKey: 'math', sectionTitle: 'Mathematics' });
  await seedSubject({
    config: elaConfig,
    subjectId: elaSubjectId,
    subjectKey: 'ela',
    sectionTitle: 'English Language Arts',
  });
  await seedSubject({ config: scienceConfig, subjectId: scienceSubjectId, subjectKey: 'science', sectionTitle: 'Science' });

  console.log(`Seeded placement assessment ${assessmentId} for grade band ${gradeBand} (source grade ${sourceGrade}).`);
};

export async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const supabase = createServiceRoleClient();
  await seedPlacementAssessment(supabase, {
    filePath: args.file,
    gradeBand: args.gradeBand,
    sourceGrade: args.sourceGrade,
    itemsPerSubject: args.itemsPerSubject,
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

