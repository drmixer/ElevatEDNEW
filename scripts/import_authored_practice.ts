import path from 'node:path';
import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadStructuredFile } from './utils/files.js';
import { createServiceRoleClient, resolveModules } from './utils/supabase.js';

type PracticeOption = { text: string; isCorrect: boolean; feedback?: string | null };

type PracticeItem = {
  moduleSlug: string;
  lessonSlug?: string | null;
  prompt: string;
  type?: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'fill_blank';
  difficulty?: number;
  explanation?: string | null;
  skills?: string[];
  standards?: string[];
  tags?: string[];
  options?: PracticeOption[];
  metadata?: Record<string, unknown>;
};

type ModuleRecord = {
  id: number;
  slug: string;
  subject: string;
  grade_band: string;
};

type SubjectRecord = { id: number; name: string };

const DEFAULT_FILE = path.resolve(process.cwd(), 'data/practice/authored_practice_sample.json');

const normalizeItem = (item: PracticeItem): PracticeItem => ({
  ...item,
  moduleSlug: item.moduleSlug.trim(),
  lessonSlug: item.lessonSlug?.trim() ?? null,
  prompt: item.prompt.trim(),
  type: item.type ?? 'multiple_choice',
  difficulty: item.difficulty ?? 3,
  explanation: item.explanation ?? null,
  skills: item.skills ?? [],
  standards: item.standards ?? [],
  tags: item.tags ?? [],
  options: item.options ?? [],
  metadata: item.metadata ?? {},
});

const ensureValid = (item: PracticeItem): void => {
  if (!item.prompt) throw new Error('Practice item is missing prompt.');
  if (item.type === 'multiple_choice' || item.options?.length) {
    if (!item.options || item.options.length < 2) {
      throw new Error(`Item "${item.prompt.slice(0, 40)}..." must include at least two options.`);
    }
    if (!item.options.some((opt) => opt.isCorrect)) {
      throw new Error(`Item "${item.prompt.slice(0, 40)}..." must include a correct option.`);
    }
  }
};

const fetchModules = async (supabase: SupabaseClient, ids: number[]): Promise<ModuleRecord[]> => {
  const { data, error } = await supabase
    .from('modules')
    .select('id, slug, subject, grade_band')
    .in('id', ids);
  if (error) {
    throw new Error(`Failed to fetch modules: ${error.message}`);
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
    if (name) map.set(name, { id: record.id as number, name });
  }
  return map;
};

const flattenPracticeDataset = (raw: unknown): PracticeItem[] => {
  if (Array.isArray(raw)) {
    return raw as PracticeItem[];
  }

  if (raw && typeof raw === 'object') {
    const entries = Object.entries(raw as Record<string, unknown>);
    const items: PracticeItem[] = [];

    for (const [moduleSlug, value] of entries) {
      if (!Array.isArray(value)) {
        continue;
      }
      for (const item of value) {
        if (item && typeof item === 'object') {
          items.push({
            ...(item as Omit<PracticeItem, 'moduleSlug'>),
            moduleSlug,
          });
        }
      }
    }

    return items;
  }

  throw new Error('Unsupported practice dataset shape. Expected an array or mapping of moduleSlug -> items[].');
};

const insertQuestion = async (
  supabase: SupabaseClient,
  subjectId: number,
  item: PracticeItem,
  module: ModuleRecord,
): Promise<number> => {
  const metadata: Record<string, unknown> = {
    module_slug: module.slug,
    lesson_slug: item.lessonSlug ?? undefined,
    skills: item.skills,
    standards: item.standards,
    imported_at: new Date().toISOString(),
    source: 'authored_practice_import',
    ...item.metadata,
  };

  const { data, error } = await supabase
    .from('question_bank')
    .insert({
      subject_id: subjectId,
      question_type: item.type ?? 'multiple_choice',
      prompt: item.prompt,
      solution_explanation: item.explanation ?? null,
      difficulty: item.difficulty ?? 3,
      tags: item.tags && item.tags.length > 0 ? item.tags : item.standards ?? [],
      metadata,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert question for module ${module.slug}: ${error?.message ?? 'unknown'}`);
  }

  const questionId = data.id as number;

  if (item.options && item.options.length > 0) {
    const { error: optionsError } = await supabase.from('question_options').insert(
      item.options.map((option, index) => ({
        question_id: questionId,
        option_order: index + 1,
        content: option.text,
        is_correct: option.isCorrect,
        feedback: option.feedback ?? null,
      })),
    );
    if (optionsError) {
      throw new Error(`Failed to insert options for question ${questionId}: ${optionsError.message}`);
    }
  }

  return questionId;
};

const parseArgs = (): { file: string } => {
  const args = process.argv.slice(2);
  let file = DEFAULT_FILE;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--file' || arg === '--path') {
      const next = args[i + 1];
      if (!next) throw new Error(`Expected value after ${arg}`);
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
  const raw = await loadStructuredFile<unknown>(file);
  const items = flattenPracticeDataset(raw).map(normalizeItem);
  if (!Array.isArray(items) || items.length === 0) {
    console.log(`No practice items found in ${file}`);
    return;
  }

  items.forEach(ensureValid);
  const moduleSlugs = Array.from(new Set(items.map((item) => item.moduleSlug)));

  const supabase = createServiceRoleClient();
  const modules = await resolveModules(supabase, moduleSlugs);
  const moduleDetails = await fetchModules(
    supabase,
    Array.from(new Set(Array.from(modules.values()).map((m) => m.id))),
  );
  const subjects = await fetchSubjects(supabase);

  let inserted = 0;
  for (const item of items) {
    const moduleRecord = modules.get(item.moduleSlug) ?? modules.get(item.moduleSlug.trim());
    if (!moduleRecord) {
      throw new Error(`Module "${item.moduleSlug}" not found`);
    }
    const moduleDetail = moduleDetails.find((m) => m.id === moduleRecord.id);
    if (!moduleDetail) {
      throw new Error(`Module detail missing for "${item.moduleSlug}"`);
    }
    const subject = subjects.get(moduleDetail.subject);
    if (!subject) {
      throw new Error(`Subject "${moduleDetail.subject}" not found`);
    }
    await insertQuestion(supabase, subject.id, item, moduleDetail);
    inserted += 1;
  }

  console.log(`Imported ${inserted} authored practice items from ${file}`);
};

const invokedFromCli =
  process.argv[1]?.includes('import_authored_practice.ts') ||
  process.argv[1]?.includes('import_authored_practice.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
