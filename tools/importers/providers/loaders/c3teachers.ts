import fs from 'node:fs/promises';

import type {
  NormalizedAsset,
  NormalizedLesson,
  NormalizedProviderDataset,
} from '../../../../shared/importers/normalized.js';
import type { ProviderLoader, ProviderLoaderOptions, ProviderLoaderResult } from '../types.js';

type RawC3Resource = {
  url?: string;
  title?: string;
  description?: string;
  type?: string;
  tags?: string[];
  license?: string;
};

type RawC3Lesson = {
  slug?: string;
  title?: string;
  summary?: string;
  resources?: RawC3Resource[];
};

type RawC3Inquiry = {
  moduleSlug?: string;
  module?: string;
  title?: string;
  gradeBand?: string;
  subject?: string;
  strand?: string;
  topic?: string;
  overviewResources?: RawC3Resource[];
  lessons?: RawC3Lesson[];
};

type RawC3File = {
  generatedAt?: string;
  inquiries?: RawC3Inquiry[];
};

const readRawFile = async (inputPath: string): Promise<RawC3File> => {
  const raw = await fs.readFile(inputPath, 'utf8');
  try {
    return JSON.parse(raw) as RawC3File;
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

const normaliseAsset = (resource: RawC3Resource): NormalizedAsset | null => {
  if (!resource.url || resource.url.trim().length === 0) {
    return null;
  }
  return {
    url: resource.url.trim(),
    title: resource.title?.trim() ?? null,
    description: resource.description?.trim() ?? null,
    kind: resource.type?.trim()?.toLowerCase() ?? 'activity',
    license: resource.license ?? 'CC BY-NC-SA 4.0',
    tags: normaliseTags(resource.tags),
    metadata: {
      source_type: resource.type ?? null,
    },
  };
};

const normaliseLesson = (lesson: RawC3Lesson): NormalizedLesson => ({
  slug: lesson.slug?.trim() ?? null,
  title: lesson.title?.trim() ?? null,
  summary: lesson.summary?.trim() ?? null,
  assets: Array.isArray(lesson.resources)
    ? lesson.resources
      .map((resource) => normaliseAsset(resource))
      .filter((asset): asset is NormalizedAsset => asset !== null)
    : [],
});

export const loadC3TeachersDataset: ProviderLoader = async (
  inputPath: string,
  options: ProviderLoaderOptions,
): Promise<ProviderLoaderResult> => {
  const raw = await readRawFile(inputPath);
  const inquiries = raw.inquiries ?? [];
  const limit = options.limit ?? inquiries.length;

  const dataset: NormalizedProviderDataset = {
    provider: 'c3teachers',
    generatedAt: raw.generatedAt ?? new Date().toISOString(),
    modules: [],
  };

  for (const inquiry of inquiries.slice(0, limit)) {
    const moduleSlug = inquiry.moduleSlug ?? inquiry.module;
    if (!moduleSlug || moduleSlug.trim().length === 0) {
      continue;
    }

    const moduleAssets = Array.isArray(inquiry.overviewResources)
      ? inquiry.overviewResources
        .map((resource) => normaliseAsset(resource))
        .filter((asset): asset is NormalizedAsset => asset !== null)
      : [];

    const lessons = Array.isArray(inquiry.lessons)
      ? inquiry.lessons.map((lesson) => normaliseLesson(lesson ?? {})).filter((lesson) => lesson.assets && lesson.assets.length > 0)
      : [];

    dataset.modules.push({
      moduleSlug: moduleSlug.trim(),
      moduleTitle: inquiry.title?.trim() ?? null,
      gradeBand: inquiry.gradeBand?.trim() ?? null,
      subject: inquiry.subject?.trim() ?? null,
      strand: inquiry.strand?.trim() ?? null,
      topic: inquiry.topic?.trim() ?? null,
      assets: moduleAssets,
      lessons,
    });
  }

  return {
    provider: 'c3teachers',
    format: 'dataset',
    payload: dataset,
  };
};
