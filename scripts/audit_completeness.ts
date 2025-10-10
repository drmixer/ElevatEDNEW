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
  visibility: string | null;
};

type AssetRecord = {
  id: number;
  module_id: number | null;
};

type AssessmentRecord = {
  id: number;
  module_id: number | null;
};

type ModuleStandardRecord = {
  id: number;
  module_id: number;
  standard_id: number;
};

const fetchModules = async () => {
  const supabase = createServiceRoleClient();
  const [
    { data: modules, error: moduleError },
    { data: lessons, error: lessonError },
    { data: assets, error: assetError },
    { data: assessments, error: assessmentError },
    { data: moduleStandards, error: moduleStandardError },
  ] =
    await Promise.all([
      supabase.from('modules').select('id, slug, title'),
      supabase.from('lessons').select('id, module_id, visibility'),
      supabase.from('assets').select('id, module_id'),
      supabase
        .from('assessments')
        .select('id, module_id')
        .contains('metadata', { purpose: 'baseline' }),
      supabase.from('module_standards').select('id, module_id, standard_id'),
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
  if (assessmentError) {
    throw new Error(`Failed to fetch assessments: ${assessmentError.message}`);
  }
  if (moduleStandardError) {
    throw new Error(`Failed to fetch module standards: ${moduleStandardError.message}`);
  }

  return {
    modules: (modules ?? []) as ModuleRecord[],
    lessons: (lessons ?? []) as LessonRecord[],
    assets: (assets ?? []) as AssetRecord[],
    assessments: (assessments ?? []) as AssessmentRecord[],
    moduleStandards: (moduleStandards ?? []) as ModuleStandardRecord[],
  };
};

const summarize = (
  modules: ModuleRecord[],
  lessons: LessonRecord[],
  assets: AssetRecord[],
  assessments: AssessmentRecord[],
  moduleStandards: ModuleStandardRecord[],
) => {
  const lessonCounts = new Map<number, { total: number; public: number }>();
  const assetCounts = new Map<number, number>();
  const orphanLessons: LessonRecord[] = [];
  const baselineAssessments = new Set<number>();
  const standardCounts = new Map<number, number>();

  for (const lesson of lessons) {
    if (lesson.module_id != null) {
      const counts = lessonCounts.get(lesson.module_id) ?? { total: 0, public: 0 };
      counts.total += 1;
      if ((lesson.visibility ?? '').toLowerCase() === 'public') {
        counts.public += 1;
      }
      lessonCounts.set(lesson.module_id, counts);
    } else {
      orphanLessons.push(lesson);
    }
  }

  for (const asset of assets) {
    if (asset.module_id != null) {
      assetCounts.set(asset.module_id, (assetCounts.get(asset.module_id) ?? 0) + 1);
    }
  }

  for (const assessment of assessments) {
    if (assessment.module_id != null) {
      baselineAssessments.add(assessment.module_id);
    }
  }

  for (const entry of moduleStandards) {
    standardCounts.set(entry.module_id, (standardCounts.get(entry.module_id) ?? 0) + 1);
  }

  const missingLessons: ModuleRecord[] = [];
  const missingPublicLessons: ModuleRecord[] = [];
  const missingAssets: ModuleRecord[] = [];
  const missingBaselines: ModuleRecord[] = [];
  const missingStandards: ModuleRecord[] = [];

  for (const module of modules) {
    const lessonSummary = lessonCounts.get(module.id) ?? { total: 0, public: 0 };
    if (lessonSummary.total === 0) {
      missingLessons.push(module);
    }
    if (lessonSummary.public === 0) {
      missingPublicLessons.push(module);
    }
    if ((assetCounts.get(module.id) ?? 0) === 0) {
      missingAssets.push(module);
    }
    if (!baselineAssessments.has(module.id)) {
      missingBaselines.push(module);
    }
    if ((standardCounts.get(module.id) ?? 0) === 0) {
      missingStandards.push(module);
    }
  }

  return {
    missingLessons,
    missingPublicLessons,
    missingAssets,
    missingBaselines,
    missingStandards,
    orphanLessons,
  };
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
  const { modules, lessons, assets, assessments, moduleStandards } = await fetchModules();
  if (modules.length === 0) {
    console.log('No modules have been imported yet.');
    return;
  }

  const {
    missingLessons,
    missingPublicLessons,
    missingAssets,
    missingBaselines,
    missingStandards,
    orphanLessons,
  } = summarize(modules, lessons, assets, assessments, moduleStandards);

  console.log(`Audited ${modules.length} modules.`);
  printReport('Modules missing lessons', missingLessons);
  printReport('Modules missing published lessons', missingPublicLessons);
  printReport('Modules missing assets', missingAssets);
  printReport('Modules missing baseline assessments', missingBaselines);
  printReport('Modules missing standards alignment', missingStandards);

  console.log(`\nUnlinked lessons (${orphanLessons.length})`);
  if (orphanLessons.length === 0) {
    console.log('  None');
  } else {
    for (const lesson of orphanLessons) {
      console.log(`  - Lesson ${lesson.id} has no module linkage.`);
    }
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
