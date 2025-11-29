import path from 'node:path';
import process from 'node:process';

import { loadStructuredFile } from './utils/files.js';
import { createServiceRoleClient, resolveModules } from './utils/supabase.js';

type CanonicalSequenceEntry = {
  position: number;
  module_slug: string;
  module_title: string;
  strand?: string | null;
  standard_codes?: string[];
  metadata?: Record<string, unknown>;
};

type CanonicalPath = {
  grade_band: string;
  subject: string;
  sequence: CanonicalSequenceEntry[];
};

const SUBJECT_LABELS: Record<string, string> = {
  math: 'Mathematics',
  ela: 'English Language Arts',
  english: 'English Language Arts',
  english_language_arts: 'English Language Arts',
};

const DEFAULT_FILE = path.resolve(process.cwd(), 'data/curriculum/learning_paths_phase13.json');

const normalizeSubject = (subject: string): string => {
  const key = subject.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return SUBJECT_LABELS[key] ?? subject;
};

const collectModuleSlugs = (paths: CanonicalPath[]): string[] => {
  const slugs = new Set<string>();
  paths.forEach((path) => {
    path.sequence.forEach((entry) => slugs.add(entry.module_slug));
  });
  return Array.from(slugs);
};

const buildPayload = (
  paths: CanonicalPath[],
  moduleIdBySlug: Map<string, { id: number }>,
): Array<Record<string, unknown>> => {
  const payload: Array<Record<string, unknown>> = [];

  paths.forEach((path) => {
    const subject = normalizeSubject(path.subject);
    path.sequence.forEach((entry) => {
      payload.push({
        grade_band: path.grade_band,
        subject,
        position: entry.position,
        module_slug: entry.module_slug,
        module_title: entry.module_title,
        strand: entry.strand ?? null,
        standard_codes: entry.standard_codes ?? [],
        metadata: entry.metadata ?? {},
        module_id: moduleIdBySlug.get(entry.module_slug)?.id ?? null,
      });
    });
  });

  return payload;
};

const main = async () => {
  const data = await loadStructuredFile<CanonicalPath[]>(DEFAULT_FILE);
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error(`No canonical sequences found in ${DEFAULT_FILE}`);
  }

  const supabase = createServiceRoleClient();
  const slugs = collectModuleSlugs(data);
  const moduleMap = await resolveModules(supabase, slugs);

  const payload = buildPayload(data, moduleMap);

  const { error: upsertError } = await supabase.from('learning_sequences').upsert(payload, {
    onConflict: 'grade_band,subject,position',
  });

  if (upsertError) {
    throw new Error(`Failed to upsert learning sequences: ${upsertError.message}`);
  }

  console.log(`Seeded ${payload.length} learning sequence entries from ${DEFAULT_FILE}`);
};

const invokedFromCli =
  process.argv[1]?.includes('seed_learning_sequences.ts') ||
  process.argv[1]?.includes('seed_learning_sequences.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
