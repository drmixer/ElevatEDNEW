import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { parse } from 'csv-parse/sync';

import composeAttribution, { buildAttributionBlock, splitAttributionBlock } from './utils/attribution.js';
import { loadStructuredFile } from './utils/files.js';
import { assertLicenseAllowed } from './utils/license.js';
import {
  createServiceRoleClient,
  fetchContentSourcesByName,
  fetchLessonsByModuleIds,
  findLessonForModule,
  resolveModules,
  updateLessonAttributionBlocks,
} from './utils/supabase.js';

type ExternalResourceRow = {
  moduleSlug: string;
  lessonSlug?: string | null;
  provider: string;
  url: string;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  tags?: string[] | null;
  safeForKids?: boolean | null;
  license?: string | null;
  metadata?: Record<string, unknown> | null;
};

type LessonRecord = {
  id: number;
  slug: string | null;
  title: string | null;
  module_id: number | null;
  attribution_block: string | null;
};

type AssetInsert = {
  module_id: number;
  lesson_id: number | null;
  source_id: number;
  url: string;
  title: string | null;
  description: string | null;
  kind: string;
  license: string;
  license_url: string | null;
  attribution_text: string | null;
  metadata: Record<string, unknown>;
  tags: string[];
};

const DEFAULT_FILE = path.resolve(process.cwd(), 'data/external_resources.csv');
const BATCH_SIZE = 200;

const normalizeBool = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0'].includes(normalized)) return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return null;
};

const normalizeRow = (row: ExternalResourceRow): ExternalResourceRow => {
  const tags = Array.isArray(row.tags)
    ? row.tags
    : typeof row.tags === 'string'
      ? row.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

  return {
    moduleSlug: row.moduleSlug.trim(),
    lessonSlug: row.lessonSlug?.trim() ?? null,
    provider: row.provider.trim(),
    url: row.url.trim(),
    title: row.title?.trim() ?? null,
    description: row.description?.trim() ?? null,
    type: row.type?.trim() ?? 'link',
    tags,
    safeForKids: normalizeBool(row.safeForKids),
    license: row.license?.trim() ?? null,
    metadata: row.metadata ?? {},
  };
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const loadCsv = async (filePath: string): Promise<ExternalResourceRow[]> => {
  const raw = await fs.readFile(filePath, 'utf8');
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

  return records.map((record) => ({
    moduleSlug: (record.module_slug as string) ?? (record.moduleSlug as string),
    lessonSlug: (record.lesson_slug as string) ?? (record.lessonSlug as string),
    provider: (record.provider as string) ?? '',
    url: (record.url as string) ?? '',
    title: (record.title as string) ?? null,
    description: (record.description as string) ?? null,
    type: (record.type as string) ?? (record.kind as string) ?? null,
    tags: (record.tags as string) ?? null,
    safeForKids: (record.safe_for_kids as string) ?? (record.safeForKids as string),
    license: (record.license as string) ?? null,
  })) as ExternalResourceRow[];
};

const loadInput = async (filePath: string): Promise<ExternalResourceRow[]> => {
  const resolved = path.resolve(process.cwd(), filePath);
  if (resolved.toLowerCase().endsWith('.csv')) {
    return loadCsv(resolved);
  }
  const payload = await loadStructuredFile<ExternalResourceRow[]>(resolved);
  if (!Array.isArray(payload)) {
    throw new Error(`Expected array for ${resolved}`);
  }
  return payload;
};

const loadLessonAttributions = (lessons: LessonRecord[]): Map<number, { set: Set<string>; original: string }> => {
  const results = new Map<number, { set: Set<string>; original: string }>();
  for (const lesson of lessons) {
    const segments = splitAttributionBlock(lesson.attribution_block);
    const block = buildAttributionBlock(segments);
    results.set(lesson.id, { set: new Set(segments), original: block });
  }
  return results;
};

const resolveLicense = (rawLicense: string | null, fallback: string): string => {
  const baseMatch = rawLicense?.match(/cc\s+by(?:-nc)?(?:-sa)?/iu);
  const attempts = [
    rawLicense,
    baseMatch ? baseMatch[0] : null,
    rawLicense?.replace(/\s+us$/iu, '').trim(),
    rawLicense?.replace(/\s*\([^)]*\)\s*$/iu, '').trim(),
    rawLicense?.replace(/\s*\d+(\.\d+)?\s*(us)?$/iu, '').trim(),
  ].filter((value): value is string => Boolean(value && value.length > 0));

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return assertLicenseAllowed(attempt);
    } catch (error) {
      lastError = error;
    }
  }

  const fallbackBase = fallback.match(/cc\s+by(?:-nc)?(?:-sa)?/iu)?.[0] ?? fallback;
  if (lastError) {
    console.warn(`License fallback used for "${rawLicense ?? fallback}": ${String((lastError as Error).message)}`);
  }
  return assertLicenseAllowed(fallbackBase);
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
  const rows = (await loadInput(file)).map(normalizeRow);
  if (rows.length === 0) {
    console.log(`No external resources found in ${file}`);
    return;
  }

  const supabase = createServiceRoleClient();
  const moduleSlugs = Array.from(new Set(rows.map((row) => row.moduleSlug)));
  const modules = await resolveModules(supabase, moduleSlugs);
  const moduleRecords = Array.from(new Map(Array.from(modules.values()).map((record) => [record.id, record])).values());
  const moduleIds = moduleRecords.map((record) => record.id);

  const lessonsByModule = await fetchLessonsByModuleIds(supabase, moduleIds);
  const attributionSets = loadLessonAttributions(Array.from(lessonsByModule.values()).flat() as LessonRecord[]);
  const touchedLessons = new Set<number>();

  const providerNames = Array.from(new Set(rows.map((row) => row.provider)));
  const providers = await fetchContentSourcesByName(supabase, providerNames);

  const assets: AssetInsert[] = [];

  for (const row of rows) {
    const moduleRecord = modules.get(row.moduleSlug) ?? modules.get(row.moduleSlug.trim());
    if (!moduleRecord) {
      throw new Error(`Module "${row.moduleSlug}" not found`);
    }
    const provider = providers.get(row.provider);
    if (!provider) {
      throw new Error(`Content source "${row.provider}" not found. Seed content_sources first.`);
    }

    let lessonId: number | null = null;
    if (row.lessonSlug && row.lessonSlug.length > 0) {
      const lesson = findLessonForModule(lessonsByModule, moduleRecord.id, { slug: row.lessonSlug });
      if (!lesson) {
        throw new Error(`Lesson "${row.lessonSlug}" not found for module "${row.moduleSlug}".`);
      }
      lessonId = lesson.id;

      let set = attributionSets.get(lessonId);
      if (!set) {
        const segments = splitAttributionBlock(lesson.attribution_block);
        set = { set: new Set(segments), original: buildAttributionBlock(segments) };
        attributionSets.set(lessonId, set);
      }
      const attribution = composeAttribution({
        sourceName: provider.name,
        license: provider.license,
        license_url: provider.license_url ?? undefined,
        attribution_text: provider.attribution_text ?? undefined,
      });
      const before = set.set.size;
      set.set.add(attribution);
      if (set.set.size !== before) {
        touchedLessons.add(lessonId);
      }
    }

    const license = resolveLicense(row.license ?? provider.license, provider.license);
    const attributionBlock = composeAttribution({
      sourceName: provider.name,
      license,
      license_url: provider.license_url ?? undefined,
      attribution_text: provider.attribution_text ?? undefined,
    });

    assets.push({
      module_id: moduleRecord.id,
      lesson_id: lessonId,
      source_id: provider.id,
      url: row.url,
      title: row.title ?? null,
      description: row.description ?? null,
      kind: row.type ?? 'link',
      license,
      license_url: provider.license_url ?? null,
      attribution_text: attributionBlock,
      metadata: {
        ...(row.metadata ?? {}),
        safe_for_kids: row.safeForKids ?? undefined,
        external: true,
        imported_at: new Date().toISOString(),
        provider: provider.name,
        type: row.type ?? 'link',
      },
      tags: row.tags ?? [],
    });
  }

  for (const chunk of chunkArray(assets, BATCH_SIZE)) {
    const { error } = await supabase.from('assets').upsert(chunk, { onConflict: 'module_id,url' });
    if (error) {
      throw new Error(`Failed to upsert external resources: ${error.message}`);
    }
  }

  if (touchedLessons.size > 0) {
    const attributionUpdates = new Map<number, string>();
    for (const lessonId of touchedLessons) {
      const entry = attributionSets.get(lessonId);
      if (!entry) continue;
      attributionUpdates.set(lessonId, buildAttributionBlock(Array.from(entry.set)));
    }
    await updateLessonAttributionBlocks(supabase, attributionUpdates);
  }

  console.log(`Imported ${assets.length} external resources from ${file}.`);
};

const invokedFromCli =
  process.argv[1]?.includes('import_external_resources.ts') ||
  process.argv[1]?.includes('import_external_resources.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
