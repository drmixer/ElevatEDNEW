import fs from 'node:fs/promises';

import type {
  NormalizedAsset,
  NormalizedProviderDataset,
} from '../../../../shared/importers/normalized.js';
import type { ProviderLoader, ProviderLoaderOptions, ProviderLoaderResult } from '../types.js';

type RawSiyavulaExercise = {
  url?: string;
  title?: string;
  description?: string;
  difficulty?: number;
  tags?: string[];
  license?: string;
};

type RawSiyavulaTopic = {
  moduleSlug?: string;
  module?: string;
  title?: string;
  gradeBand?: string;
  subject?: string;
  strand?: string;
  topic?: string;
  practiceSets?: RawSiyavulaExercise[];
  references?: RawSiyavulaExercise[];
};

type RawSiyavulaFile = {
  generatedAt?: string;
  topics?: RawSiyavulaTopic[];
};

const readRawFile = async (inputPath: string): Promise<RawSiyavulaFile> => {
  const raw = await fs.readFile(inputPath, 'utf8');
  try {
    return JSON.parse(raw) as RawSiyavulaFile;
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

const normaliseAsset = (
  exercise: RawSiyavulaExercise,
  defaultKind: string,
): NormalizedAsset | null => {
  if (!exercise.url || exercise.url.trim().length === 0) {
    return null;
  }
  return {
    url: exercise.url.trim(),
    title: exercise.title?.trim() ?? null,
    description: exercise.description?.trim() ?? null,
    kind: defaultKind,
    license: exercise.license ?? 'CC BY 4.0',
    tags: normaliseTags(exercise.tags),
    metadata: {
      difficulty: exercise.difficulty ?? null,
      source: 'siyavula',
    },
  };
};

export const loadSiyavulaDataset: ProviderLoader = async (
  inputPath: string,
  options: ProviderLoaderOptions,
): Promise<ProviderLoaderResult> => {
  const raw = await readRawFile(inputPath);
  const topics = raw.topics ?? [];
  const limit = options.limit ?? topics.length;

  const dataset: NormalizedProviderDataset = {
    provider: 'siyavula',
    generatedAt: raw.generatedAt ?? new Date().toISOString(),
    modules: [],
  };

  for (const topic of topics.slice(0, limit)) {
    const moduleSlug = topic.moduleSlug ?? topic.module;
    if (!moduleSlug || moduleSlug.trim().length === 0) {
      continue;
    }

    const practiceAssets = Array.isArray(topic.practiceSets)
      ? topic.practiceSets
        .map((exercise) => normaliseAsset(exercise, 'practice'))
        .filter((asset): asset is NormalizedAsset => asset !== null)
      : [];

    const referenceAssets = Array.isArray(topic.references)
      ? topic.references
        .map((exercise) => normaliseAsset(exercise, 'reference'))
        .filter((asset): asset is NormalizedAsset => asset !== null)
      : [];

    dataset.modules.push({
      moduleSlug: moduleSlug.trim(),
      moduleTitle: topic.title?.trim() ?? null,
      gradeBand: topic.gradeBand?.trim() ?? null,
      subject: topic.subject?.trim() ?? null,
      strand: topic.strand?.trim() ?? null,
      topic: topic.topic?.trim() ?? null,
      assets: [...practiceAssets, ...referenceAssets],
    });
  }

  return {
    provider: 'siyavula',
    format: 'dataset',
    payload: dataset,
  };
};
