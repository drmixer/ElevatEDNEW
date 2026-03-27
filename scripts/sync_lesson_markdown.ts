import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { createServiceRoleClient } from './utils/supabase.js';

type CliOptions = {
  apply: boolean;
  file: string;
  lessonId: number | null;
  lessonSlug: string | null;
};

const MANAGED_BY = 'sync_lesson_markdown';

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    apply: false,
    file: '',
    lessonId: null,
    lessonSlug: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--file' || arg === '--path') {
      const value = args[index + 1];
      if (!value) throw new Error(`Expected value after ${arg}`);
      options.file = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (arg === '--lesson-id') {
      const value = Number.parseInt(args[index + 1] ?? '', 10);
      if (!Number.isFinite(value) || value <= 0) throw new Error('Expected positive integer after --lesson-id');
      options.lessonId = value;
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
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.file) {
    throw new Error('Missing required --file');
  }
  if (!options.lessonId && !options.lessonSlug) {
    throw new Error('Provide --lesson-id or --lesson-slug');
  }

  return options;
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  const markdown = await fs.readFile(options.file, 'utf8');

  if (typeof markdown !== 'string' || !markdown.trim()) {
    throw new Error(`No markdown content found in ${options.file}`);
  }

  const supabase = createServiceRoleClient();
  let query = supabase.from('lessons').select('id, slug, title, metadata');
  if (options.lessonId) {
    query = query.eq('id', options.lessonId);
  } else if (options.lessonSlug) {
    query = query.eq('slug', options.lessonSlug);
  }

  const { data: lesson, error: lessonError } = await query.maybeSingle();
  if (lessonError) {
    throw new Error(`Failed to load lesson: ${lessonError.message}`);
  }
  if (!lesson) {
    throw new Error('Lesson not found.');
  }

  const nextMetadata = {
    ...((lesson.metadata as Record<string, unknown> | null) ?? {}),
    managed_by: MANAGED_BY,
    source_of_truth_file: path.relative(process.cwd(), options.file),
    managed_at: new Date().toISOString(),
  };

  console.log(
    JSON.stringify(
      {
        apply: options.apply,
        lessonId: lesson.id,
        lessonSlug: lesson.slug,
        title: lesson.title,
        sourceFile: path.relative(process.cwd(), options.file),
        preview: markdown.slice(0, 220),
      },
      null,
      2,
    ),
  );

  if (!options.apply) {
    console.log('Dry run only. Re-run with --apply to write changes.');
    return;
  }

  const { error: updateError } = await supabase
    .from('lessons')
    .update({
      content: markdown,
      metadata: nextMetadata,
    })
    .eq('id', lesson.id);

  if (updateError) {
    throw new Error(`Failed to update lesson ${lesson.id}: ${updateError.message}`);
  }

  console.log(JSON.stringify({ lessonId: lesson.id, updated: true }, null, 2));
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
