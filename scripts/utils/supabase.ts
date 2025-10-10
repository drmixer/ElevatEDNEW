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
