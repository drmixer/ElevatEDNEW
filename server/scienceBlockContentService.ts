import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildScienceBlockContent,
  type ScienceBlockContent,
} from '../shared/scienceBlockContent.js';
import type { DailyPlanBlock } from '../shared/homeschoolDailyPlan.js';
import type { ScienceStrand } from '../shared/scienceHomeschool.js';
import {
  fetchStudentScienceDailyPlan,
  loadScienceModuleMap,
} from './scienceHomeschoolPlans.js';

type ModuleRow = {
  title?: string | null;
  slug?: string | null;
  strand?: string | null;
};

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const SCIENCE_STRANDS = new Set<ScienceStrand>([
  'earth_space',
  'life_science',
  'physical_science',
  'engineering_practices',
]);

const readScienceStrand = (value: unknown): ScienceStrand | undefined => {
  const text = readString(value);
  return text && SCIENCE_STRANDS.has(text as ScienceStrand) ? (text as ScienceStrand) : undefined;
};

const fetchModule = async (supabase: SupabaseClient, moduleSlug: string): Promise<ModuleRow | null> => {
  const result = await supabase
    .from('modules')
    .select('title, slug, strand')
    .eq('slug', moduleSlug)
    .maybeSingle();

  if (result.error) return null;
  return (result.data ?? null) as ModuleRow | null;
};

const inferStrand = (block: DailyPlanBlock, module: ModuleRow | null): ScienceStrand | undefined => {
  const fromModule = readScienceStrand(module?.strand);
  if (fromModule) return fromModule;
  return loadScienceModuleMap().modules.find((entry) => entry.slug === block.moduleSlug)?.strand;
};

export const resolveScienceBlockContent = async (
  supabase: SupabaseClient,
  block: DailyPlanBlock,
): Promise<ScienceBlockContent> => {
  const module = await fetchModule(supabase, block.moduleSlug);
  const strand = inferStrand(block, module);
  return buildScienceBlockContent({
    blockKind: block.kind,
    moduleSlug: block.moduleSlug,
    moduleTitle: module?.title ?? loadScienceModuleMap().modules.find((entry) => entry.slug === block.moduleSlug)?.title,
    strand,
  });
};

export const fetchStudentScienceBlockContent = async (
  supabase: SupabaseClient,
  studentId: string,
  blockId: string,
  options: { date?: string } = {},
): Promise<{ block: DailyPlanBlock; content: ScienceBlockContent } | null> => {
  const plan = await fetchStudentScienceDailyPlan(supabase, studentId, { date: options.date });
  const decodedBlockId = decodeURIComponent(blockId);
  const block = plan.blocks.find((item) => item.id === decodedBlockId);
  if (!block) return null;
  return {
    block,
    content: await resolveScienceBlockContent(supabase, block),
  };
};
