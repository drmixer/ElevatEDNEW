import path from 'node:path';
import process from 'node:process';

import { loadStructuredFile } from './utils/files.js';
import { createServiceRoleClient, resolveModules } from './utils/supabase.js';
import { extractWriteMode, logWriteMode } from './utils/writeMode.js';

type CanonicalSequenceEntry = {
  position: number;
  module_slug: string;
  module_title: string;
  strand?: string | null;
  standard_codes?: string[];
  prerequisite_standard_codes?: string[];
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

const normalizeSubjectKey = (subject: string): string => subject.trim().toLowerCase().replace(/[\s-]+/g, '_');

const isPlacementDependencySeedingEligible = (gradeBand: string, subject: string): boolean => {
  const numericGrade = Number.parseInt(gradeBand.trim(), 10);
  if (!Number.isFinite(numericGrade) || numericGrade < 3 || numericGrade > 8) {
    return false;
  }

  const subjectKey = normalizeSubjectKey(subject);
  return subjectKey === 'math' || subjectKey === 'ela' || subjectKey === 'english' || subjectKey === 'english_language_arts';
};

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
};

const buildSequenceMetadata = (
  path: CanonicalPath,
  entry: CanonicalSequenceEntry,
  previousEntry: CanonicalSequenceEntry | null,
): Record<string, unknown> => {
  const metadata = { ...(entry.metadata ?? {}) };
  const explicitPrerequisites = normalizeStringList(
    entry.prerequisite_standard_codes ??
      metadata.prerequisite_standard_codes ??
      metadata.depends_on_standard_codes ??
      metadata.dependency_standard_codes ??
      [],
  );

  if (explicitPrerequisites.length > 0) {
    metadata.prerequisite_standard_codes = explicitPrerequisites;
    return metadata;
  }

  if (!isPlacementDependencySeedingEligible(path.grade_band, path.subject)) {
    return metadata;
  }

  if (!previousEntry) {
    return metadata;
  }

  if ((entry.strand ?? null) !== (previousEntry.strand ?? null)) {
    return metadata;
  }

  const currentStandards = normalizeStringList(entry.standard_codes ?? []);
  const previousStandards = normalizeStringList(previousEntry.standard_codes ?? []);
  if (currentStandards.length === 0 || previousStandards.length === 0) {
    return metadata;
  }

  const overlaps = currentStandards.some((code) => previousStandards.includes(code));
  if (overlaps) {
    return metadata;
  }

  metadata.prerequisite_standard_codes = previousStandards;
  metadata.prerequisite_metadata_source = 'adjacent_sequence_inference';
  return metadata;
};

const collectModuleSlugs = (paths: CanonicalPath[]): string[] => {
  const slugs = new Set<string>();
  paths.forEach((path) => {
    path.sequence.forEach((entry) => slugs.add(entry.module_slug));
  });
  return Array.from(slugs);
};

export const buildPayload = (
  paths: CanonicalPath[],
  moduleIdBySlug: Map<string, { id: number }>,
): Array<Record<string, unknown>> => {
  const payload: Array<Record<string, unknown>> = [];

  paths.forEach((path) => {
    const subject = normalizeSubject(path.subject);
    path.sequence.forEach((entry, index) => {
      const previousEntry = index > 0 ? (path.sequence[index - 1] ?? null) : null;
      payload.push({
        grade_band: path.grade_band,
        subject,
        position: entry.position,
        module_slug: entry.module_slug,
        module_title: entry.module_title,
        strand: entry.strand ?? null,
        standard_codes: entry.standard_codes ?? [],
        metadata: buildSequenceMetadata(path, entry, previousEntry),
        module_id: moduleIdBySlug.get(entry.module_slug)?.id ?? null,
      });
    });
  });

  return payload;
};

const main = async () => {
  const { apply } = extractWriteMode(process.argv.slice(2));
  logWriteMode(apply, 'learning sequence rows');
  const data = await loadStructuredFile<CanonicalPath[]>(DEFAULT_FILE);
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error(`No canonical sequences found in ${DEFAULT_FILE}`);
  }

  const supabase = createServiceRoleClient();
  const slugs = collectModuleSlugs(data);
  const moduleMap = await resolveModules(supabase, slugs);

  const payload = buildPayload(data, moduleMap);

  if (!apply) {
    console.log(`Would seed ${payload.length} learning sequence entries from ${DEFAULT_FILE}.`);
    console.log('Dry run only. Re-run with --apply to write changes.');
    return;
  }

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
