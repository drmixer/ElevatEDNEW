import path from 'node:path';
import process from 'node:process';

import { loadModuleStandards } from './import_module_standards.js';
import { createServiceRoleClient } from './utils/supabase.js';

type NormalizedEntry = {
  moduleSlug: string;
  entries: Array<{
    moduleSlug: string;
    framework: string;
    code: string;
  }>;
};

const DEFAULT_FILE = path.resolve(process.cwd(), 'mappings/module_standards_k12.json');
const BATCH_SIZE = 200;

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const fetchStandardIds = async (
  supabase: ReturnType<typeof createServiceRoleClient>,
  combos: Array<{ framework: string; code: string }>,
): Promise<Map<string, number>> => {
  const map = new Map<string, number>();
  const grouped = new Map<string, Set<string>>();

  for (const combo of combos) {
    const framework = combo.framework.trim();
    const code = combo.code.trim();
    if (!grouped.has(framework)) grouped.set(framework, new Set());
    grouped.get(framework)!.add(code);
  }

  for (const [framework, codes] of grouped.entries()) {
    const { data, error } = await supabase
      .from('standards')
      .select('id, code')
      .eq('framework', framework)
      .in('code', Array.from(codes));
    if (error) {
      throw new Error(`Failed to load standards for ${framework}: ${error.message}`);
    }
    for (const record of data ?? []) {
      map.set(`${framework}::${record.code as string}`, record.id as number);
    }
  }

  return map;
};

const upsertModuleStandards = async (
  supabase: ReturnType<typeof createServiceRoleClient>,
  entries: NormalizedEntry[],
  standards: Map<string, number>,
  modules: Map<string, { id: number; slug: string }>,
): Promise<number> => {
  const payload = entries.flatMap((entry) =>
    entry.entries.map((std) => {
      const module = modules.get(entry.moduleSlug) ?? modules.get(entry.moduleSlug.trim());
      if (!module) {
        throw new Error(`Module "${entry.moduleSlug}" not found when linking standards.`);
      }
      const key = `${std.framework}::${std.code}`;
      const standardId = standards.get(key);
      if (!standardId) {
        throw new Error(`Standard "${key}" not found in standards table.`);
      }
      return {
        module_id: module.id,
        standard_id: standardId,
        alignment_strength: null,
        metadata: { source: 'sync_module_standards' },
      };
    }),
  );

  let inserted = 0;
  for (const chunk of chunkArray(payload, BATCH_SIZE)) {
    const { data, error } = await supabase
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

const dedupe = (items: Array<string | null | undefined>): string[] => {
  const set = new Set<string>();
  for (const value of items) {
    const trimmed = value?.trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set);
};

const updateLessonMetadataStandards = async (
  supabase: ReturnType<typeof createServiceRoleClient>,
  moduleIds: number[],
  mapping: Map<number, string[]>,
): Promise<number> => {
  if (moduleIds.length === 0) return 0;

  const { data: lessons, error } = await supabase
    .from('lessons')
    .select('id, module_id, metadata')
    .in('module_id', moduleIds);

  if (error) {
    throw new Error(`Failed to load lessons for standards sync: ${error.message}`);
  }

  let updated = 0;

  for (const lesson of lessons ?? []) {
    const moduleId = lesson.module_id as number;
    const standards = mapping.get(moduleId) ?? [];
    if (standards.length === 0) continue;

    const existing = (lesson.metadata ?? {}) as Record<string, unknown>;
    const currentStandards = Array.isArray(existing.standards) ? (existing.standards as Array<string>) : [];
    const merged = dedupe([...currentStandards, ...standards]);
    const metadata = { ...existing, standards: merged };

    const { error: updateError } = await supabase.from('lessons').update({ metadata }).eq('id', lesson.id as number);
    if (updateError) {
      throw new Error(`Failed to update lesson ${lesson.id as number} metadata: ${updateError.message}`);
    }
    updated += 1;
  }

  return updated;
};

const parseArgs = (): { file: string } => {
  const args = process.argv.slice(2);
  let file = DEFAULT_FILE;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--file' || arg === '--path') {
      const next = args[i + 1];
      if (!next) throw new Error(`Expected value after ${arg}`);
      file = path.resolve(process.cwd(), next);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { file };
};

const main = async (): Promise<void> => {
  const { file } = parseArgs();
  const mappings = (await loadModuleStandards(file)) as NormalizedEntry[];
  const entries = mappings.flatMap((record) => record.entries);
  if (entries.length === 0) {
    console.log(`No module standard mappings found in ${file}`);
    return;
  }

  const moduleSlugs = Array.from(new Set(entries.map((entry) => entry.moduleSlug)));
  const combos = Array.from(
    new Map(entries.map((entry) => [`${entry.framework}::${entry.code}`, entry])).values(),
  ).map((entry) => ({ framework: entry.framework, code: entry.code }));

  const supabase = createServiceRoleClient();

  const modules = new Map<string, { id: number; slug: string }>();
  for (const chunk of chunkArray(moduleSlugs, BATCH_SIZE)) {
    const { data, error } = await supabase.from('modules').select('id, slug').in('slug', chunk);
    if (error) {
      throw new Error(`Failed to resolve module slugs: ${error.message}`);
    }
    for (const record of data ?? []) {
      modules.set(record.slug as string, { id: record.id as number, slug: record.slug as string });
    }
  }

  for (const slug of moduleSlugs) {
    if (!modules.has(slug) && !modules.has(slug.trim())) {
      throw new Error(`Module "${slug}" not found in modules table.`);
    }
  }

  const standards = await fetchStandardIds(supabase, combos);

  const inserted = await upsertModuleStandards(supabase, mappings, standards, modules);

  const standardsByModuleId = new Map<number, string[]>();
  for (const entry of mappings) {
    const module = modules.get(entry.moduleSlug) ?? modules.get(entry.moduleSlug.trim());
    if (!module) continue;
    const list = standardsByModuleId.get(module.id) ?? [];
    for (const std of entry.entries) list.push(std.code);
    standardsByModuleId.set(module.id, dedupe(list));
  }

  const lessonsUpdated = await updateLessonMetadataStandards(
    supabase,
    Array.from(modules.values()).map((m) => m.id),
    standardsByModuleId,
  );

  console.log(
    `Linked ${inserted} module-standard pairs from ${file} and updated ${lessonsUpdated} lessons with standards metadata.`,
  );
};

const invokedFromCli =
  process.argv[1]?.includes('sync_module_standards.ts') || process.argv[1]?.includes('sync_module_standards.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
