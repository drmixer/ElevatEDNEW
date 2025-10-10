import path from 'node:path';
import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import composeAttribution, { buildAttributionBlock, splitAttributionBlock } from './utils/attribution.js';
import { loadStructuredFile } from './utils/files.js';
import { assertLicenseAllowed } from './utils/license.js';
import {
  createServiceRoleClient,
  fetchContentSourcesByName,
  resolveModules,
  fetchLessonsByModuleIds,
  findLessonForModule,
  updateLessonAttributionBlocks,
} from './utils/supabase.js';

export type FederalMappingValue =
  | string
  | {
    url: string;
    title?: string;
    description?: string;
    tags?: string[];
    lessonSlug?: string;
    lessonTitle?: string;
  };

export type ProviderKey = 'NASA' | 'NOAA' | 'NARA' | 'LOC';

export type ProviderMapping = Partial<Record<ProviderKey, FederalMappingValue[]>>;

export type FederalMapping = Record<string, ProviderMapping>;

export type AssetInsert = {
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

const DEFAULT_MAPPING_FILE = path.resolve(process.cwd(), 'mappings/federal_pd.json');
const BATCH_SIZE = 100;
const PROVIDER_NAMES: Record<ProviderKey, string> = {
  NASA: 'NASA',
  NOAA: 'NOAA',
  NARA: 'NARA',
  LOC: 'LOC',
};

type NormalizedFederalEntry = Omit<
  AssetInsert,
  'module_id' | 'source_id' | 'license' | 'license_url' | 'attribution_text' | 'lesson_id'
> & {
  lessonSlug?: string | null;
  lessonTitle?: string | null;
};

export const normalizeFederalEntries = (value: FederalMappingValue[]): NormalizedFederalEntry[] =>
  value.map((entry) => {
    if (typeof entry === 'string') {
      return {
        url: entry,
        title: null,
        description: null,
        kind: 'link',
        metadata: {},
        tags: [],
        lessonSlug: null,
        lessonTitle: null,
      };
    }
    return {
      url: entry.url,
      title: entry.title?.trim() ?? null,
      description: entry.description?.trim() ?? null,
      kind: 'link',
      metadata: entry,
      tags: entry.tags ?? [],
      lessonSlug: entry.lessonSlug?.trim() ?? null,
      lessonTitle: entry.lessonTitle?.trim() ?? null,
    };
  });

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const upsertAssets = async (supabase: SupabaseClient, assets: AssetInsert[]): Promise<void> => {
  const chunks = chunkArray(assets, BATCH_SIZE);
  for (const chunk of chunks) {
    const { error } = await supabase
      .from('assets')
      .upsert(chunk, { onConflict: 'module_id,url' });

    if (error) {
      throw new Error(`Failed to upsert federal public-domain assets: ${error.message}`);
    }
  }
};

export const importFederalMapping = async (
  supabase: SupabaseClient,
  mapping: FederalMapping,
): Promise<number> => {
  const moduleKeys = Object.keys(mapping);
  if (moduleKeys.length === 0) {
    return 0;
  }

  const modules = await resolveModules(supabase, moduleKeys);
  const sources = await fetchContentSourcesByName(supabase, Object.values(PROVIDER_NAMES));

  const license = assertLicenseAllowed('Public Domain');
  const attributionByProvider = new Map<ProviderKey, string | null>();

  for (const providerKey of Object.keys(PROVIDER_NAMES) as ProviderKey[]) {
    const record = sources.get(PROVIDER_NAMES[providerKey]);
    if (record) {
      attributionByProvider.set(
        providerKey,
        composeAttribution({
          sourceName: record.name,
          license,
          license_url: record.license_url ?? undefined,
          attribution_text: record.attribution_text ?? undefined,
        }),
      );
    }
  }

  const moduleRecords = Array.from(
    new Map(Array.from(modules.values()).map((record) => [record.id, record])).values(),
  );
  const lessonsByModule = await fetchLessonsByModuleIds(
    supabase,
    moduleRecords.map((record) => record.id),
  );
  const originalBlocks = new Map<number, string>();
  const attributionSets = new Map<number, Set<string>>();
  const touchedLessons = new Set<number>();

  for (const lessonList of lessonsByModule.values()) {
    for (const lesson of lessonList) {
      const segments = splitAttributionBlock(lesson.attribution_block);
      attributionSets.set(lesson.id, new Set(segments));
      originalBlocks.set(lesson.id, buildAttributionBlock(segments));
    }
  }

  const assets: AssetInsert[] = [];

  for (const [moduleKey, providerEntries] of Object.entries(mapping)) {
    const moduleRecord = modules.get(moduleKey) ?? modules.get(moduleKey.trim());
    if (!moduleRecord) {
      throw new Error(`Module "${moduleKey}" not resolved`);
    }

    for (const providerKey of Object.keys(providerEntries) as ProviderKey[]) {
      const providerName = PROVIDER_NAMES[providerKey];
      const sourceRecord = sources.get(providerName);
      if (!sourceRecord) {
        throw new Error(`Content source "${providerName}" not seeded`);
      }
      const entries = providerEntries[providerKey];
      if (!entries || entries.length === 0) {
        continue;
      }

      const attribution = attributionByProvider.get(providerKey) ?? null;

      for (const entry of normalizeFederalEntries(entries)) {
        let lessonId: number | null = null;
        if ((entry.lessonSlug && entry.lessonSlug.length > 0) || (entry.lessonTitle && entry.lessonTitle.length > 0)) {
          const lesson = findLessonForModule(lessonsByModule, moduleRecord.id, {
            slug: entry.lessonSlug ?? undefined,
            title: entry.lessonTitle ?? undefined,
          });
          if (!lesson) {
            throw new Error(
              `Lesson "${entry.lessonSlug ?? entry.lessonTitle}" not found for module "${moduleKey}".`,
            );
          }
          lessonId = lesson.id;

          if (attribution && attribution.length > 0) {
            let set = attributionSets.get(lessonId);
            if (!set) {
              const existingSegments = splitAttributionBlock(lesson.attribution_block);
              set = new Set(existingSegments);
              attributionSets.set(lessonId, set);
              originalBlocks.set(lessonId, buildAttributionBlock(existingSegments));
            }
            const before = set.size;
            set.add(attribution);
            if (set.size !== before) {
              touchedLessons.add(lessonId);
            }
          }
        }

        assets.push({
          module_id: moduleRecord.id,
          lesson_id: lessonId,
          source_id: sourceRecord.id,
          url: entry.url,
          title: entry.title,
          description: entry.description,
          kind: entry.kind,
          license,
          license_url: sourceRecord.license_url ?? null,
          attribution_text: attribution,
          metadata: {
            ...entry.metadata,
            importer: 'federal_pd',
            provider: providerName,
            imported_at: new Date().toISOString(),
            ...(entry.lessonSlug ? { lesson_slug: entry.lessonSlug } : {}),
            ...(entry.lessonTitle ? { lesson_title: entry.lessonTitle } : {}),
          },
          tags: entry.tags,
        });
      }
    }
  }

  if (assets.length === 0) {
    return 0;
  }

  await upsertAssets(supabase, assets);
  if (touchedLessons.size > 0) {
    const updates = new Map<number, string>();
    for (const lessonId of touchedLessons) {
      const set = attributionSets.get(lessonId);
      if (!set) {
        continue;
      }
      const merged = buildAttributionBlock(set);
      const existing = originalBlocks.get(lessonId) ?? '';
      if (merged.length > 0 && merged !== existing) {
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
  const mapping = (await loadStructuredFile<FederalMapping>(file)) ?? {};
  const supabase = createServiceRoleClient();
  const inserted = await importFederalMapping(supabase, mapping);
  console.log(`Upserted ${inserted} federal public-domain assets from ${file}`);
};

const invokedFromCli =
  process.argv[1]?.includes('import_federal_pd.ts') ||
  process.argv[1]?.includes('import_federal_pd.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
