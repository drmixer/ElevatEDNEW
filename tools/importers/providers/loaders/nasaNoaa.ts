import fs from 'node:fs/promises';

import type {
  NormalizedAsset,
  NormalizedProviderDataset,
} from '../../../../shared/importers/normalized.js';
import type { ProviderLoader, ProviderLoaderOptions, ProviderLoaderResult } from '../types.js';

type RawMediaItem = {
  url?: string;
  title?: string;
  description?: string;
  mediaType?: string;
  tags?: string[];
  credit?: string;
  license?: string;
};

type RawCollection = {
  moduleSlug?: string;
  module?: string;
  title?: string;
  summary?: string;
  items?: RawMediaItem[];
};

type RawNasaNoaaFile = {
  generatedAt?: string;
  collections?: RawCollection[];
};

const readRawFile = async (inputPath: string): Promise<RawNasaNoaaFile> => {
  const raw = await fs.readFile(inputPath, 'utf8');
  try {
    return JSON.parse(raw) as RawNasaNoaaFile;
  } catch (error) {
    throw new Error(`Failed to parse ${inputPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const normaliseTags = (tags?: unknown): string[] => {
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => tag.length > 0);
};

const normaliseAsset = (item: RawMediaItem): NormalizedAsset | null => {
  if (!item.url || item.url.trim().length === 0) {
    return null;
  }
  return {
    url: item.url.trim(),
    title: item.title?.trim() ?? null,
    description: item.description?.trim() ?? null,
    kind: item.mediaType?.trim()?.toLowerCase() ?? 'media',
    license: item.license ?? 'Public Domain',
    tags: normaliseTags(item.tags),
    metadata: {
      credit: item.credit ?? null,
      provider: 'nasa_noaa',
    },
  };
};

export const loadNasaNoaaDataset: ProviderLoader = async (
  inputPath: string,
  options: ProviderLoaderOptions,
): Promise<ProviderLoaderResult> => {
  const raw = await readRawFile(inputPath);
  const collections = raw.collections ?? [];
  const limit = options.limit ?? collections.length;

  const dataset: NormalizedProviderDataset = {
    provider: 'nasa_noaa',
    generatedAt: raw.generatedAt ?? new Date().toISOString(),
    modules: [],
  };

  for (const collection of collections.slice(0, limit)) {
    const moduleSlug = collection.moduleSlug ?? collection.module;
    if (!moduleSlug || moduleSlug.trim().length === 0) {
      continue;
    }

    const assets = Array.isArray(collection.items)
      ? collection.items
        .map((item) => normaliseAsset(item))
        .filter((asset): asset is NormalizedAsset => asset !== null)
      : [];

    dataset.modules.push({
      moduleSlug: moduleSlug.trim(),
      moduleTitle: collection.title?.trim() ?? null,
      assets,
      metadata: {
        summary: collection.summary ?? null,
      },
    });
  }

  return {
    provider: 'nasa_noaa',
    format: 'dataset',
    payload: dataset,
  };
};
