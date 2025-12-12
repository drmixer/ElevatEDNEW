import process from 'node:process';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const createServiceRoleClient = (): SupabaseClient =>
  createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

const resolveAnonKey = (): string => {
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (anonKey) {
    return anonKey;
  }
  throw new Error('Missing SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY environment variable.');
};

export const createRlsClient = (accessToken?: string | null): SupabaseClient =>
  createClient(requireEnv('SUPABASE_URL'), resolveAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    },
  });

type ModuleRecord = { id: number; slug: string };

export const resolveModules = async (
  supabase: SupabaseClient,
  identifiers: string[],
): Promise<Map<string, ModuleRecord>> => {
  const uniqueIdentifiers = Array.from(new Set(identifiers));
  const slugKeys: string[] = [];
  const idKeys: number[] = [];

  for (const identifier of uniqueIdentifiers) {
    const numericId = Number.parseInt(identifier, 10);
    if (!Number.isNaN(numericId) && numericId > 0 && String(numericId) === identifier.trim()) {
      idKeys.push(numericId);
    } else {
      slugKeys.push(identifier.trim());
    }
  }

  const results = new Map<string, ModuleRecord>();

  if (slugKeys.length > 0) {
    const { data, error } = await supabase
      .from('modules')
      .select('id, slug')
      .in('slug', slugKeys);

    if (error) {
      throw new Error(`Failed to resolve module slugs: ${error.message}`);
    }

    for (const record of data ?? []) {
      results.set(record.slug, { id: record.id as number, slug: record.slug as string });
    }
  }

  if (idKeys.length > 0) {
    const { data, error } = await supabase
      .from('modules')
      .select('id, slug')
      .in('id', idKeys);

    if (error) {
      throw new Error(`Failed to resolve module ids: ${error.message}`);
    }

    for (const record of data ?? []) {
      results.set(String(record.id), { id: record.id as number, slug: record.slug as string });
    }
  }

  for (const identifier of uniqueIdentifiers) {
    if (!results.has(identifier) && !results.has(identifier.trim())) {
      throw new Error(`Module "${identifier}" not found in modules table.`);
    }
  }

  return results;
};

type PaginatedFetchOptions = {
  pageSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  jitterMs?: number;
  logLabel?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchAllPaginated = async <T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  options: PaginatedFetchOptions = {},
): Promise<T[]> => {
  const {
    pageSize = 1000,
    maxRetries = 3,
    retryDelayMs = 400,
    jitterMs = 150,
    logLabel,
  } = options;

  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;

    let attempt = 0;
    let lastError: { message: string } | null = null;
    let batch: T[] = [];

    while (attempt <= maxRetries) {
      const result = await makeQuery(from, to);
      if (!result.error) {
        batch = (result.data ?? []) as T[];
        lastError = null;
        break;
      }

      lastError = result.error;
      attempt += 1;

      if (attempt > maxRetries) {
        break;
      }

      const backoff = retryDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * jitterMs);
      if (logLabel) {
        // eslint-disable-next-line no-console
        console.warn(`[pagination] retrying ${logLabel} after error: ${lastError.message}`);
      }
      await sleep(backoff + jitter);
    }

    if (lastError) {
      throw new Error(`Failed to fetch paginated results${logLabel ? ` for ${logLabel}` : ''}: ${lastError.message}`);
    }

    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
};

type ContentSourceRecord = {
  id: number;
  name: string;
  license: string;
  license_url?: string | null;
  attribution_text?: string | null;
};

export const fetchContentSourcesByName = async (
  supabase: SupabaseClient,
  names: string[],
): Promise<Map<string, ContentSourceRecord>> => {
  if (names.length === 0) {
    return new Map();
  }
  const { data, error } = await supabase
    .from('content_sources')
    .select('id, name, license, license_url, attribution_text')
    .in('name', names);

  if (error) {
    throw new Error(`Failed to fetch content sources: ${error.message}`);
  }

  const map = new Map<string, ContentSourceRecord>();
  for (const record of data ?? []) {
    map.set(record.name as string, {
      id: record.id as number,
      name: record.name as string,
      license: record.license as string,
      license_url: record.license_url as string | null,
      attribution_text: record.attribution_text as string | null,
    });
  }

  for (const name of names) {
    if (!map.has(name)) {
      throw new Error(`Content source "${name}" not found. Seed content sources before import.`);
    }
  }

  return map;
};

export type LessonSummary = {
  id: number;
  module_id: number;
  slug: string;
  title: string;
  attribution_block: string | null;
};

export const fetchLessonsByModuleIds = async (
  supabase: SupabaseClient,
  moduleIds: number[],
): Promise<Map<number, LessonSummary[]>> => {
  const uniqueIds = Array.from(new Set(moduleIds)).filter((id) => Number.isInteger(id));
  const lessonsByModule = new Map<number, LessonSummary[]>();

  if (uniqueIds.length === 0) {
    return lessonsByModule;
  }

  const { data, error } = await supabase
    .from('lessons')
    .select('id, module_id, slug, title, attribution_block')
    .in('module_id', uniqueIds);

  if (error) {
    throw new Error(`Failed to load lessons for modules: ${error.message}`);
  }

  for (const record of data ?? []) {
    const moduleId = record.module_id as number;
    const lesson: LessonSummary = {
      id: record.id as number,
      module_id: moduleId,
      slug: (record.slug as string) ?? '',
      title: (record.title as string) ?? '',
      attribution_block: (record.attribution_block as string | null) ?? null,
    };
    const existing = lessonsByModule.get(moduleId);
    if (existing) {
      existing.push(lesson);
    } else {
      lessonsByModule.set(moduleId, [lesson]);
    }
  }

  return lessonsByModule;
};

const normalizeValue = (value: string | null | undefined): string =>
  value?.trim().toLowerCase() ?? '';

export const findLessonForModule = (
  lessons: Map<number, LessonSummary[]>,
  moduleId: number,
  identifier: { slug?: string | null; title?: string | null },
): LessonSummary | null => {
  const moduleLessons = lessons.get(moduleId);
  if (!moduleLessons || moduleLessons.length === 0) {
    return null;
  }

  const slug = normalizeValue(identifier.slug);
  if (slug) {
    const matched = moduleLessons.find((lesson) => normalizeValue(lesson.slug) === slug);
    if (matched) {
      return matched;
    }
  }

  const title = normalizeValue(identifier.title);
  if (title) {
    const matched = moduleLessons.find((lesson) => normalizeValue(lesson.title) === title);
    if (matched) {
      return matched;
    }
  }

  return null;
};

export const updateLessonAttributionBlocks = async (
  supabase: SupabaseClient,
  updates: Map<number, string>,
): Promise<void> => {
  if (updates.size === 0) {
    return;
  }

  for (const [id, attribution_block] of updates.entries()) {
    const { error } = await supabase
      .from('lessons')
      .update({ attribution_block })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update lesson attribution blocks: ${error.message}`);
    }
  }
};
