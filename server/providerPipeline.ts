import type { SupabaseClient } from '@supabase/supabase-js';

import {
  IMPORT_PROVIDER_MAP,
  type ImportProviderId,
} from '../shared/import-providers.js';
import {
  isNormalizedProviderDataset,
  type NormalizedAsset,
  type NormalizedProviderDataset,
} from '../shared/importers/normalized.js';
import {
  importFederalMapping,
  normalizeFederalEntries,
  type FederalMapping,
} from '../scripts/import_federal_pd.js';
import {
  importGutenbergMapping,
  normalizeGutenbergEntries,
  type GutenbergMapping,
} from '../scripts/import_gutenberg.js';
import {
  importOpenStaxMapping,
  normalizeOpenStaxEntries,
  type OpenStaxMapping,
} from '../scripts/import_openstax.js';
import composeAttribution, {
  buildAttributionBlock,
  splitAttributionBlock,
} from '../scripts/utils/attribution.js';
import { assertLicenseAllowed } from '../scripts/utils/license.js';
import {
  fetchContentSourcesByName,
  fetchLessonsByModuleIds,
  findLessonForModule,
  resolveModules,
  updateLessonAttributionBlocks,
  type LessonSummary,
} from '../scripts/utils/supabase.js';
import type { ImportRunRow } from './importRuns.js';
import {
  countDatasetItems,
  countMappingItems,
  evaluateImportLimits,
  normalizeImportLimits,
} from './importSafety.js';
import { checkUrlsHealth } from './urlQA.js';

export type ImportOutcome = {
  totals: Record<string, unknown> | null;
  errors: string[];
  warnings?: string[];
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

const ASSET_BATCH_SIZE = 100;

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const upsertAssets = async (supabase: SupabaseClient, assets: AssetInsert[]): Promise<void> => {
  for (const chunk of chunkArray(assets, ASSET_BATCH_SIZE)) {
    const { error } = await supabase
      .from('assets')
      .upsert(chunk, { onConflict: 'module_id,url' });

    if (error) {
      throw new Error(`Failed to upsert assets: ${error.message}`);
    }
  }
};

const collectUrlsFromMapping = <T>(
  mapping: Record<string, T[]>,
  normalizer: (value: T[]) => Array<{ url: string }>,
): string[] =>
  Object.values(mapping)
    .flatMap((entries) => normalizer(entries))
    .map((entry) => entry.url)
    .filter((url) => typeof url === 'string' && url.trim().length > 0);

const normaliseTagList = (tags?: unknown): string[] => {
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => tag.length > 0);
};

type LessonAttributionState = {
  sets: Map<number, Set<string>>;
  touchedLessons: Set<number>;
};

const initialiseLessonAttributionState = (
  lessonsByModule: Map<number, LessonSummary[]>,
): LessonAttributionState => {
  const sets = new Map<number, Set<string>>();
  const touchedLessons = new Set<number>();

  for (const lessonList of lessonsByModule.values()) {
    for (const lesson of lessonList) {
      const segments = splitAttributionBlock(lesson.attribution_block);
      sets.set(lesson.id, new Set(segments));
    }
  }

  return { sets, touchedLessons };
};

const attachAttributionToLesson = (
  state: LessonAttributionState,
  lessonId: number | null,
  attribution: string,
) => {
  if (!lessonId) {
    return;
  }
  let set = state.sets.get(lessonId);
  if (!set) {
    set = new Set<string>();
    state.sets.set(lessonId, set);
  }
  const before = set.size;
  set.add(attribution);
  if (set.size !== before) {
    state.touchedLessons.add(lessonId);
  }
};

const buildLessonAttributionUpdates = (state: LessonAttributionState): Map<number, string> => {
  const updates = new Map<number, string>();
  for (const [lessonId, segments] of state.sets.entries()) {
    if (!state.touchedLessons.has(lessonId)) {
      continue;
    }
    updates.set(lessonId, buildAttributionBlock(segments));
  }
  return updates;
};

const resolveLessonForAsset = (
  lessonsByModule: Map<number, LessonSummary[]>,
  moduleId: number,
  asset: NormalizedAsset,
  lessonOverride?: LessonSummary | null,
): LessonSummary | null => {
  if (lessonOverride) {
    return lessonOverride;
  }
  if (asset.lessonSlug || asset.lessonTitle) {
    return findLessonForModule(lessonsByModule, moduleId, {
      slug: asset.lessonSlug ?? undefined,
      title: asset.lessonTitle ?? undefined,
    });
  }
  return null;
};

const normaliseAssetKind = (kind?: string | null): string => {
  if (!kind) {
    return 'link';
  }
  const value = kind.trim().toLowerCase();
  if (!value) {
    return 'link';
  }
  if (['video', 'document', 'activity', 'article', 'assessment'].includes(value)) {
    return value;
  }
  return 'link';
};

const prepareDatasetAssets = async (
  supabase: SupabaseClient,
  providerId: ImportProviderId,
  dataset: NormalizedProviderDataset,
  run: ImportRunRow,
): Promise<{
  assets: AssetInsert[];
  warnings: string[];
  errors: string[];
  urlWarnings: string[];
  totals: Record<string, unknown>;
  lessonState: LessonAttributionState;
}> => {
  const providerDefinition = IMPORT_PROVIDER_MAP.get(providerId);
  if (!providerDefinition) {
    throw new Error(`Unknown provider "${providerId}".`);
  }

  const moduleSlugs = Array.from(
    new Set(
      dataset.modules
        .map((module) => module?.moduleSlug?.trim())
        .filter((slug): slug is string => Boolean(slug) && slug.length > 0),
    ),
  );

  if (moduleSlugs.length === 0) {
    return {
      assets: [],
      warnings: ['Dataset did not include any module slugs.'],
      errors: [],
      urlWarnings: [],
      lessonState: {
        sets: new Map(),
        touchedLessons: new Set(),
      },
      totals: {
        provider: providerId,
        modulesProcessed: 0,
        assetsAttempted: 0,
        assetsInserted: 0,
      },
    };
  }

  const moduleRecords = await resolveModules(supabase, moduleSlugs);
  const moduleIds = Array.from(new Set(Array.from(moduleRecords.values()).map((record) => record.id)));
  const lessonsByModule = await fetchLessonsByModuleIds(supabase, moduleIds);

  const contentSourceName = providerDefinition.contentSource;
  const sources = await fetchContentSourcesByName(supabase, [contentSourceName]);
  const contentSource = sources.get(contentSourceName);
  if (!contentSource) {
    throw new Error(
      `Content source "${contentSourceName}" missing. Seed content sources before importing.`,
    );
  }

  const defaultLicense = assertLicenseAllowed(
    contentSource.license ?? providerDefinition.defaultLicense,
  );
  const providerAttribution = composeAttribution({
    sourceName: contentSource.name,
    license: defaultLicense,
    license_url: contentSource.license_url ?? undefined,
    attribution_text: contentSource.attribution_text ?? undefined,
  });

  const lessonState = initialiseLessonAttributionState(lessonsByModule);

  const warnings: string[] = [];
  const errors: string[] = [];
  const assets: AssetInsert[] = [];
  let attemptedAssets = 0;

  const pushAsset = (
    moduleRecord: { id: number; slug: string },
    asset: NormalizedAsset,
    lessonOverride?: LessonSummary | null,
  ) => {
    attemptedAssets += 1;
    if (!asset || typeof asset.url !== 'string' || asset.url.trim().length === 0) {
      warnings.push(
        `Skipped asset without URL for module "${moduleRecord.slug}".`,
      );
      return;
    }

    let licenseLabel: string;
    try {
      licenseLabel = assertLicenseAllowed(asset.license ?? defaultLicense);
    } catch (caughtError) {
      const reason =
        caughtError instanceof Error ? caughtError.message : String(caughtError);
      errors.push(
        `Unsupported license "${asset.license}" for URL ${asset.url} (module ${moduleRecord.slug}). ${reason}`,
      );
      return;
    }

    const lesson = resolveLessonForAsset(lessonsByModule, moduleRecord.id, asset, lessonOverride);
    if ((asset.lessonSlug || asset.lessonTitle) && !lesson) {
      warnings.push(
        `Lesson "${asset.lessonSlug ?? asset.lessonTitle}" not found for module "${moduleRecord.slug}". Asset assigned to module only.`,
      );
    }

    const lessonId = lesson ? lesson.id : null;
    const lessonSlug = lesson?.slug ?? asset.lessonSlug ?? null;
    const attribution =
      typeof asset.attribution === 'string' && asset.attribution.trim().length > 0
        ? asset.attribution.trim()
        : providerAttribution;

    attachAttributionToLesson(lessonState, lessonId, attribution);

    const metadata: Record<string, unknown> = {
      provider: providerId,
      import_run_id: run.id,
      module_slug: moduleRecord.slug,
      ...(lessonSlug ? { lesson_slug: lessonSlug } : {}),
      ...(asset.metadata ?? {}),
    };

    assets.push({
      module_id: moduleRecord.id,
      lesson_id: lessonId,
      source_id: contentSource.id,
      url: asset.url.trim(),
      title: asset.title?.trim() ?? null,
      description: asset.description?.trim() ?? null,
      kind: normaliseAssetKind(asset.kind ?? null),
      license: licenseLabel,
      license_url: asset.licenseUrl?.trim() ?? contentSource.license_url ?? null,
      attribution_text: attribution,
      metadata,
      tags: normaliseTagList(asset.tags),
    });
  };

  for (const moduleData of dataset.modules) {
    if (!moduleData || typeof moduleData !== 'object') {
      continue;
    }
    const slug = moduleData.moduleSlug?.trim();
    if (!slug) {
      warnings.push('Encountered module entry without a slug; skipping.');
      continue;
    }
    const moduleRecord =
      moduleRecords.get(slug) ?? moduleRecords.get(slug.trim());
    if (!moduleRecord) {
      warnings.push(`Module "${slug}" not found in Supabase. Skipping module assets.`);
      continue;
    }

    if (Array.isArray(moduleData.assets)) {
      for (const asset of moduleData.assets) {
        pushAsset(moduleRecord, asset ?? {});
      }
    }

    if (Array.isArray(moduleData.lessons)) {
      for (const lessonData of moduleData.lessons) {
        if (!lessonData) {
          continue;
        }
        const lesson = findLessonForModule(lessonsByModule, moduleRecord.id, {
          slug: lessonData.slug ?? undefined,
          title: lessonData.title ?? undefined,
        });

        if (!lesson) {
          warnings.push(
            `Lesson "${lessonData.slug ?? lessonData.title}" not found for module "${slug}".`,
          );
          continue;
        }

        if (Array.isArray(lessonData.assets)) {
          for (const asset of lessonData.assets) {
            pushAsset(moduleRecord, asset ?? {}, lesson);
          }
        }
      }
    }
  }

  const urlChecks = await checkUrlsHealth(assets.map((asset) => asset.url));
  const urlWarnings = urlChecks
    .filter((check) => !check.ok)
    .map((check) =>
      check.status
        ? `Potential dead link (${check.status}) for ${check.url}`
        : `Potential dead link for ${check.url}: ${check.error ?? 'unknown error'}`,
    );

  return {
    assets,
    warnings,
    errors,
    urlWarnings,
    lessonState,
    totals: {
      provider: providerId,
      modulesProcessed: dataset.modules.length,
      assetsAttempted: attemptedAssets,
      assetsPrepared: assets.length,
      contentSourceId: contentSource.id,
      defaultLicense,
      urlChecks: urlChecks.length,
      urlFailures: urlWarnings.length,
    },
  };
};

const finaliseDatasetImport = async (
  supabase: SupabaseClient,
  assets: AssetInsert[],
  lessonState: LessonAttributionState,
): Promise<void> => {
  if (assets.length > 0) {
    await upsertAssets(supabase, assets);
  }
  const updates = buildLessonAttributionUpdates(lessonState);
  if (updates.size > 0) {
    await updateLessonAttributionBlocks(supabase, updates);
  }
};

export const processImportRun = async (
  client: SupabaseClient,
  providerId: ImportProviderId,
  run: ImportRunRow,
): Promise<ImportOutcome> => {
  const dryRun = run.input?.dryRun === true;
  const limits = normalizeImportLimits(run.input?.limits);
  const limitTotals = limits && (limits.maxAssets || limits.maxModules) ? { limits } : {};

  if (providerId === 'openstax') {
    const mapping = run.input?.mapping as OpenStaxMapping | undefined;
    if (!mapping || typeof mapping !== 'object') {
      return {
        totals: null,
        errors: ['Import run did not include an OpenStax mapping payload.'],
        warnings: [],
      };
    }

    const counts = countMappingItems(mapping, normalizeOpenStaxEntries);
    const limitAssessment = evaluateImportLimits(counts, limits);
    const limitWarnings = [...limitAssessment.warnings];

    if (limitAssessment.errors.length) {
      return {
        totals: {
          ...limitTotals,
          provider: providerId,
          modulesDetected: counts.modules,
          assetsDetected: counts.assets,
          dryRun: true,
        },
        errors: limitAssessment.errors,
        warnings: limitWarnings,
      };
    }

    const urlChecks = await checkUrlsHealth(collectUrlsFromMapping(mapping, normalizeOpenStaxEntries));
    const urlWarnings = urlChecks
      .filter((check) => !check.ok)
      .map((check) =>
        check.status
          ? `Potential dead link (${check.status}) for ${check.url}`
          : `Potential dead link for ${check.url}: ${check.error ?? 'unknown error'}`,
      );

    const combinedWarnings = [...limitWarnings, ...urlWarnings];

    if (dryRun) {
      return {
        totals: {
          ...limitTotals,
          provider: providerId,
          modulesDetected: counts.modules,
          assetsDetected: counts.assets,
          assetsInserted: 0,
          urlChecks: urlChecks.length,
          urlFailures: urlWarnings.length,
          dryRun: true,
        },
        errors: [],
        warnings: [...combinedWarnings, 'Dry run enabled; no data was written.'],
      };
    }

    const inserted = await importOpenStaxMapping(client, mapping);
    return {
      totals: {
        ...limitTotals,
        provider: providerId,
        modulesDetected: counts.modules,
        assetsInserted: inserted,
        urlChecks: urlChecks.length,
        urlFailures: urlWarnings.length,
        dryRun: false,
      },
      errors: [],
      warnings: combinedWarnings,
    };
  }

  if (providerId === 'gutenberg') {
    const mapping = run.input?.mapping as GutenbergMapping | undefined;
    if (!mapping || typeof mapping !== 'object') {
      return {
        totals: null,
        errors: ['Import run did not include a Project Gutenberg mapping payload.'],
        warnings: [],
      };
    }

    const counts = countMappingItems(mapping, normalizeGutenbergEntries);
    const limitAssessment = evaluateImportLimits(counts, limits);
    const limitWarnings = [...limitAssessment.warnings];

    if (limitAssessment.errors.length) {
      return {
        totals: {
          ...limitTotals,
          provider: providerId,
          modulesDetected: counts.modules,
          assetsDetected: counts.assets,
          dryRun: true,
        },
        errors: limitAssessment.errors,
        warnings: limitWarnings,
      };
    }

    const urlChecks = await checkUrlsHealth(
      collectUrlsFromMapping(mapping, normalizeGutenbergEntries),
    );
    const urlWarnings = urlChecks
      .filter((check) => !check.ok)
      .map((check) =>
        check.status
          ? `Potential dead link (${check.status}) for ${check.url}`
          : `Potential dead link for ${check.url}: ${check.error ?? 'unknown error'}`,
      );

    const combinedWarnings = [...limitWarnings, ...urlWarnings];

    if (dryRun) {
      return {
        totals: {
          ...limitTotals,
          provider: providerId,
          modulesDetected: counts.modules,
          assetsDetected: counts.assets,
          assetsInserted: 0,
          urlChecks: urlChecks.length,
          urlFailures: urlWarnings.length,
          dryRun: true,
        },
        errors: [],
        warnings: [...combinedWarnings, 'Dry run enabled; no data was written.'],
      };
    }

    const inserted = await importGutenbergMapping(client, mapping);
    return {
      totals: {
        ...limitTotals,
        provider: providerId,
        modulesDetected: counts.modules,
        assetsInserted: inserted,
        urlChecks: urlChecks.length,
        urlFailures: urlWarnings.length,
        dryRun: false,
      },
      errors: [],
      warnings: combinedWarnings,
    };
  }

  if (providerId === 'federal') {
    const mapping = run.input?.mapping as FederalMapping | undefined;
    if (!mapping || typeof mapping !== 'object') {
      return {
        totals: null,
        errors: ['Import run did not include a Federal mapping payload.'],
        warnings: [],
      };
    }

    const counts = countMappingItems(mapping, normalizeFederalEntries);
    const limitAssessment = evaluateImportLimits(counts, limits);
    const limitWarnings = [...limitAssessment.warnings];

    if (limitAssessment.errors.length) {
      return {
        totals: {
          ...limitTotals,
          provider: providerId,
          modulesDetected: counts.modules,
          assetsDetected: counts.assets,
          dryRun: true,
        },
        errors: limitAssessment.errors,
        warnings: limitWarnings,
      };
    }

    const urlChecks = await checkUrlsHealth(
      collectUrlsFromMapping(mapping, normalizeFederalEntries),
    );
    const urlWarnings = urlChecks
      .filter((check) => !check.ok)
      .map((check) =>
        check.status
          ? `Potential dead link (${check.status}) for ${check.url}`
          : `Potential dead link for ${check.url}: ${check.error ?? 'unknown error'}`,
      );

    const combinedWarnings = [...limitWarnings, ...urlWarnings];

    if (dryRun) {
      return {
        totals: {
          ...limitTotals,
          provider: providerId,
          modulesDetected: counts.modules,
          assetsDetected: counts.assets,
          assetsInserted: 0,
          urlChecks: urlChecks.length,
          urlFailures: urlWarnings.length,
          dryRun: true,
        },
        errors: [],
        warnings: [...combinedWarnings, 'Dry run enabled; no data was written.'],
      };
    }

    const inserted = await importFederalMapping(client, mapping);
    return {
      totals: {
        ...limitTotals,
        provider: providerId,
        modulesDetected: counts.modules,
        assetsInserted: inserted,
        urlChecks: urlChecks.length,
        urlFailures: urlWarnings.length,
        dryRun: false,
      },
      errors: [],
      warnings: combinedWarnings,
    };
  }

  const datasetPayload =
    (run.input?.dataset as NormalizedProviderDataset | undefined) ??
    (run.input?.extraInput as NormalizedProviderDataset | undefined);

  if (!isNormalizedProviderDataset(datasetPayload)) {
    return {
      totals: null,
      errors: ['Import run is missing a normalized dataset payload.'],
      warnings: [],
    };
  }

  const datasetCounts = countDatasetItems(datasetPayload);
  const limitAssessment = evaluateImportLimits(datasetCounts, limits);
  const limitWarnings = [...limitAssessment.warnings];

  if (limitAssessment.errors.length) {
    return {
      totals: {
        ...limitTotals,
        provider: providerId,
        modulesDetected: datasetCounts.modules,
        assetsDetected: datasetCounts.assets,
        dryRun: true,
      },
      errors: limitAssessment.errors,
      warnings: limitWarnings,
    };
  }

  const { assets, warnings, errors, urlWarnings, totals, lessonState } = await prepareDatasetAssets(
    client,
    providerId,
    datasetPayload,
    run,
  );

  const combinedWarnings = [
    ...limitWarnings,
    ...warnings,
    ...urlWarnings,
    ...(dryRun ? ['Dry run enabled; no data was written.'] : []),
  ];

  if (dryRun) {
    return {
      totals: {
        ...totals,
        ...limitTotals,
        modulesDetected: datasetCounts.modules,
        assetsDetected: datasetCounts.assets,
        assetsInserted: 0,
        lessonsUpdated: lessonState.touchedLessons.size,
        dryRun: true,
      },
      errors,
      warnings: combinedWarnings,
    };
  }

  await finaliseDatasetImport(client, assets, lessonState);

  return {
    totals: {
      ...totals,
      ...limitTotals,
      modulesDetected: datasetCounts.modules,
      assetsDetected: datasetCounts.assets,
      assetsInserted: assets.length,
      lessonsUpdated: lessonState.touchedLessons.size,
      dryRun: false,
    },
    errors,
    warnings: combinedWarnings,
  };
};
