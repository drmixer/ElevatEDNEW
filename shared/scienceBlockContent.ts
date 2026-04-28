import type { DailyPlanBlockKind } from './homeschoolDailyPlan';
import type { ScienceStrand } from './scienceHomeschool';

export type ScienceBlockContent = {
  id: string;
  title: string;
  contentKind: 'phenomenon' | 'data_table' | 'model_prompt' | 'reflection_note';
  sourceType: 'authored_lesson' | 'deterministic_scaffold';
  sourceLabel: string;
  focus: string;
  body: string[];
};

const titleFromSlug = (slug: string): string =>
  slug
    .split('-')
    .filter((part) => !/^\d+$/.test(part) && part !== 'science')
    .slice(-5)
    .join(' ');

const kindForBlock = (blockKind: DailyPlanBlockKind): ScienceBlockContent['contentKind'] => {
  if (blockKind === 'reflection') return 'reflection_note';
  if (blockKind === 'guided_practice' || blockKind === 'independent_practice') return 'data_table';
  if (blockKind === 'repair') return 'model_prompt';
  return 'phenomenon';
};

const focusForBlock = (blockKind: DailyPlanBlockKind): string => {
  if (blockKind === 'diagnostic') return 'show current science explanation habits';
  if (blockKind === 'repair') return 'repair the claim-evidence-reasoning connection';
  if (blockKind === 'reflection') return 'reflect on evidence and remaining questions';
  if (blockKind === 'guided_practice' || blockKind === 'independent_practice') return 'write a CER response from evidence';
  return 'connect a phenomenon to the target science idea';
};

const strandPhenomenon = (strand?: ScienceStrand | string): string => {
  if (strand === 'life_science') {
    return 'A plant kept near a sunny window grew taller and darker green than a plant kept in a dim hallway.';
  }
  if (strand === 'physical_science') {
    return 'Two toy cars rolled down the same ramp, but the heavier car traveled farther before stopping.';
  }
  if (strand === 'engineering_practices') {
    return 'Two paper bridges held different numbers of coins even though they used the same amount of paper.';
  }
  return 'After a heavy rain, water flowed quickly over packed dirt but soaked into loose soil near the garden.';
};

const strandEvidence = (strand?: ScienceStrand | string): string => {
  if (strand === 'life_science') {
    return 'Observation table: sunny plant - 18 cm, dark green leaves; dim plant - 11 cm, pale leaves.';
  }
  if (strand === 'physical_science') {
    return 'Data table: light car - 82 cm; heavier car - 126 cm when released from the same ramp height.';
  }
  if (strand === 'engineering_practices') {
    return 'Test notes: flat bridge held 4 coins; folded bridge held 17 coins before bending.';
  }
  return 'Observation notes: packed dirt had runoff in 2 minutes; loose soil absorbed water for 6 minutes.';
};

export const buildScienceBlockContent = (input: {
  blockKind: DailyPlanBlockKind;
  moduleSlug: string;
  moduleTitle?: string | null;
  strand?: ScienceStrand | string;
}): ScienceBlockContent => {
  const title = input.moduleTitle ?? titleFromSlug(input.moduleSlug);
  const contentKind = kindForBlock(input.blockKind);
  const body = [
    `Phenomenon for ${title}: ${strandPhenomenon(input.strand)}`,
    strandEvidence(input.strand),
    'Write a short explanation. Your answer should make a claim, use the evidence, and explain the science reasoning that connects them.',
  ];

  return {
    id: ['science-content', input.strand ?? 'science', input.blockKind, input.moduleSlug].join('::'),
    title: `${title} science evidence block`,
    contentKind,
    sourceType: 'deterministic_scaffold',
    sourceLabel: 'ElevatED deterministic science scaffold',
    focus: focusForBlock(input.blockKind),
    body,
  };
};
