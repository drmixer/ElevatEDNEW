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

type ScoreBand = {
  name: string;
  min?: number;
  max?: number;
  placement?: string[];
};

type BlueprintSection = {
  id: string;
  strand: string;
  standards: string[];
  itemCount: number;
  scoreBands?: ScoreBand[];
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
};

const DEFAULT_FILE = path.resolve(process.cwd(), 'data/assessments/diagnostics_phase13.json');

const normalizeSubject = (subject: string): string => {
  const key = subject.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return SUBJECT_LABELS[key] ?? subject;
};

const fetchSubjects = async (supabase: SupabaseClient): Promise<Map<string, SubjectRecord>> => {
  const { data, error } = await supabase.from('subjects').select('id, name');
  if (error) {
    throw new Error(`Failed to load subjects: ${error.message}`);
  }
  const map = new Map<string, SubjectRecord>();
  (data ?? []).forEach((row) => {
    const name = (row.name as string)?.trim();
    if (name) {
      map.set(name, { id: row.id as number, name });
    }
  });
  return map;
};

const deleteExistingDiagnostic = async (
  supabase: SupabaseClient,
  gradeBand: string,
  subjectKey: string,
): Promise<void> => {
  const { data: assessments, error: assessmentError } = await supabase
    .from('assessments')
    .select('id')
    .contains('metadata', { purpose: 'diagnostic', grade_band: gradeBand, subject_key: subjectKey });

  if (assessmentError) {
    throw new Error(`Failed to find existing diagnostics: ${assessmentError.message}`);
  }

  const assessmentIds = (assessments ?? []).map((row) => row.id as number);
  if (!assessmentIds.length) return;

  const { data: sections, error: sectionsError } = await supabase
    .from('assessment_sections')
    .select('id')
    .in('assessment_id', assessmentIds);

  if (sectionsError) {
    throw new Error(`Failed to load diagnostic sections: ${sectionsError.message}`);
  }

  const sectionIds = (sections ?? []).map((row) => row.id as number);
  if (sectionIds.length) {
    const { data: questionLinks, error: linksError } = await supabase
      .from('assessment_questions')
      .select('question_id')
      .in('section_id', sectionIds);

    if (linksError) {
      throw new Error(`Failed to load diagnostic question links: ${linksError.message}`);
    }

    const questionIds = Array.from(new Set((questionLinks ?? []).map((row) => row.question_id as number)));
    if (questionIds.length) {
      const { error } = await supabase.from('question_bank').delete().in('id', questionIds);
      if (error) {
        throw new Error(`Failed to delete diagnostic question bank entries: ${error.message}`);
      }
    }

    const { error: deleteLinksError } = await supabase.from('assessment_questions').delete().in('section_id', sectionIds);
    if (deleteLinksError) {
      throw new Error(`Failed to delete diagnostic links: ${deleteLinksError.message}`);
    }

    const { error: deleteSectionsError } = await supabase.from('assessment_sections').delete().in('id', sectionIds);
    if (deleteSectionsError) {
      throw new Error(`Failed to delete diagnostic sections: ${deleteSectionsError.message}`);
    }
  }

  const { error: deleteAssessmentsError } = await supabase.from('assessments').delete().in('id', assessmentIds);
  if (deleteAssessmentsError) {
    throw new Error(`Failed to delete diagnostic assessments: ${deleteAssessmentsError.message}`);
  }
};

const insertDiagnostic = async (
  supabase: SupabaseClient,
  config: DiagnosticConfig,
  subjectId: number | null,
  subjectKey: string,
): Promise<void> => {
  const metadata = {
    purpose: 'diagnostic',
    grade_band: config.grade_band,
    subject_key: subjectKey,
    blueprint: config.blueprint,
  };

  const { data: assessmentRow, error: assessmentError } = await supabase
    .from('assessments')
    .insert({
      title: config.title,
      description: config.description ?? null,
      subject_id: subjectId,
      module_id: null,
      is_adaptive: true,
      estimated_duration_minutes: config.estimatedDurationMinutes ?? 20,
      metadata,
    })
    .select('id')
    .single();

  if (assessmentError || !assessmentRow) {
    throw new Error(`Failed to create diagnostic assessment ${config.title}: ${assessmentError?.message ?? 'unknown error'}`);
  }

  const assessmentId = assessmentRow.id as number;
  const sectionInserts = (config.blueprint.sections ?? []).map((section, index) => ({
    assessment_id: assessmentId,
    section_order: index + 1,
    title: section.strand ?? `Section ${index + 1}`,
    instructions: 'Answer to calibrate your starting path. Evidence is optional but encouraged.',
    metadata: {
      standards: section.standards ?? [],
      score_bands: section.scoreBands ?? [],
    },
  }));

  const { data: sectionRows, error: sectionError } = await supabase
    .from('assessment_sections')
    .insert(sectionInserts)
    .select('id, title');

  if (sectionError || !sectionRows) {
    throw new Error(`Failed to create diagnostic sections for ${config.title}: ${sectionError?.message ?? 'unknown error'}`);
  }

  const sectionLookup = new Map<string, number>();
  (sectionRows ?? []).forEach((row) => {
    const title = (row.title as string)?.toLowerCase().trim();
    if (title) {
      sectionLookup.set(title, row.id as number);
    }
  });

  let questionOrder = 1;

  for (const item of config.items) {
    if (!item.prompt || !item.options?.length) {
      throw new Error(`Diagnostic item ${item.id} missing prompt/options.`);
    }
    const sectionId =
      sectionLookup.get((item.strand ?? '').toLowerCase().trim()) ??
      (sectionRows[0]?.id as number | undefined) ??
      null;

    const tags: string[] = [];
    if (item.standard) tags.push(item.standard);
    if (item.strand) tags.push(item.strand);

    const questionMeta: Record<string, unknown> = {
      placement: item.placement ?? {},
      strand: item.strand,
      standard: item.standard,
      purpose: 'diagnostic',
      grade_band: config.grade_band,
      subject_key: subjectKey,
    };

    const { data: questionRow, error: questionError } = await supabase
      .from('question_bank')
      .insert({
        subject_id: subjectId,
        question_type: item.type ?? 'multiple_choice',
        prompt: item.prompt,
        difficulty: item.difficulty ?? 3,
        tags,
        metadata: questionMeta,
      })
      .select('id')
      .single();

    if (questionError || !questionRow) {
      throw new Error(`Failed to insert diagnostic question ${item.id}: ${questionError?.message ?? 'unknown error'}`);
    }

    const questionId = questionRow.id as number;

    const optionsPayload = item.options.map((option, idx) => ({
      question_id: questionId,
      option_order: idx + 1,
      content: option.text,
      is_correct: option.isCorrect,
      feedback: option.feedback ?? null,
    }));

    const { error: optionsError } = await supabase.from('question_options').insert(optionsPayload);
    if (optionsError) {
      throw new Error(`Failed to insert options for diagnostic question ${item.id}: ${optionsError.message}`);
    }

    const { error: linkError } = await supabase.from('assessment_questions').insert({
      section_id: sectionId,
      question_id: questionId,
      question_order: questionOrder,
      weight: 1,
      metadata: questionMeta,
    });

    if (linkError) {
      throw new Error(`Failed to link diagnostic question ${item.id}: ${linkError.message}`);
    }

    questionOrder += 1;
  }
};

const main = async () => {
  const config = await loadStructuredFile<DiagnosticFile>(DEFAULT_FILE);
  const entries = Object.values(config ?? {});

  if (!entries.length) {
    console.log(`No diagnostic definitions found in ${DEFAULT_FILE}`);
    return;
  }

  const supabase = createServiceRoleClient();
  const subjects = await fetchSubjects(supabase);

  for (const entry of entries) {
    const subjectLabel = normalizeSubject(entry.subject);
    const subjectId = subjects.get(subjectLabel)?.id ?? null;
    await deleteExistingDiagnostic(supabase, entry.grade_band, entry.subject);
    await insertDiagnostic(supabase, entry, subjectId, entry.subject);
    console.log(`Seeded diagnostic for grade ${entry.grade_band} ${subjectLabel}: ${entry.items.length} items.`);
  }
};

const invokedFromCli =
  process.argv[1]?.includes('seed_diagnostic_assessments.ts') ||
  process.argv[1]?.includes('seed_diagnostic_assessments.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
