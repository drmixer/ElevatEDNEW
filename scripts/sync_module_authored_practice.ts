import 'dotenv/config';

import path from 'node:path';
import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadStructuredFile } from './utils/files.js';
import { createServiceRoleClient } from './utils/supabase.js';
import { assessPracticeQuestionQuality } from '../shared/questionQuality.js';

type PracticeOption = {
  text: string;
  isCorrect: boolean;
  feedback?: string | null;
};

type PracticeItem = {
  moduleSlug?: string;
  lessonSlug?: string | null;
  prompt: string;
  type?: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'fill_blank';
  difficulty?: number;
  explanation?: string | null;
  skills?: string[];
  standards?: string[];
  tags?: string[];
  options?: PracticeOption[];
};

type CliOptions = {
  apply: boolean;
  file: string;
  lessonSlug: string | null;
  moduleSlug: string;
  replaceLessonSkills: boolean;
  skillName: string;
};

type ModuleRecord = {
  id: number;
  slug: string;
  subject: string;
};

type LessonRecord = {
  id: number;
  slug: string;
  module_id: number;
  visibility?: string | null;
};

type SubjectRecord = {
  id: number;
  name: string;
};

const MANAGED_BY = 'sync_module_authored_practice';
const DEFAULT_FILE = path.resolve(process.cwd(), 'data/practice/authored_practice_items.json');

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    apply: false,
    file: DEFAULT_FILE,
    lessonSlug: null,
    moduleSlug: '',
    replaceLessonSkills: false,
    skillName: '',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--module-slug') {
      const value = args[index + 1];
      if (!value) throw new Error('Expected value after --module-slug');
      options.moduleSlug = value.trim();
      index += 1;
      continue;
    }
    if (arg === '--lesson-slug') {
      const value = args[index + 1];
      if (!value) throw new Error('Expected value after --lesson-slug');
      options.lessonSlug = value.trim();
      index += 1;
      continue;
    }
    if (arg === '--skill-name') {
      const value = args[index + 1];
      if (!value) throw new Error('Expected value after --skill-name');
      options.skillName = value.trim();
      index += 1;
      continue;
    }
    if (arg === '--file' || arg === '--path') {
      const value = args[index + 1];
      if (!value) throw new Error(`Expected value after ${arg}`);
      options.file = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (arg === '--replace-lesson-skills') {
      options.replaceLessonSkills = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.moduleSlug) {
    throw new Error('Missing required --module-slug');
  }
  if (!options.skillName) {
    throw new Error('Missing required --skill-name');
  }

  return options;
};

const normalizeItem = (item: PracticeItem, moduleSlug: string): PracticeItem => ({
  ...item,
  moduleSlug,
  lessonSlug: item.lessonSlug?.trim() ?? null,
  prompt: item.prompt.trim(),
  type: item.type ?? 'multiple_choice',
  difficulty: item.difficulty ?? 2,
  explanation: item.explanation?.trim() ?? null,
  skills: item.skills ?? [],
  standards: item.standards ?? [],
  tags: item.tags ?? [],
  options: (item.options ?? []).map((option) => ({
    text: option.text.trim(),
    isCorrect: Boolean(option.isCorrect),
    feedback: option.feedback?.trim() ?? null,
  })),
});

const extractItems = async (file: string, moduleSlug: string): Promise<PracticeItem[]> => {
  const raw = await loadStructuredFile<unknown>(file);

  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is PracticeItem => Boolean(item && typeof item === 'object'))
      .filter((item) => item.moduleSlug === moduleSlug)
      .map((item) => normalizeItem(item, moduleSlug));
  }

  if (raw && typeof raw === 'object') {
    const moduleItems = (raw as Record<string, unknown>)[moduleSlug];
    if (!Array.isArray(moduleItems)) {
      return [];
    }
    return moduleItems
      .filter((item): item is PracticeItem => Boolean(item && typeof item === 'object'))
      .map((item) => normalizeItem(item, moduleSlug));
  }

  throw new Error(`Unsupported practice data shape in ${file}`);
};

const validateItems = (items: PracticeItem[], skillName: string): void => {
  if (items.length === 0) {
    throw new Error('No practice items found for the selected module.');
  }

  for (const item of items) {
    const quality = assessPracticeQuestionQuality({
      prompt: item.prompt,
      type: item.type ?? 'multiple_choice',
      options: (item.options ?? []).map((option) => ({
        text: option.text,
        isCorrect: option.isCorrect,
      })),
    });

    if (quality.shouldBlock) {
      throw new Error(`Practice item failed quality gate: "${item.prompt}" (${quality.reasons.join(', ')})`);
    }

    if (!(item.options ?? []).some((option) => option.isCorrect)) {
      throw new Error(`Practice item is missing a correct option: "${item.prompt}"`);
    }

    if ((item.skills ?? []).length > 0 && !(item.skills ?? []).includes(skillName)) {
      throw new Error(`Practice item has mismatched skills for "${item.prompt}"`);
    }
  }
};

const ensureModule = async (supabase: SupabaseClient, moduleSlug: string): Promise<ModuleRecord> => {
  const { data, error } = await supabase
    .from('modules')
    .select('id, slug, subject')
    .eq('slug', moduleSlug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load module "${moduleSlug}": ${error.message}`);
  }
  if (!data) {
    throw new Error(`Module "${moduleSlug}" not found.`);
  }

  return data as ModuleRecord;
};

const resolveLesson = async (
  supabase: SupabaseClient,
  module: ModuleRecord,
  requestedLessonSlug: string | null,
): Promise<LessonRecord> => {
  if (requestedLessonSlug) {
    const { data, error } = await supabase
      .from('lessons')
      .select('id, slug, module_id, visibility')
      .eq('module_id', module.id)
      .eq('slug', requestedLessonSlug)
      .order('id');

    if (error) {
      throw new Error(`Failed to load lesson "${requestedLessonSlug}": ${error.message}`);
    }
    const lessons = (data ?? []) as LessonRecord[];
    if (lessons.length === 0) {
      throw new Error(`Lesson "${requestedLessonSlug}" not found.`);
    }
    if (lessons.length === 1) {
      return lessons[0];
    }

    const preferredLesson =
      lessons.find((lesson) => lesson.visibility === 'public') ??
      lessons.find((lesson) => lesson.visibility === 'draft') ??
      lessons[0];

    console.warn(
      `[sync_module_authored_practice] Multiple lessons matched slug "${requestedLessonSlug}" in module "${module.slug}". Using lesson ${preferredLesson.id} with visibility "${preferredLesson.visibility ?? 'unknown'}".`,
    );

    return preferredLesson;
  }

  const { data, error } = await supabase
    .from('lessons')
    .select('id, slug, module_id, visibility')
    .eq('module_id', module.id);

  if (error) {
    throw new Error(`Failed to load lessons for module "${module.slug}": ${error.message}`);
  }

  const lessons = (data ?? []) as LessonRecord[];
  if (lessons.length !== 1) {
    throw new Error(`Module "${module.slug}" has ${lessons.length} lessons. Pass --lesson-slug explicitly.`);
  }

  return lessons[0];
};

const resolveSubject = async (supabase: SupabaseClient, subjectName: string): Promise<SubjectRecord> => {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('name', subjectName)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load subject "${subjectName}": ${error.message}`);
  }
  if (!data) {
    throw new Error(`Subject "${subjectName}" not found.`);
  }

  return data as SubjectRecord;
};

const ensureSkill = async (
  supabase: SupabaseClient,
  subjectId: number,
  skillName: string,
): Promise<number> => {
  const { data: existing, error: existingError } = await supabase
    .from('skills')
    .select('id')
    .eq('name', skillName)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to look up skill "${skillName}": ${existingError.message}`);
  }

  if (existing?.id) {
    return existing.id as number;
  }

  const { data, error } = await supabase
    .from('skills')
    .insert({
      subject_id: subjectId,
      name: skillName,
      description: `Skill: ${skillName.replace(/_/g, ' ')}`,
      metadata: {
        seeded: true,
        seeded_at: new Date().toISOString(),
        managed_by: MANAGED_BY,
      },
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create skill "${skillName}": ${error?.message ?? 'unknown error'}`);
  }

  return data.id as number;
};

const fetchManagedQuestionIds = async (
  supabase: SupabaseClient,
  lessonSlug: string,
): Promise<number[]> => {
  const { data, error } = await supabase
    .from('question_bank')
    .select('id')
    .contains('metadata', {
      managed_by: MANAGED_BY,
      lesson_slug: lessonSlug,
    });

  if (error) {
    throw new Error(`Failed to load managed question rows: ${error.message}`);
  }

  return (data ?? []).map((row) => row.id as number);
};

const deleteManagedQuestions = async (supabase: SupabaseClient, questionIds: number[]): Promise<void> => {
  if (questionIds.length === 0) {
    return;
  }

  const { error: optionError } = await supabase.from('question_options').delete().in('question_id', questionIds);
  if (optionError) {
    throw new Error(`Failed to delete managed question options: ${optionError.message}`);
  }

  const { error: questionSkillError } = await supabase.from('question_skills').delete().in('question_id', questionIds);
  if (questionSkillError) {
    throw new Error(`Failed to delete managed question skill links: ${questionSkillError.message}`);
  }

  const { error: questionError } = await supabase.from('question_bank').delete().in('id', questionIds);
  if (questionError) {
    throw new Error(`Failed to delete managed questions: ${questionError.message}`);
  }
};

const insertManagedQuestion = async (
  supabase: SupabaseClient,
  item: PracticeItem,
  lesson: LessonRecord,
  module: ModuleRecord,
  subjectId: number,
  skillId: number,
  sourceFile: string,
  skillName: string,
): Promise<number> => {
  const { data, error } = await supabase
    .from('question_bank')
    .insert({
      subject_id: subjectId,
      question_type: item.type ?? 'multiple_choice',
      prompt: item.prompt,
      solution_explanation: item.explanation ?? null,
      difficulty: item.difficulty ?? 2,
      tags: item.tags && item.tags.length > 0 ? item.tags : ['practice', 'authored'],
      metadata: {
        managed_by: MANAGED_BY,
        source_of_truth_file: sourceFile,
        module_slug: module.slug,
        lesson_slug: lesson.slug,
        skill_name: skillName,
        standards: item.standards ?? [],
        synced_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert question "${item.prompt}": ${error?.message ?? 'unknown error'}`);
  }

  const questionId = data.id as number;
  const optionsPayload = (item.options ?? []).map((option, index) => ({
    question_id: questionId,
    option_order: index + 1,
    content: option.text,
    is_correct: option.isCorrect,
    feedback: option.feedback ?? null,
  }));

  const { error: optionError } = await supabase.from('question_options').insert(optionsPayload);
  if (optionError) {
    throw new Error(`Failed to insert options for question "${item.prompt}": ${optionError.message}`);
  }

  const { error: questionSkillError } = await supabase.from('question_skills').insert({
    question_id: questionId,
    skill_id: skillId,
  });
  if (questionSkillError) {
    throw new Error(`Failed to link question "${item.prompt}" to skill ${skillId}: ${questionSkillError.message}`);
  }

  return questionId;
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  const sourceFile = path.relative(process.cwd(), options.file);
  const items = await extractItems(options.file, options.moduleSlug);
  validateItems(items, options.skillName);

  const supabase = createServiceRoleClient();
  const module = await ensureModule(supabase, options.moduleSlug);
  const lesson = await resolveLesson(supabase, module, options.lessonSlug);
  const subject = await resolveSubject(supabase, module.subject);
  const skillId = await ensureSkill(supabase, subject.id, options.skillName);
  const managedQuestionIds = await fetchManagedQuestionIds(supabase, lesson.slug);

  console.log(
    JSON.stringify(
      {
        apply: options.apply,
        moduleSlug: module.slug,
        lessonSlug: lesson.slug,
        lessonId: lesson.id,
        skillName: options.skillName,
        skillId,
        itemCount: items.length,
        managedQuestionIds,
        replaceLessonSkills: options.replaceLessonSkills,
      },
      null,
      2,
    ),
  );

  if (!options.apply) {
    console.log('Dry run only. Re-run with --apply to write changes.');
    return;
  }

  if (managedQuestionIds.length > 0) {
    await deleteManagedQuestions(supabase, managedQuestionIds);
  }

  const { error: lessonSkillError } = await supabase
    .from('lesson_skills')
    .upsert({ lesson_id: lesson.id, skill_id: skillId }, { onConflict: 'lesson_id,skill_id' });

  if (lessonSkillError) {
    throw new Error(`Failed to link lesson ${lesson.id} to skill ${skillId}: ${lessonSkillError.message}`);
  }

  if (options.replaceLessonSkills) {
    const { error: deleteLessonSkillsError } = await supabase
      .from('lesson_skills')
      .delete()
      .eq('lesson_id', lesson.id)
      .neq('skill_id', skillId);

    if (deleteLessonSkillsError) {
      throw new Error(`Failed to replace lesson skills for lesson ${lesson.id}: ${deleteLessonSkillsError.message}`);
    }
  }

  const insertedQuestionIds: number[] = [];
  for (const item of items) {
    insertedQuestionIds.push(
      await insertManagedQuestion(supabase, item, lesson, module, subject.id, skillId, sourceFile, options.skillName),
    );
  }

  console.log(
    JSON.stringify(
      {
        lessonId: lesson.id,
        skillId,
        insertedQuestionIds,
      },
      null,
      2,
    ),
  );
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
