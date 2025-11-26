import path from 'node:path';
import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

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

type CuratedAssetEntry = {
  source: string;
  url: string;
  title?: string;
  description?: string;
  kind?: string;
  tags?: string[];
  lessonSlug?: string;
  lessonTitle?: string;
  license?: string;
  metadata?: Record<string, unknown>;
};

type CuratedMapping = Record<string, CuratedAssetEntry[]>;

type LessonRecord = {
  id: number;
  slug: string | null;
  title: string | null;
  module_id: number | null;
  attribution_block: string | null;
};

type AssetInsert = {
  module_id: number | null;
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

const DEFAULT_MAPPING_FILE = path.resolve(process.cwd(), 'mappings/curated_assets.json');
const BATCH_SIZE = 100;

const normalizeEntry = (entry: CuratedAssetEntry): CuratedAssetEntry => ({
  source: entry.source.trim(),
  url: entry.url.trim(),
  title: entry.title?.trim(),
  description: entry.description?.trim(),
  kind: entry.kind?.trim() ?? 'link',
  tags: entry.tags ?? [],
  lessonSlug: entry.lessonSlug?.trim(),
  lessonTitle: entry.lessonTitle?.trim(),
  license: entry.license?.trim(),
  metadata: entry.metadata ?? {},
});

const resolveLicense = (rawLicense: string): string => {
  const attempts = [
    rawLicense,
    rawLicense.replace(/\s+us$/iu, '').trim(),
    rawLicense.replace(/\s*\([^)]*\)\s*$/iu, '').trim(),
  ].filter((value) => value.length > 0);

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return assertLicenseAllowed(attempt);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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

const upsertAssets = async (supabase: SupabaseClient, assets: AssetInsert[]): Promise<void> => {
  const chunks = chunkArray(assets, BATCH_SIZE);
  for (const chunk of chunks) {
    const { error } = await supabase
      .from('assets')
      .upsert(chunk, { onConflict: 'module_id,url' });
    if (error) {
      throw new Error(`Failed to upsert curated assets: ${error.message}`);
    }
  }
};

export const importCuratedAssets = async (
  supabase: SupabaseClient,
  mapping: CuratedMapping,
): Promise<number> => {
  const moduleKeys = Object.keys(mapping).filter((key) => !key.startsWith('lesson:'));
  const lessonKeys = Object.keys(mapping)
    .filter((key) => key.startsWith('lesson:'))
    .map((key) => key.replace(/^lesson:/u, '').trim())
    .filter((slug) => slug.length > 0);

  const allEntries = Object.values(mapping).flat().map(normalizeEntry);
  if (allEntries.length === 0) {
    return 0;
  }

  const sourceNames = Array.from(new Set(allEntries.map((entry) => entry.source)));
  const sources = await fetchContentSourcesByName(supabase, sourceNames);

  const modules = moduleKeys.length > 0 ? await resolveModules(supabase, moduleKeys) : new Map();
  const moduleRecords = Array.from(
    new Map(Array.from(modules.values()).map((record) => [record.id, record])).values(),
  );
  const moduleIdLookup = new Map<number, { id: number; slug: string }>();
  for (const record of moduleRecords) {
    moduleIdLookup.set(record.id, record);
  }
  const lessonsByModule = await fetchLessonsByModuleIds(
    supabase,
    moduleRecords.map((record) => record.id),
  );

  const directLessons = new Map<string, LessonRecord>();
  if (lessonKeys.length > 0) {
    const { data, error } = await supabase
      .from('lessons')
      .select('id, slug, title, module_id, attribution_block')
      .in('slug', lessonKeys);

    if (error) {
      throw new Error(`Failed to load direct lessons: ${error.message}`);
    }

    for (const lesson of (data ?? []) as LessonRecord[]) {
      if (lesson.slug) {
        directLessons.set(lesson.slug, lesson);
      }
    }
  }

  const attributionSets = loadLessonAttributions(
    Array.from(lessonsByModule.values()).flat().concat(Array.from(directLessons.values())),
  );
  const touchedLessons = new Set<number>();
  const dedupe = new Set<string>();
  const assets: AssetInsert[] = [];

  const ensureLesson = (
    moduleId: number,
    moduleSlug: string,
    entry: CuratedAssetEntry,
  ): LessonRecord => {
    const lessons = lessonsByModule.get(moduleId) ?? [];
    if (entry.lessonSlug || entry.lessonTitle) {
      const lesson = findLessonForModule(lessonsByModule, moduleId, {
        slug: entry.lessonSlug ?? undefined,
        title: entry.lessonTitle ?? undefined,
      });
      if (!lesson) {
        throw new Error(
          `Lesson "${entry.lessonSlug ?? entry.lessonTitle}" not found for module "${moduleSlug}".`,
        );
      }
      return {
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        module_id: lesson.module_id,
        attribution_block: lesson.attribution_block,
      };
    }
    if (lessons.length === 1) {
      return {
        id: lessons[0].id,
        slug: lessons[0].slug,
        title: lessons[0].title,
        module_id: lessons[0].module_id,
        attribution_block: lessons[0].attribution_block,
      };
    }
    throw new Error(
      `Module "${moduleSlug}" has ${lessons.length} lessons; specify lessonSlug or lessonTitle.`,
    );
  };

  for (const [rawKey, rawEntries] of Object.entries(mapping)) {
    const entries = rawEntries.map(normalizeEntry);
    if (entries.length === 0) {
      continue;
    }

    const isDirectLesson = rawKey.startsWith('lesson:');
    if (isDirectLesson) {
      const lessonSlug = rawKey.replace(/^lesson:/u, '').trim();
      const lesson = directLessons.get(lessonSlug);
      if (!lesson) {
        throw new Error(`Direct lesson "${lessonSlug}" not found.`);
      }

      for (const entry of entries) {
        const source = sources.get(entry.source);
        if (!source) {
          throw new Error(`Content source "${entry.source}" not available.`);
        }
        const license = resolveLicense(entry.license ?? source.license);
        const attribution = composeAttribution({
          sourceName: source.name,
          license,
          license_url: source.license_url ?? undefined,
          attribution_text: source.attribution_text ?? undefined,
        });
        const key = `${lesson.module_id ?? 'null'}::${entry.url}`;
        if (dedupe.has(key)) {
          continue;
        }
        dedupe.add(key);

        const attributionRecord = attributionSets.get(lesson.id);
        if (attributionRecord) {
          const before = attributionRecord.set.size;
          attributionRecord.set.add(attribution);
          if (attributionRecord.set.size !== before) {
            touchedLessons.add(lesson.id);
          }
        }

        assets.push({
          module_id: lesson.module_id,
          lesson_id: lesson.id,
          source_id: source.id,
          url: entry.url,
          title: entry.title ?? null,
          description: entry.description ?? null,
          kind: entry.kind ?? 'link',
          license,
          license_url: source.license_url ?? null,
          attribution_text: attribution,
          metadata: {
            ...entry.metadata,
            curated_by: 'import_curated_assets',
            curated_at: new Date().toISOString(),
            lesson_slug: lesson.slug,
            module_slug: lesson.module_id ? moduleIdLookup.get(lesson.module_id)?.slug ?? null : null,
            source_provider: source.name,
            storage_mode: 'link',
          },
          tags: entry.tags ?? [],
        });
      }
      continue;
    }

    const module = modules.get(rawKey) ?? modules.get(rawKey.trim());
    if (!module) {
      throw new Error(`Module "${rawKey}" not resolved.`);
    }

    for (const entry of entries) {
      const source = sources.get(entry.source);
      if (!source) {
        throw new Error(`Content source "${entry.source}" not available.`);
      }
      const license = resolveLicense(entry.license ?? source.license);
      const attribution = composeAttribution({
        sourceName: source.name,
        license,
        license_url: source.license_url ?? undefined,
        attribution_text: source.attribution_text ?? undefined,
      });

      let lesson: LessonRecord | null = null;
      try {
        lesson = ensureLesson(module.id, module.slug, entry);
      } catch (error) {
        // If lesson is optional, we can allow assets at the module level.
        if (entry.lessonSlug || entry.lessonTitle) {
          throw error;
        }
      }

      if (lesson) {
        const attributionRecord = attributionSets.get(lesson.id);
        if (attributionRecord) {
          const before = attributionRecord.set.size;
          attributionRecord.set.add(attribution);
          if (attributionRecord.set.size !== before) {
            touchedLessons.add(lesson.id);
          }
        }
      }

      const dedupeKey = `${module.id}::${entry.url}`;
      if (dedupe.has(dedupeKey)) {
        continue;
      }
      dedupe.add(dedupeKey);

      assets.push({
        module_id: module.id,
        lesson_id: lesson?.id ?? null,
        source_id: source.id,
        url: entry.url,
        title: entry.title ?? null,
        description: entry.description ?? null,
        kind: entry.kind ?? 'link',
        license,
        license_url: source.license_url ?? null,
        attribution_text: attribution,
        metadata: {
          ...entry.metadata,
          curated_by: 'import_curated_assets',
          curated_at: new Date().toISOString(),
          module_slug: module.slug,
          lesson_slug: lesson?.slug ?? null,
          source_provider: source.name,
          storage_mode: 'link',
        },
        tags: entry.tags ?? [],
      });
    }
  }

  if (assets.length === 0) {
    return 0;
  }

  await upsertAssets(supabase, assets);

  if (touchedLessons.size > 0) {
    const updates = new Map<number, string>();
    for (const lessonId of touchedLessons) {
      const record = attributionSets.get(lessonId);
      if (!record) {
        continue;
      }
      const merged = buildAttributionBlock(record.set);
      if (merged.length > 0 && merged !== record.original) {
        updates.set(lessonId, merged);
      }
    }
    if (updates.size > 0) {
      await updateLessonAttributionBlocks(supabase, updates);
    }
  }

  return assets.length;
};

const parseArgs = (): { file: string } => {
  const args = process.argv.slice(2);
  let file = DEFAULT_MAPPING_FILE;

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
  const mapping = (await loadStructuredFile<CuratedMapping>(file)) ?? {};
  const supabase = createServiceRoleClient();
  const inserted = await importCuratedAssets(supabase, mapping);
  console.log(`Upserted ${inserted} curated assets from ${file}`);
};

const invokedFromCli =
  process.argv[1]?.includes('import_curated_assets.ts') ||
  process.argv[1]?.includes('import_curated_assets.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
