import path from 'node:path';
import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import { IMPORT_PROVIDER_MAP, type ImportProviderId } from '../shared/import-providers.js';
import { isNormalizedProviderDataset, type NormalizedProviderDataset } from '../shared/importers/normalized.js';
import composeAttribution from './utils/attribution.js';
import { loadStructuredFile } from './utils/files.js';
import { assertLicenseAllowed } from './utils/license.js';
import {
  createServiceRoleClient,
  fetchContentSourcesByName,
  fetchLessonsByModuleIds,
  findLessonForModule,
  resolveModules,
} from './utils/supabase.js';

type ModuleRecord = { id: number; slug: string };

type LessonInsert = {
  module_id: number;
  title: string;
  slug: string;
  content: string | null;
  visibility: 'public' | 'private';
  is_published: boolean;
  open_track: boolean;
  estimated_duration_minutes: number | null;
  attribution_block: string | null;
  metadata: Record<string, unknown>;
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

const DEFAULT_FILE = path.resolve(process.cwd(), 'data/provider_dataset.json');
const BATCH_SIZE = 100;

const parseArgs = (): { file: string; provider?: ImportProviderId; updateLessons: boolean } => {
  const args = process.argv.slice(2);
  let file = DEFAULT_FILE;
  let provider: ImportProviderId | undefined;
  let updateLessons = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case '--file':
      case '--path': {
        const next = args[i + 1];
        if (!next) throw new Error(`Expected value after ${arg}`);
        file = path.resolve(process.cwd(), next);
        i += 1;
        break;
      }
      case '--provider': {
        const next = args[i + 1];
        if (!next) throw new Error('Expected provider id after --provider');
        if (!IMPORT_PROVIDER_MAP.has(next as ImportProviderId)) {
          throw new Error(`Unknown provider id ${next}`);
        }
        provider = next as ImportProviderId;
        i += 1;
        break;
      }
      case '--update-lessons':
      case '--overwrite-lessons': {
        updateLessons = true;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { file, provider, updateLessons };
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const ensureLessons = async (
  supabase: SupabaseClient,
  module: ModuleRecord,
  attribution: string | null,
  lessons: NonNullable<NormalizedProviderDataset['modules'][number]['lessons']>,
  updateExisting: boolean,
  lessonsByModule: Map<number, Awaited<ReturnType<typeof fetchLessonsByModuleIds>>[number]>,
): Promise<{ lessonIds: Map<string, number>; created: number }> => {
  const lessonIds = new Map<string, number>();
  const existing = lessonsByModule.get(module.id) ?? [];
  let created = 0;

  for (const lesson of lessons) {
    const identifier = {
      slug: lesson.slug ?? undefined,
      title: lesson.title ?? undefined,
    };

    const found = findLessonForModule(new Map([[module.id, existing]]), module.id, identifier);

    if (found && !updateExisting) {
      lessonIds.set(lesson.slug ?? found.slug, found.id);
      continue;
    }

    if (found && updateExisting) {
      const { error } = await supabase
        .from('lessons')
        .update({
          content: lesson.content ?? (found as { content?: string }).content ?? null,
          title: lesson.title ?? found.title,
          estimated_duration_minutes:
            lesson.estimatedDurationMinutes ??
            (found as { estimated_duration_minutes?: number }).estimated_duration_minutes ??
            null,
          attribution_block: lesson.attributionBlock ?? attribution ?? found.attribution_block ?? null,
          metadata: {
            ...(found.metadata ?? {}),
            provider: lesson.metadata?.provider ?? undefined,
            imported_at: new Date().toISOString(),
          },
        })
        .eq('id', found.id);
      if (error) {
        throw new Error(`Failed to update lesson ${found.slug} for module ${module.slug}: ${error.message}`);
      }
      lessonIds.set(found.slug, found.id);
      continue;
    }

    const slug = lesson.slug?.trim() ?? `${module.slug}-import-${lessonIds.size + 1}`;
    const insert: LessonInsert = {
      module_id: module.id,
      title: lesson.title?.trim() ?? slug.replace(/-/g, ' '),
      slug,
      content: lesson.content ?? '',
      visibility: 'public',
      is_published: true,
      open_track: false,
      estimated_duration_minutes: lesson.estimatedDurationMinutes ?? null,
      attribution_block: lesson.attributionBlock ?? attribution,
      metadata: {
        ...(lesson.metadata ?? {}),
        imported_at: new Date().toISOString(),
        provider: lesson.metadata?.provider,
        source: 'provider_dataset',
      },
    };

    const { data, error } = await supabase.from('lessons').insert(insert).select('id, slug').single();
    if (error || !data) {
      throw new Error(`Failed to insert lesson ${slug} for module ${module.slug}: ${error?.message ?? 'unknown'}`);
    }
    lessonIds.set(data.slug as string, data.id as number);
    created += 1;
  }

  return { lessonIds, created };
};

const importDataset = async (
  supabase: SupabaseClient,
  dataset: NormalizedProviderDataset,
  providerId: ImportProviderId,
  updateLessons: boolean,
): Promise<{ assetsInserted: number; lessonsCreated: number }> => {
  const provider = IMPORT_PROVIDER_MAP.get(providerId);
  if (!provider) {
    throw new Error(`Provider ${providerId} not registered`);
  }
  const sources = await fetchContentSourcesByName(supabase, [provider.contentSource]);
  const contentSource = sources.get(provider.contentSource);
  if (!contentSource) {
    throw new Error(`Content source "${provider.contentSource}" not found`);
  }

  const attribution = composeAttribution({
    sourceName: contentSource.name,
    license: contentSource.license ?? provider.defaultLicense,
    license_url: contentSource.license_url ?? undefined,
    attribution_text: contentSource.attribution_text ?? undefined,
  });
  const license = assertLicenseAllowed(contentSource.license ?? provider.defaultLicense);

  const moduleSlugs = dataset.modules.map((module) => module.moduleSlug);
  const modules = await resolveModules(supabase, moduleSlugs);
  const moduleIds = Array.from(new Set(Array.from(modules.values()).map((m) => m.id)));
  const lessonsByModule = await fetchLessonsByModuleIds(supabase, moduleIds);

  let assetsInserted = 0;
  let lessonsCreated = 0;
  const pendingAssets: AssetInsert[] = [];

  for (const module of dataset.modules) {
    const moduleRecord = modules.get(module.moduleSlug) ?? modules.get(module.moduleSlug.trim());
    if (!moduleRecord) {
      throw new Error(`Module "${module.moduleSlug}" not found in database.`);
    }

    let lessonIdMap = new Map<string, number>();
    if (module.lessons && module.lessons.length > 0) {
      const result = await ensureLessons(
        supabase,
        moduleRecord,
        attribution,
        module.lessons,
        updateLessons,
        lessonsByModule,
      );
      lessonIdMap = result.lessonIds;
      lessonsCreated += result.created;
    }

    const attachAssets = (
      assets: NonNullable<NormalizedProviderDataset['modules'][number]['assets']>,
      lessonId: number | null,
    ) => {
      for (const asset of assets) {
        if (!asset.url) continue;
        const assetLicense = assertLicenseAllowed(asset.license ?? license);
        pendingAssets.push({
          module_id: moduleRecord.id,
          lesson_id: lessonId,
          source_id: contentSource.id,
          url: asset.url,
          title: asset.title?.trim() ?? null,
          description: asset.description?.trim() ?? null,
          kind: asset.kind ?? 'link',
          license: assetLicense,
          license_url: asset.licenseUrl ?? contentSource.license_url ?? null,
          attribution_text: asset.attribution ?? attribution,
          metadata: {
            ...(asset.metadata ?? {}),
            imported_at: new Date().toISOString(),
            provider: provider.id,
            dataset_version: dataset.version ?? null,
          },
          tags: asset.tags ?? [],
        });
      }
    };

    if (module.assets && module.assets.length > 0) {
      attachAssets(module.assets, null);
    }

    if (module.lessons) {
      for (const lesson of module.lessons) {
        if (!lesson.assets || lesson.assets.length === 0) continue;
        const targetLessonId =
          lessonIdMap.get(lesson.slug ?? '') ??
          findLessonForModule(lessonsByModule, moduleRecord.id, {
            slug: lesson.slug ?? undefined,
            title: lesson.title ?? undefined,
          })?.id ??
          null;
        attachAssets(lesson.assets, targetLessonId);
      }
    }
  }

  for (const chunk of chunkArray(pendingAssets, BATCH_SIZE)) {
    const { error } = await supabase.from('assets').upsert(chunk, { onConflict: 'module_id,url' });
    if (error) {
      throw new Error(`Failed to upsert assets: ${error.message}`);
    }
    assetsInserted += chunk.length;
  }

  return { assetsInserted, lessonsCreated };
};

const main = async () => {
  const { file, provider: providerOverride, updateLessons } = parseArgs();
  const payload = (await loadStructuredFile<unknown>(file)) as unknown;
  if (!isNormalizedProviderDataset(payload)) {
    throw new Error(`File ${file} is not a NormalizedProviderDataset`);
  }

  const providerId = providerOverride ?? payload.provider;
  const supabase = createServiceRoleClient();
  const { assetsInserted, lessonsCreated } = await importDataset(supabase, payload, providerId, updateLessons);

  console.log(
    `Imported dataset for provider ${providerId}. Lessons created/updated: ${lessonsCreated}, assets upserted: ${assetsInserted}.`,
  );
};

const invokedFromCli =
  process.argv[1]?.includes('import_provider_dataset.ts') ||
  process.argv[1]?.includes('import_provider_dataset.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
