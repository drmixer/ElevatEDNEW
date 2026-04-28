import type { DailyPlanBlockKind } from './homeschoolDailyPlan';
import type { ElaStrand } from './elaHomeschool';

export type ElaBlockPromptInput = {
  blockKind: DailyPlanBlockKind;
  moduleSlug: string;
  moduleTitle?: string | null;
  strand?: string | null;
};

export type ElaBlockPrompt = {
  id: string;
  strand: ElaStrand;
  responseKind: string;
  promptText: string;
  checklist: string[];
  parentPurpose: string;
};

const ELA_STRANDS = new Set<ElaStrand>([
  'reading_literature',
  'reading_informational',
  'vocabulary',
  'writing_grammar',
  'speaking_listening',
]);

const slugLabel = (slug: string): string => {
  const parts = slug
    .split('-')
    .filter((part) => part && !/^\d+$/.test(part) && part !== 'english' && part !== 'language' && part !== 'arts');
  const useful = parts.slice(-4);
  return useful.length ? useful.join(' ') : slug.replaceAll('-', ' ');
};

const normalizeStrand = (strand: string | null | undefined, slug: string): ElaStrand => {
  if (strand && ELA_STRANDS.has(strand as ElaStrand)) return strand as ElaStrand;
  const normalized = `${strand ?? ''} ${slug}`.toLowerCase();
  if (normalized.includes('literature')) return 'reading_literature';
  if (normalized.includes('vocabulary')) return 'vocabulary';
  if (normalized.includes('writing') || normalized.includes('grammar')) return 'writing_grammar';
  if (normalized.includes('speaking') || normalized.includes('listening') || normalized.includes('discussion')) {
    return 'speaking_listening';
  }
  return 'reading_informational';
};

const responseKindFor = (blockKind: DailyPlanBlockKind, strand: ElaStrand): string => {
  if (blockKind === 'reflection') return 'reflection';
  if (blockKind === 'diagnostic') return 'ela_starting_check';
  if (strand === 'writing_grammar') return 'writing_response';
  if (strand === 'speaking_listening') return 'discussion_notes';
  if (strand === 'vocabulary') return 'vocabulary_response';
  return 'evidence_response';
};

const promptFor = (blockKind: DailyPlanBlockKind, strand: ElaStrand, moduleLabel: string): string => {
  if (blockKind === 'reflection') {
    return `What became clearer in ${moduleLabel}, and what question should come next?`;
  }
  if (blockKind === 'repair') {
    return `Repair ${moduleLabel}: explain the skill in your own words, then answer with one example that shows the repair.`;
  }
  if (blockKind === 'diagnostic') {
    return `Show your starting point for ${moduleLabel}: write a short answer that includes what you understand and what feels uncertain.`;
  }

  if (strand === 'reading_literature') {
    return `For ${moduleLabel}, make a claim about a character, theme, or event, then support it with evidence from the text.`;
  }
  if (strand === 'reading_informational') {
    return `For ${moduleLabel}, state the main idea or author's point, then support it with evidence and explanation.`;
  }
  if (strand === 'vocabulary') {
    return `For ${moduleLabel}, explain the target word or phrase in context, then use it correctly in a new sentence.`;
  }
  if (strand === 'writing_grammar') {
    return `For ${moduleLabel}, draft or revise a short paragraph that uses the target writing or grammar skill.`;
  }
  return `For ${moduleLabel}, prepare a clear discussion response with one point, one detail, and one follow-up question.`;
};

const checklistFor = (blockKind: DailyPlanBlockKind, strand: ElaStrand): string[] => {
  if (blockKind === 'reflection') {
    return ['Name one thing that became clearer', 'Name one next question', 'Use a complete sentence'];
  }
  if (blockKind === 'repair') {
    return ['Restate the skill', 'Show one corrected example', 'Explain what changed'];
  }
  if (strand === 'writing_grammar') {
    return ['Write a clear topic sentence', 'Use the target writing or grammar skill', 'Revise one sentence'];
  }
  if (strand === 'vocabulary') {
    return ['Explain meaning in context', 'Use the word or phrase correctly', 'Check that the sentence makes sense'];
  }
  if (strand === 'speaking_listening') {
    return ['State one point clearly', 'Use one supporting detail', 'Add one question for discussion'];
  }
  return ['State a claim or main idea', 'Use text evidence or a concrete detail', 'Explain how the evidence supports the answer'];
};

export const buildElaBlockPrompt = (input: ElaBlockPromptInput): ElaBlockPrompt => {
  const strand = normalizeStrand(input.strand, input.moduleSlug);
  const moduleLabel = input.moduleTitle?.trim() || slugLabel(input.moduleSlug);
  const responseKind = responseKindFor(input.blockKind, strand);
  const id = [
    'ela',
    strand,
    input.blockKind,
    input.moduleSlug,
  ].join('::');

  return {
    id,
    strand,
    responseKind,
    promptText: promptFor(input.blockKind, strand, moduleLabel),
    checklist: checklistFor(input.blockKind, strand),
    parentPurpose: `This prompt checks ${strand.replaceAll('_', ' ')} through a ${input.blockKind.replaceAll('_', ' ')} response.`,
  };
};
