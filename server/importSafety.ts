import { isNormalizedProviderDataset, type NormalizedProviderDataset } from '../shared/importers/normalized.js';

export type ImportLimits = {
  maxModules?: number;
  maxAssets?: number;
};

export type ImportLimitResult = {
  errors: string[];
  warnings: string[];
};

export const normalizeImportLimits = (input: unknown): ImportLimits => {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const asLimit = (value: unknown): number | undefined => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    const normalized = Math.max(0, Math.floor(parsed));
    return normalized > 0 ? normalized : undefined;
  };

  const payload = input as Record<string, unknown>;
  const maxModules = asLimit(payload.maxModules);
  const maxAssets = asLimit(payload.maxAssets);

  return {
    ...(maxModules ? { maxModules } : {}),
    ...(maxAssets ? { maxAssets } : {}),
  };
};

const DEFAULT_WARNING_LIMITS: Required<ImportLimits> = {
  maxModules: 200,
  maxAssets: 5000,
};

export const evaluateImportLimits = (
  counts: { modules: number; assets: number },
  limits?: ImportLimits,
): ImportLimitResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const thresholds = { ...DEFAULT_WARNING_LIMITS, ...(limits ?? {}) };

  if (limits?.maxModules && counts.modules > limits.maxModules) {
    errors.push(
      `Import includes ${counts.modules} modules which exceeds the limit of ${limits.maxModules}.`,
    );
  } else if (counts.modules > thresholds.maxModules) {
    warnings.push(
      `Large module volume detected (${counts.modules}); consider running a dry run or setting a lower limit.`,
    );
  }

  if (limits?.maxAssets && counts.assets > limits.maxAssets) {
    errors.push(
      `Import includes ${counts.assets} assets which exceeds the limit of ${limits.maxAssets}.`,
    );
  } else if (counts.assets > thresholds.maxAssets) {
    warnings.push(
      `Large asset volume detected (${counts.assets}); imports may take longer than usual.`,
    );
  }

  return { errors, warnings };
};

export const countDatasetItems = (
  dataset: NormalizedProviderDataset,
): { modules: number; assets: number } => {
  if (!isNormalizedProviderDataset(dataset)) {
    return { modules: 0, assets: 0 };
  }

  let assets = 0;

  for (const module of dataset.modules) {
    if (!module) continue;

    if (Array.isArray(module.assets)) {
      assets += module.assets.filter(Boolean).length;
    }

    if (Array.isArray(module.lessons)) {
      for (const lesson of module.lessons) {
        if (lesson && Array.isArray(lesson.assets)) {
          assets += lesson.assets.filter(Boolean).length;
        }
      }
    }
  }

  return {
    modules: dataset.modules.length,
    assets,
  };
};

export const countMappingItems = <T>(
  mapping: Record<string, T[]>,
  normalizer: (value: T[]) => Array<unknown>,
): { modules: number; assets: number } => {
  const moduleKeys = Object.keys(mapping);
  let assets = 0;

  for (const entries of Object.values(mapping)) {
    assets += normalizer(entries ?? []).length;
  }

  return {
    modules: moduleKeys.length,
    assets,
  };
};
