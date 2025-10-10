import process from 'node:process';

import { createServiceRoleClient } from './utils/supabase.js';

type ModuleRecord = {
  id: number;
  slug: string;
  title: string | null;
};

type LessonRecord = {
  id: number;
  module_id: number | null;
};

type AssetRecord = {
  id: number;
  module_id: number | null;
};

const fetchModules = async () => {
  const supabase = createServiceRoleClient();
  const [{ data: modules, error: moduleError }, { data: lessons, error: lessonError }, { data: assets, error: assetError }] =
    await Promise.all([
      supabase.from('modules').select('id, slug, title'),
      supabase.from('lessons').select('id, module_id'),
      supabase.from('assets').select('id, module_id'),
    ]);

  if (moduleError) {
    throw new Error(`Failed to fetch modules: ${moduleError.message}`);
  }
  if (lessonError) {
    throw new Error(`Failed to fetch lessons: ${lessonError.message}`);
  }
  if (assetError) {
    throw new Error(`Failed to fetch assets: ${assetError.message}`);
  }

  return {
    modules: (modules ?? []) as ModuleRecord[],
    lessons: (lessons ?? []) as LessonRecord[],
    assets: (assets ?? []) as AssetRecord[],
  };
};

const summarize = (modules: ModuleRecord[], lessons: LessonRecord[], assets: AssetRecord[]) => {
  const lessonCounts = new Map<number, number>();
  const assetCounts = new Map<number, number>();

  for (const lesson of lessons) {
    if (lesson.module_id != null) {
      lessonCounts.set(lesson.module_id, (lessonCounts.get(lesson.module_id) ?? 0) + 1);
    }
  }

  for (const asset of assets) {
    if (asset.module_id != null) {
      assetCounts.set(asset.module_id, (assetCounts.get(asset.module_id) ?? 0) + 1);
    }
  }

  const missingLessons: ModuleRecord[] = [];
  const missingAssets: ModuleRecord[] = [];

  for (const module of modules) {
    if ((lessonCounts.get(module.id) ?? 0) === 0) {
      missingLessons.push(module);
    }
    if ((assetCounts.get(module.id) ?? 0) === 0) {
      missingAssets.push(module);
    }
  }

  return { missingLessons, missingAssets };
};

const printReport = (label: string, modules: ModuleRecord[]) => {
  console.log(`\n${label} (${modules.length})`);
  if (modules.length === 0) {
    console.log('  None');
    return;
  }
  for (const module of modules) {
    console.log(`  - ${module.slug}${module.title ? ` (${module.title})` : ''}`);
  }
};

const main = async () => {
  const { modules, lessons, assets } = await fetchModules();
  if (modules.length === 0) {
    console.log('No modules have been imported yet.');
    return;
  }

  const { missingLessons, missingAssets } = summarize(modules, lessons, assets);

  console.log(`Audited ${modules.length} modules.`);
  printReport('Modules missing lessons', missingLessons);
  printReport('Modules missing assets', missingAssets);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
