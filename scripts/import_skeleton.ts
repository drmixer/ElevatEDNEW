import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createServiceRoleClient } from './utils/supabase.js';

type SkeletonModule = {
  grade: string;
  subject: string;
  strand: string;
  topic: string;
  subtopic?: string;
  suggested_source_category?: string;
  example_source?: string;
  license_requirement?: string;
  notes?: string;
};

type ModuleInsert = {
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  subject: string;
  grade_band: string;
  strand: string | null;
  topic: string | null;
  subtopic: string | null;
  suggested_source_category: string | null;
  example_source: string | null;
  license_requirement: string | null;
  notes: string | null;
  visibility: 'draft' | 'private' | 'public';
  open_track: boolean;
  metadata: Record<string, unknown>;
};

const DEFAULT_FILE = path.resolve(process.cwd(), 'data/curriculum/ElevatED_K12_Curriculum_Skeleton.json');
const BATCH_SIZE = 200;

const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
};

const loadSkeleton = async (filePath: string): Promise<SkeletonModule[]> => {
  const content = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(content) as unknown;
  if (!Array.isArray(data)) {
    throw new Error(`Expected an array in skeleton file, received ${typeof data}`);
  }
  return data as SkeletonModule[];
};

const buildModules = (entries: SkeletonModule[]): ModuleInsert[] => {
  const slugCounts = new Map<string, number>();

  return entries.map((entry) => {
    const grade = entry.grade.trim();
    const subject = entry.subject.trim();
    const strand = entry.strand?.trim() ?? '';
    const topic = entry.topic?.trim() ?? '';
    const subtopic = entry.subtopic?.trim() ?? '';

    const baseSlugParts = [grade, subject, strand, topic, subtopic].filter((part) => part.length > 0);
    let slugBase = slugify(baseSlugParts.join('-'));
    if (!slugBase) {
      slugBase = slugify(`${subject}-${grade}`);
    }

    const currentCount = slugCounts.get(slugBase) ?? 0;
    slugCounts.set(slugBase, currentCount + 1);
    const slug = currentCount === 0 ? slugBase : `${slugBase}-${currentCount}`;

    const licenseRequirement = entry.license_requirement?.trim() ?? '';
    const openTrack = /cc\s*by-sa/i.test(licenseRequirement);

    return {
      slug,
      title: topic || subtopic || `${subject} ${grade}`,
      summary: entry.suggested_source_category?.trim() ?? null,
      description: entry.notes?.trim() ?? null,
      subject,
      grade_band: grade,
      strand: strand || null,
      topic: topic || null,
      subtopic: subtopic || null,
      suggested_source_category: entry.suggested_source_category?.trim() ?? null,
      example_source: entry.example_source?.trim() ?? null,
      license_requirement: licenseRequirement || null,
      notes: entry.notes?.trim() ?? null,
      visibility: 'public',
      open_track: openTrack,
      metadata: {
        source: 'skeleton',
        raw: entry,
      },
    };
  });
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const upsertModules = async (supabase: SupabaseClient, modules: ModuleInsert[]): Promise<void> => {
  const chunks = chunkArray(modules, BATCH_SIZE);

  for (const chunk of chunks) {
    const { error } = await supabase
      .from('modules')
      .upsert(chunk, { onConflict: 'slug' });

    if (error) {
      throw new Error(`Failed to upsert modules batch: ${error.message}`);
    }
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
  const modules = buildModules(await loadSkeleton(file));

  const supabase = createServiceRoleClient();

  await upsertModules(supabase, modules);

  console.log(`Upserted ${modules.length} modules from skeleton file ${file}`);
};

const invokedFromCli =
  process.argv[1]?.includes('import_skeleton.ts') || process.argv[1]?.includes('import_skeleton.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
