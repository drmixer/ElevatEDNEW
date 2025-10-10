import path from 'node:path';
import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadStructuredFile } from './utils/files.js';
import { createServiceRoleClient, resolveModules } from './utils/supabase.js';

type ModuleStandardsInput =
  | string
  | {
      code: string;
      framework?: string;
      alignment?: string | null;
      notes?: string | null;
      metadata?: Record<string, unknown> | null;
      [key: string]: unknown;
    };

type NormalizedModuleStandard = {
  moduleSlug: string;
  framework: string;
  code: string;
  alignment: string | null;
  metadata: Record<string, unknown>;
};

type ModuleMap = Map<string, { id: number; slug: string }>;
type StandardMap = Map<string, number>;

const DEFAULT_FILE = path.resolve(process.cwd(), 'mappings/module_standards.json');
const BATCH_SIZE = 200;

const normalizeString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value == null) {
    return null;
  }
  return String(value).trim() || null;
};

const parseStandardToken = (token: string): { framework: string; code: string } => {
  const parts = token.split(':').map((part) => part.trim());
  if (parts.length === 2) {
    return { framework: parts[0], code: parts[1] };
  }
  if (parts.length === 1) {
    return { framework: '', code: parts[0] };
  }
  throw new Error(`Unable to parse standard token "${token}"`);
};

const normalizeEntry = (
  moduleSlug: string,
  input: ModuleStandardsInput,
  defaultFramework: string | null,
): NormalizedModuleStandard => {
  if (typeof input === 'string') {
    const { framework, code } = parseStandardToken(input);
    return {
      moduleSlug,
      framework: normalizeString(framework) ?? defaultFramework ?? 'Unknown',
      code,
      alignment: null,
      metadata: {},
    };
  }

  const framework = normalizeString(input.framework) ?? defaultFramework ?? null;
  const code = normalizeString(input.code);
  if (!framework || !code) {
    throw new Error(
      `Module ${moduleSlug} mapping is missing framework/code. Entry: ${JSON.stringify(input, null, 2)}`,
    );
  }

  const alignment = normalizeString(input.alignment);
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (['code', 'framework', 'alignment', 'metadata', 'notes'].includes(key)) {
      continue;
    }
    if (value !== undefined) {
      metadata[key] = value;
    }
  }
  if (input.notes) {
    metadata.notes = input.notes;
  }
  if (input.metadata && typeof input.metadata === 'object') {
    Object.assign(metadata, input.metadata as Record<string, unknown>);
  }

  return {
    moduleSlug,
    framework,
    code,
    alignment,
    metadata,
  };
};

const loadModuleStandards = async (
  filePath: string,
): Promise<{ moduleSlug: string; entries: NormalizedModuleStandard[] }[]> => {
  const payload = await loadStructuredFile<Record<string, ModuleStandardsInput[] | ModuleStandardsInput>>(
    filePath,
  );

  const results: { moduleSlug: string; entries: NormalizedModuleStandard[] }[] = [];

  for (const [moduleSlug, value] of Object.entries(payload)) {
    if (Array.isArray(value)) {
      const normalized = value.map((entry) => normalizeEntry(moduleSlug, entry, null));
      results.push({ moduleSlug, entries: normalized });
      continue;
    }

    if (
      value &&
      typeof value === 'object' &&
      !('code' in value) &&
      'standards' in value &&
      Array.isArray((value as Record<string, unknown>).standards)
    ) {
      const { framework } = value as { framework?: string };
      const standards = (value as Record<string, unknown>).standards as ModuleStandardsInput[];
      const normalized = standards.map((entry) => normalizeEntry(moduleSlug, entry, framework ?? null));
      results.push({ moduleSlug, entries: normalized });
      continue;
    }

    const list = [value];
    const normalized = list.map((entry) => normalizeEntry(moduleSlug, entry, null));
    results.push({ moduleSlug, entries: normalized });
  }

  return results;
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const fetchStandards = async (
  supabase: SupabaseClient,
  combinations: Array<{ framework: string; code: string }>,
): Promise<StandardMap> => {
  const grouped = new Map<string, Set<string>>();
  for (const combo of combinations) {
    const framework = combo.framework.trim();
    const code = combo.code.trim();
    if (!grouped.has(framework)) {
      grouped.set(framework, new Set());
    }
    grouped.get(framework)!.add(code);
  }

  const standards = new Map<string, number>();

  for (const [framework, codesSet] of grouped.entries()) {
    const codes = Array.from(codesSet);
    if (codes.length === 0) {
      continue;
    }
    const { data, error } = await supabase
      .from('standards')
      .select('id, code')
      .eq('framework', framework)
      .in('code', codes);

    if (error) {
      throw new Error(`Failed to fetch standards for ${framework}: ${error.message}`);
    }

    for (const record of data ?? []) {
      standards.set(`${framework}::${record.code as string}`, record.id as number);
    }
  }

  return standards;
};

const upsertModuleStandards = async (
  supabase: SupabaseClient,
  modules: ModuleMap,
  standards: StandardMap,
  entries: NormalizedModuleStandard[],
): Promise<number> => {
  const payload = entries.map((entry) => {
    const module = modules.get(entry.moduleSlug) ?? modules.get(entry.moduleSlug.trim());
    if (!module) {
      throw new Error(`Module "${entry.moduleSlug}" was not resolved. Ensure it exists in the database.`);
    }

    const standardKey = `${entry.framework}::${entry.code}`;
    const standardId = standards.get(standardKey);
    if (!standardId) {
      throw new Error(`Standard "${standardKey}" not found. Import standards before linking modules.`);
    }

    return {
      module_id: module.id,
      standard_id: standardId,
      alignment_strength: entry.alignment,
      metadata: entry.metadata,
    };
  });

  let inserted = 0;
  for (const chunk of chunkArray(payload, BATCH_SIZE)) {
    const { error, data } = await supabase
      .from('module_standards')
      .upsert(chunk, { onConflict: 'module_id,standard_id' })
      .select('id');

    if (error) {
      throw new Error(`Failed to upsert module standards: ${error.message}`);
    }

    inserted += data?.length ?? 0;
  }

  return inserted;
};

const parseArgs = (): { file: string } => {
  const args = process.argv.slice(2);
  let file = DEFAULT_FILE;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--file' || arg === '--path') {
      const next = args[i + 1];
      if (!next) {
        throw new Error(`Expected value after ${arg}`);
      }
      file = path.resolve(process.cwd(), next);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { file };
};

const main = async () => {
  const { file } = parseArgs();
  const mappings = await loadModuleStandards(file);
  const entries = mappings.flatMap((record) => record.entries);

  if (entries.length === 0) {
    console.log(`No module standard mappings found in ${file}`);
    return;
  }

  const moduleSlugs = Array.from(new Set(entries.map((entry) => entry.moduleSlug)));
  const combinations = Array.from(
    new Map(entries.map((entry) => [`${entry.framework}::${entry.code}`, entry])).values(),
  ).map((entry) => ({ framework: entry.framework, code: entry.code }));

  const supabase = createServiceRoleClient();
  const modules = await resolveModules(supabase, moduleSlugs);
  const standards = await fetchStandards(supabase, combinations);

  const inserted = await upsertModuleStandards(supabase, modules, standards, entries);

  console.log(`Linked ${inserted} module-standard pairs from ${file}`);
};

const invokedFromCli =
  process.argv[1]?.includes('import_module_standards.ts') ||
  process.argv[1]?.includes('import_module_standards.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
