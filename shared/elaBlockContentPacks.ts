import type { ElaBlockContent } from './elaBlockContent';
import type { ElaStrand } from './elaHomeschool';
import type { DailyPlanBlockKind } from './homeschoolDailyPlan';

export const ELA_GRADE_3_CONTENT_PACK_MODULES = new Set([
  '3-english-language-arts-reading-informational-biographies-pd',
  '3-english-language-arts-reading-informational-nonfiction-articles-open-licensed',
  '3-english-language-arts-reading-literature-chapter-books-pd',
  '3-english-language-arts-reading-literature-myths-legends-pd',
  '3-english-language-arts-reading-literature-short-stories-pd',
]);

type ElaContentPackKind =
  | 'diagnostic'
  | 'mini_lesson'
  | 'repair'
  | 'evidence_practice'
  | 'reflection';

type ElaContentPackInput = {
  blockKind: DailyPlanBlockKind;
  moduleSlug: string;
  moduleTitle?: string | null;
  strand: ElaStrand;
};

const moduleLabel = (slug: string, title?: string | null): string =>
  title?.trim() ||
  slug
    .split('-')
    .filter((part) => part && !/^\d+$/.test(part) && part !== 'english' && part !== 'language' && part !== 'arts')
    .slice(-4)
    .join(' ');

const packKindForBlock = (blockKind: DailyPlanBlockKind): ElaContentPackKind | null => {
  if (blockKind === 'diagnostic') return 'diagnostic';
  if (blockKind === 'lesson') return 'mini_lesson';
  if (blockKind === 'repair') return 'repair';
  if (blockKind === 'guided_practice' || blockKind === 'independent_practice') return 'evidence_practice';
  if (blockKind === 'reflection' || blockKind === 'exit_ticket') return 'reflection';
  return null;
};

const contentKindForPack = (
  packKind: ElaContentPackKind,
  strand: ElaStrand,
): ElaBlockContent['contentKind'] => {
  if (packKind === 'reflection') return 'reflection_note';
  if (strand === 'writing_grammar') return 'mini_lesson';
  if (strand === 'vocabulary') return 'context_paragraph';
  if (strand === 'speaking_listening') return 'discussion_brief';
  return 'passage';
};

const focusForPack = (packKind: ElaContentPackKind, strand: ElaStrand): string => {
  if (packKind === 'diagnostic') return 'show the current starting point';
  if (packKind === 'repair') return 'repair the skill before moving forward';
  if (packKind === 'reflection') return 'explain what improved and what still needs attention';
  if (strand === 'reading_literature') return 'connect text evidence to a character, theme, or event';
  if (strand === 'reading_informational') return 'identify the main idea or author point with evidence';
  if (strand === 'vocabulary') return 'use context and word parts to explain meaning';
  if (strand === 'writing_grammar') return 'draft, revise, and explain the writing choice';
  return 'prepare a clear discussion point with evidence';
};

const readingLiteratureBody = (packKind: ElaContentPackKind, title: string): string[] => {
  if (packKind === 'diagnostic') {
    return [
      `Read this short scene for ${title}: Mina planned to keep the last seed packet for herself, but she saw the empty class garden bed and handed the packet to her teacher.`,
      'Write one claim about Mina. Use one action from the scene as evidence, then explain what the action reveals about her character.',
    ];
  }
  if (packKind === 'repair') {
    return [
      `Repair ${title} by separating evidence from opinion. Evidence is what the text actually shows. Opinion is what the reader thinks before proving it.`,
      'Try this frame: The character seems ___ because the text says ___. That detail proves the claim because ___.',
    ];
  }
  if (packKind === 'reflection') {
    return [
      `Reflect on ${title}. Name the evidence you chose, then decide whether it directly proves your claim or only sounds related.`,
      'A stronger next response will explain the link between the detail and the character, theme, or event in one extra sentence.',
    ];
  }
  return [
    `In ${title}, strong readers track what changes. A character may change what they do, what they understand, or what they are willing to say out loud.`,
    'Write a short evidence paragraph with a claim, one exact story detail, and an explanation of how that detail proves the claim.',
  ];
};

const readingInformationalBody = (packKind: ElaContentPackKind, title: string): string[] => {
  if (packKind === 'diagnostic') {
    return [
      `Read this short informational passage for ${title}: City volunteers painted crosswalks near the library because families had reported that cars turned too quickly after school.`,
      'Write the main idea. Then choose one detail and explain how it supports that main idea.',
    ];
  }
  if (packKind === 'repair') {
    return [
      `Repair ${title} by checking whether the detail proves the main idea. A detail is useful when it explains what, why, or how the author wants readers to understand the topic.`,
      'Try this frame: The main idea is ___. The detail ___ supports it because ___.',
    ];
  }
  if (packKind === 'reflection') {
    return [
      `Reflect on ${title}. Decide whether your answer named the author's point or only copied a fact from the passage.`,
      'A stronger next response will state the point first, then explain why the chosen detail matters.',
    ];
  }
  return [
    `For ${title}, read once for the topic and reread for the author's point. The topic is what the passage is about. The main idea is what the author wants readers to understand about that topic.`,
    'Write a claim, cite one concrete detail, and add a because sentence that explains how the detail supports the claim.',
  ];
};

const bodyForPack = (
  packKind: ElaContentPackKind,
  strand: ElaStrand,
  title: string,
): string[] => {
  if (strand === 'reading_literature') return readingLiteratureBody(packKind, title);
  if (strand === 'reading_informational') return readingInformationalBody(packKind, title);

  if (packKind === 'repair') {
    return [
      `Repair ${title} by slowing down the answer. Name the skill, show one corrected example, and explain why the correction works.`,
      'The corrected answer should be specific enough that a parent can see the old thinking and the improved thinking.',
    ];
  }

  if (packKind === 'reflection') {
    return [
      `Reflect on ${title}. Name one strategy that helped and one place where the answer still needs more precision.`,
      'End with a next question or revision target so tomorrow has a clear starting point.',
    ];
  }

  return [
    `For ${title}, read or draft with a clear job in mind: make a claim, choose evidence, and explain the connection.`,
    'A complete response should answer the prompt, use a relevant detail, and include one sentence that explains the reasoning.',
  ];
};

export const findElaBlockContentPack = (input: ElaContentPackInput): ElaBlockContent | null => {
  if (!ELA_GRADE_3_CONTENT_PACK_MODULES.has(input.moduleSlug)) return null;

  const packKind = packKindForBlock(input.blockKind);
  if (!packKind) return null;

  const title = moduleLabel(input.moduleSlug, input.moduleTitle);
  const contentKind = contentKindForPack(packKind, input.strand);

  return {
    id: `ela-content-pack::${input.moduleSlug}::${packKind}`,
    title: `${title} ${packKind.replaceAll('_', ' ')}`,
    strand: input.strand,
    sourceType: 'authored_lesson',
    contentKind,
    focus: focusForPack(packKind, input.strand),
    body: bodyForPack(packKind, input.strand, title),
    sourceLabel: 'ElevatED authored ELA content pack',
    parentSummary: `This authored ${packKind.replaceAll('_', ' ')} pack gives a short, parent-reviewable ${contentKind.replaceAll('_', ' ')} for ${title}.`,
  };
};
