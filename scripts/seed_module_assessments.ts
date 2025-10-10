import path from 'node:path';
import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadStructuredFile } from './utils/files.js';
import { createServiceRoleClient, resolveModules } from './utils/supabase.js';

type QuizOption = {
  text: string;
  isCorrect: boolean;
  feedback?: string | null;
};

type QuizQuestion = {
  id?: string;
  prompt: string;
  type?: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'fill_blank';
  difficulty?: number;
  explanation?: string | null;
  standards?: string[];
  tags?: string[];
  options: QuizOption[];
};

type QuizDefinition = {
  title?: string;
  description?: string;
  estimatedDuration?: number;
  sectionTitle?: string;
  standards?: string[];
  questions: QuizQuestion[];
};

type QuizConfig = Record<string, QuizDefinition>;

type ModuleRecord = {
  id: number;
  slug: string;
  title: string;
  subject: string;
  grade_band: string;
};

type SubjectRecord = {
  id: number;
  name: string;
};

const DEFAULT_FILE = path.resolve(process.cwd(), 'data/assessments/module_quizzes.json');

const ensureQuestionsValid = (moduleSlug: string, quiz: QuizDefinition): void => {
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    throw new Error(`Module ${moduleSlug} quiz must include at least one question.`);
  }
  quiz.questions.forEach((question, index) => {
    if (!question.prompt || !question.options || question.options.length < 2) {
      throw new Error(`Question ${index + 1} for module ${moduleSlug} must include prompt and >=2 options.`);
    }
    if (!question.options.some((option) => option.isCorrect)) {
      throw new Error(`Question ${index + 1} for module ${moduleSlug} must include a correct option.`);
    }
  });
};

const fetchModuleMetadata = async (supabase: SupabaseClient, moduleIds: number[]): Promise<ModuleRecord[]> => {
  if (moduleIds.length === 0) return [];
  const { data, error } = await supabase
    .from('modules')
    .select('id, slug, title, subject, grade_band')
    .in('id', moduleIds);

  if (error) {
    throw new Error(`Failed to load module metadata: ${error.message}`);
  }

  return (data ?? []) as ModuleRecord[];
};

const fetchSubjects = async (supabase: SupabaseClient): Promise<Map<string, SubjectRecord>> => {
  const { data, error } = await supabase.from('subjects').select('id, name');
  if (error) {
    throw new Error(`Failed to load subjects: ${error.message}`);
  }
  const map = new Map<string, SubjectRecord>();
  for (const record of data ?? []) {
    const name = (record.name as string)?.trim();
    if (name) {
      map.set(name, { id: record.id as number, name });
    }
  }
  return map;
};

const deleteExistingBaseline = async (
  supabase: SupabaseClient,
  moduleId: number,
  moduleSlug: string,
): Promise<void> => {
  const { data: assessments, error: assessmentError } = await supabase
    .from('assessments')
    .select('id')
    .eq('module_id', moduleId)
    .contains('metadata', { module_slug: moduleSlug, purpose: 'baseline' });

  if (assessmentError) {
    throw new Error(`Failed to check existing assessments for module ${moduleSlug}: ${assessmentError.message}`);
  }

  const assessmentIds = assessments?.map((row) => row.id as number) ?? [];

  if (assessmentIds.length > 0) {
    const { data: sections, error: sectionsError } = await supabase
      .from('assessment_sections')
      .select('id')
      .in('assessment_id', assessmentIds);

    if (sectionsError) {
      throw new Error(`Failed to load assessment sections for module ${moduleSlug}: ${sectionsError.message}`);
    }

    const sectionIds = sections?.map((row) => row.id as number) ?? [];

    if (sectionIds.length > 0) {
      const { data: questionLinks, error: linksError } = await supabase
        .from('assessment_questions')
        .select('question_id')
        .in('section_id', sectionIds);

      if (linksError) {
        throw new Error(`Failed to load assessment questions for module ${moduleSlug}: ${linksError.message}`);
      }

      const questionIds = Array.from(
        new Set((questionLinks ?? []).map((row) => row.question_id as number)),
      );

      if (sectionIds.length > 0) {
        const { error: deleteQuestionsError } = await supabase
          .from('assessment_questions')
          .delete()
          .in('section_id', sectionIds);
        if (deleteQuestionsError) {
          throw new Error(
            `Failed to delete existing assessment questions for module ${moduleSlug}: ${deleteQuestionsError.message}`,
          );
        }
      }

      if (questionIds.length > 0) {
        const { error: deleteBankError } = await supabase
          .from('question_bank')
          .delete()
          .in('id', questionIds);
        if (deleteBankError) {
          throw new Error(`Failed to delete question bank entries for module ${moduleSlug}: ${deleteBankError.message}`);
        }
      }
    }

    if (sectionIds.length > 0) {
      const { error: deleteSectionsError } = await supabase
        .from('assessment_sections')
        .delete()
        .in('id', sectionIds);
      if (deleteSectionsError) {
        throw new Error(
          `Failed to delete assessment sections for module ${moduleSlug}: ${deleteSectionsError.message}`,
        );
      }
    }

    const { error: deleteAssessmentsError } = await supabase
      .from('assessments')
      .delete()
      .in('id', assessmentIds);
    if (deleteAssessmentsError) {
      throw new Error(`Failed to delete baseline assessments for module ${moduleSlug}: ${deleteAssessmentsError.message}`);
    }
  }
};

const insertQuestion = async (
  supabase: SupabaseClient,
  subjectId: number | null,
  module: ModuleRecord,
  question: QuizQuestion,
  index: number,
): Promise<number> => {
  const options = question.options.map((option, optionIndex) => ({
    option_order: optionIndex + 1,
    content: option.text,
    is_correct: Boolean(option.isCorrect),
    feedback: option.feedback ?? null,
  }));

  const metadata: Record<string, unknown> = {
    module_slug: module.slug,
    source: 'baseline_seed',
    position: index + 1,
  };
  if (question.standards?.length) {
    metadata.standards = question.standards;
  }
  if (question.id) {
    metadata.reference = question.id;
  }

  const { data, error } = await supabase
    .from('question_bank')
    .insert({
      subject_id: subjectId,
      question_type: question.type ?? 'multiple_choice',
      prompt: question.prompt,
      solution_explanation: question.explanation ?? null,
      difficulty: question.difficulty ?? 2,
      tags: question.tags ?? question.standards ?? [],
      metadata,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert question ${index + 1} for module ${module.slug}: ${error?.message ?? 'unknown'}`);
  }

  const questionId = data.id as number;

  const { error: optionsError } = await supabase.from('question_options').insert(
    options.map((option) => ({
      ...option,
      question_id: questionId,
    })),
  );

  if (optionsError) {
    throw new Error(
      `Failed to insert options for question ${index + 1} (module ${module.slug}): ${optionsError.message}`,
    );
  }

  return questionId;
};

const insertAssessment = async (
  supabase: SupabaseClient,
  module: ModuleRecord,
  subjectId: number | null,
  quiz: QuizDefinition,
  questionIds: number[],
): Promise<void> => {
  const metadata: Record<string, unknown> = {
    purpose: 'baseline',
    module_slug: module.slug,
    grade_band: module.grade_band,
  };
  if (quiz.standards?.length) {
    metadata.standards = quiz.standards;
  }

  const { data: assessmentRow, error: assessmentError } = await supabase
    .from('assessments')
    .insert({
      title: quiz.title ?? `Baseline quiz · ${module.title}`,
      description: quiz.description ?? `Baseline understanding check for ${module.title}`,
      subject_id: subjectId,
      module_id: module.id,
      is_adaptive: false,
      estimated_duration_minutes: quiz.estimatedDuration ?? 10,
      metadata,
    })
    .select('id')
    .single();

  if (assessmentError || !assessmentRow) {
    throw new Error(
      `Failed to create assessment for module ${module.slug}: ${assessmentError?.message ?? 'unknown error'}`,
    );
  }

  const assessmentId = assessmentRow.id as number;

  const { data: sectionRow, error: sectionError } = await supabase
    .from('assessment_sections')
    .insert({
      assessment_id: assessmentId,
      section_order: 1,
      title: quiz.sectionTitle ?? 'Baseline Check',
      instructions:
        'Answer the following questions to gauge your readiness. This quick check adapts recommendations based on completion.',
    })
    .select('id')
    .single();

  if (sectionError || !sectionRow) {
    throw new Error(
      `Failed to create assessment section for module ${module.slug}: ${sectionError?.message ?? 'unknown error'}`,
    );
  }

  const sectionId = sectionRow.id as number;

  const { error: questionsError } = await supabase.from('assessment_questions').insert(
    questionIds.map((questionId, index) => ({
      section_id: sectionId,
      question_id: questionId,
      question_order: index + 1,
      weight: 1,
      metadata: {
        module_slug: module.slug,
      },
    })),
  );

  if (questionsError) {
    throw new Error(
      `Failed to link questions to assessment for module ${module.slug}: ${questionsError.message}`,
    );
  }
};

const parseArgs = (): { file: string } => {
  const args = process.argv.slice(2);
  let file = DEFAULT_FILE;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--file' || arg === '--path') {
      const next = args[i + 1];
      if (!next) {
        throw new Error(`Expected value after ${arg}`);
      }
      file = path.resolve(process.cwd(), next);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { file };
};

const main = async () => {
  const { file } = parseArgs();
  const config = (await loadStructuredFile<QuizConfig>(file)) ?? {};

  const entries = Object.entries(config);
  if (entries.length === 0) {
    console.log(`No module quiz definitions found in ${file}`);
    return;
  }

  const moduleSlugs = entries.map(([slug]) => slug);
  const supabase = createServiceRoleClient();
  const moduleMap = await resolveModules(supabase, moduleSlugs);

  const moduleIds = Array.from(new Set(Array.from(moduleMap.values()).map((record) => record.id)));

  const hydratedModules = await fetchModuleMetadata(supabase, moduleIds);
  const moduleMetadata = new Map<number, ModuleRecord>();
  hydratedModules.forEach((module) => moduleMetadata.set(module.id, module));

  const subjects = await fetchSubjects(supabase);

  for (const [moduleSlug, quiz] of entries) {
    ensureQuestionsValid(moduleSlug, quiz);

    const moduleRecord = moduleMap.get(moduleSlug) ?? moduleMap.get(moduleSlug.trim());
    if (!moduleRecord) {
      throw new Error(`Module "${moduleSlug}" not resolved during processing.`);
    }

    const moduleDetails = moduleMetadata.get(moduleRecord.id);
    if (!moduleDetails) {
      throw new Error(`Module metadata missing for ${moduleSlug}.`);
    }

    const subject = subjects.get(moduleDetails.subject);
    const subjectId = subject?.id ?? null;

    await deleteExistingBaseline(supabase, moduleRecord.id, moduleSlug);

    const questionIds = [];
    for (let index = 0; index < quiz.questions.length; index += 1) {
      const questionId = await insertQuestion(
        supabase,
        subjectId,
        moduleDetails,
        quiz.questions[index]!,
        index,
      );
      questionIds.push(questionId);
    }

    await insertAssessment(supabase, moduleDetails, subjectId, quiz, questionIds);

    console.log(`Seeded baseline quiz for module ${moduleSlug} (${questionIds.length} questions)`);
  }
};

const invokedFromCli =
  process.argv[1]?.includes('seed_module_assessments.ts') ||
  process.argv[1]?.includes('seed_module_assessments.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
