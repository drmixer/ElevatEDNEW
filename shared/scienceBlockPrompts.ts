import type { DailyPlanBlockKind } from './homeschoolDailyPlan';
import type { ScienceStrand } from './scienceHomeschool';

export type ScienceBlockPrompt = {
  id: string;
  responseKind: string;
  promptText: string;
  checklist: string[];
  parentPurpose: string;
};

const strandLabel = (strand?: string): string => {
  if (strand === 'life_science') return 'life science';
  if (strand === 'physical_science') return 'physical science';
  if (strand === 'engineering_practices') return 'science and engineering practices';
  return 'earth and space science';
};

const promptType = (blockKind: DailyPlanBlockKind): string => {
  if (blockKind === 'diagnostic') return 'science_starting_check';
  if (blockKind === 'repair') return 'science_repair_cer';
  if (blockKind === 'reflection') return 'science_reflection';
  if (blockKind === 'guided_practice' || blockKind === 'independent_practice') return 'science_cer';
  return 'science_explanation';
};

export const buildScienceBlockPrompt = (input: {
  blockKind: DailyPlanBlockKind;
  moduleSlug: string;
  strand?: ScienceStrand | string;
}): ScienceBlockPrompt => {
  const label = input.moduleSlug
    .split('-')
    .filter((part) => !/^\d+$/.test(part) && part !== 'science')
    .slice(-5)
    .join(' ');
  const type = promptType(input.blockKind);
  const strand = strandLabel(input.strand);

  if (input.blockKind === 'reflection') {
    return {
      id: `${type}:${input.moduleSlug}`,
      responseKind: type,
      promptText: `Reflect on ${label}. What evidence helped most, and what question do you still have?`,
      checklist: [
        'Name the evidence that helped most',
        'Explain what the evidence showed',
        'Ask one next science question',
      ],
      parentPurpose: `This captures whether the student can connect evidence to the ${strand} idea after the block.`,
    };
  }

  if (input.blockKind === 'repair') {
    return {
      id: `${type}:${input.moduleSlug}`,
      responseKind: type,
      promptText: `Repair your explanation for ${label}. Write one claim, one piece of evidence, and reasoning that connects them.`,
      checklist: [
        'State a clear claim',
        'Use one observation, data point, or model feature',
        'Explain why the evidence supports the claim',
      ],
      parentPurpose: `This repair prompt checks whether the student can rebuild the ${strand} idea with evidence.`,
    };
  }

  if (input.blockKind === 'diagnostic') {
    return {
      id: `${type}:${input.moduleSlug}`,
      responseKind: type,
      promptText: `Show your starting point for ${label}. Write what you think is happening, what evidence supports it, and what feels uncertain.`,
      checklist: [
        'State what you think is happening',
        'Use one observation or data point',
        'Name one uncertainty',
      ],
      parentPurpose: `This short diagnostic shows the student's current ${strand} explanation habits.`,
    };
  }

  return {
    id: `${type}:${input.moduleSlug}`,
    responseKind: type,
    promptText: `Write a short science explanation for ${label}. Include a claim, evidence, and reasoning.`,
    checklist: [
      'State a claim',
      'Use evidence from the phenomenon, data, or model',
      'Explain how the evidence supports the claim',
    ],
    parentPurpose: `This creates a parent-reviewable science work sample for the current ${strand} module.`,
  };
};
