import fs from 'node:fs/promises';

import type { OpenStaxMapping, OpenStaxMappingValue } from '../../../../scripts/import_openstax.js';
import type { ProviderLoader, ProviderLoaderOptions, ProviderLoaderResult } from '../types.js';

type RawOpenStaxAsset = {
  moduleSlug?: string;
  module?: string;
  lessonSlug?: string;
  lessonTitle?: string;
  url?: string;
  title?: string;
  description?: string;
  tags?: string[];
};

type RawOpenStaxFile = {
  generatedAt?: string;
  chapters?: RawOpenStaxAsset[];
  assets?: RawOpenStaxAsset[];
};

const normaliseModuleSlug = (asset: RawOpenStaxAsset): string | null => {
  const slug = asset.moduleSlug ?? asset.module;
  if (typeof slug !== 'string') {
    return null;
  }
  const trimmed = slug.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normaliseAssetEntry = (asset: RawOpenStaxAsset): OpenStaxMappingValue | null => {
  if (!asset.url || asset.url.trim().length === 0) {
    return null;
  }
  return {
    url: asset.url.trim(),
    title: asset.title?.trim(),
    description: asset.description?.trim(),
    tags: Array.isArray(asset.tags)
      ? asset.tags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter((tag) => tag.length > 0)
      : [],
    lessonSlug: asset.lessonSlug?.trim(),
    lessonTitle: asset.lessonTitle?.trim(),
  };
};

const mergeAssets = (target: OpenStaxMapping, slug: string, value: OpenStaxMappingValue) => {
  if (!target[slug]) {
    target[slug] = [];
  }
  target[slug].push(value);
};

const readRawFile = async (inputPath: string): Promise<RawOpenStaxFile> => {
  const raw = await fs.readFile(inputPath, 'utf8');
  try {
    return JSON.parse(raw) as RawOpenStaxFile;
  } catch (error) {
    throw new Error(`Failed to parse ${inputPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const loadOpenStaxMapping: ProviderLoader = async (
  inputPath: string,
  options: ProviderLoaderOptions,
): Promise<ProviderLoaderResult> => {
  const data = await readRawFile(inputPath);
  const mapping: OpenStaxMapping = {};

  const assets = [...(data.chapters ?? []), ...(data.assets ?? [])];
  const limit = options.limit ?? assets.length;

  for (const asset of assets.slice(0, limit)) {
    const moduleSlug = normaliseModuleSlug(asset);
    if (!moduleSlug) {
      continue;
    }
    const entry = normaliseAssetEntry(asset);
    if (!entry) {
      continue;
    }
    mergeAssets(mapping, moduleSlug, entry);
  }

  return {
    provider: 'openstax',
    format: 'mapping',
    payload: mapping,
  };
};
