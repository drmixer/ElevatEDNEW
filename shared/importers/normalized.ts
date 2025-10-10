import type { ImportProviderId } from '../import-providers.js';

export type NormalizedAsset = {
  url: string;
  title?: string | null;
  description?: string | null;
  kind?: string;
  license?: string | null;
  licenseUrl?: string | null;
  attribution?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  lessonSlug?: string | null;
  lessonTitle?: string | null;
};

export type NormalizedLesson = {
  slug?: string | null;
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  estimatedDurationMinutes?: number | null;
  attributionBlock?: string | null;
  assets?: NormalizedAsset[];
};

export type NormalizedModule = {
  moduleSlug: string;
  moduleTitle?: string | null;
  subject?: string | null;
  gradeBand?: string | null;
  strand?: string | null;
  topic?: string | null;
  assets?: NormalizedAsset[];
  lessons?: NormalizedLesson[];
  metadata?: Record<string, unknown>;
};

export type NormalizedProviderDataset = {
  provider: ImportProviderId;
  generatedAt?: string;
  version?: string;
  source?: string;
  notes?: string;
  modules: NormalizedModule[];
};

export const isNormalizedProviderDataset = (
  value: unknown,
): value is NormalizedProviderDataset => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const dataset = value as Record<string, unknown>;
  if (typeof dataset.provider !== 'string' || !Array.isArray(dataset.modules)) {
    return false;
  }
  for (const module of dataset.modules) {
    if (!module || typeof module !== 'object') {
      return false;
    }
    const slug = (module as Record<string, unknown>).moduleSlug;
    if (typeof slug !== 'string' || slug.trim().length === 0) {
      return false;
    }
  }
  return true;
};
