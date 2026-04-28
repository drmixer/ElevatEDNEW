import type { DailyPlanBlockKind } from './homeschoolDailyPlan';
import type { ElaStrand } from './elaHomeschool';

export type ElaBlockContentInput = {
  blockKind: DailyPlanBlockKind;
  moduleSlug: string;
  moduleTitle?: string | null;
  strand?: string | null;
};

export type ElaBlockContent = {
  id: string;
  title: string;
  strand: ElaStrand;
  sourceType: 'authored_lesson' | 'deterministic_scaffold';
  contentKind: 'passage' | 'mini_lesson' | 'context_paragraph' | 'discussion_brief' | 'reflection_note';
  focus: string;
  body: string[];
  sourceLabel: string;
  parentSummary: string;
};

const ELA_STRANDS = new Set<ElaStrand>([
  'reading_literature',
  'reading_informational',
  'vocabulary',
  'writing_grammar',
  'speaking_listening',
]);

const titleCase = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ');

const slugLabel = (slug: string): string => {
  const parts = slug
    .split('-')
    .filter((part) => part && !/^\d+$/.test(part) && part !== 'english' && part !== 'language' && part !== 'arts');
  const useful = parts.slice(-4);
  return titleCase(useful.length ? useful.join(' ') : slug.replaceAll('-', ' '));
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

const contentKindFor = (
  blockKind: DailyPlanBlockKind,
  strand: ElaStrand,
): ElaBlockContent['contentKind'] => {
  if (blockKind === 'reflection') return 'reflection_note';
  if (strand === 'writing_grammar') return 'mini_lesson';
  if (strand === 'vocabulary') return 'context_paragraph';
  if (strand === 'speaking_listening') return 'discussion_brief';
  return 'passage';
};

const bodyFor = (
  blockKind: DailyPlanBlockKind,
  strand: ElaStrand,
  moduleTitle: string,
): string[] => {
  if (blockKind === 'reflection') {
    return [
      `Review the work from ${moduleTitle}. Notice one strategy that helped and one place where the answer still needs more precision.`,
      'A useful reflection names the skill, describes the evidence, and ends with a next question.',
    ];
  }

  if (blockKind === 'repair') {
    return [
      `${moduleTitle} repair starts by slowing down the answer. First, name the skill. Next, show one corrected example. Last, explain why the correction works.`,
      'The strongest repair answers are specific: they compare the old thinking with the corrected thinking.',
    ];
  }

  if (strand === 'reading_literature') {
    return [
      `In a short story about a difficult choice, the most important moment is often not the loudest event. A character may reveal a theme by what they notice, what they avoid, or what they finally decide to say.`,
      `For ${moduleTitle}, read for the detail that best explains a character's choice. Then connect that detail to a theme or lesson.`,
    ];
  }

  if (strand === 'reading_informational') {
    return [
      `A group of students studied how one local change affected their community. They noticed that a new walking path did more than connect two streets. It changed how people traveled, where neighbors met, and how safely younger children could move through the area.`,
      `For ${moduleTitle}, read for the author's main point. Strong informational answers name the point, cite one detail, and explain why that detail matters.`,
    ];
  }

  if (strand === 'vocabulary') {
    return [
      `In context, a word's meaning is shaped by nearby clues. If a scientist describes a result as consistent, nearby sentences may show that the result happened again and again in the same way.`,
      `For ${moduleTitle}, use surrounding words, examples, and contrast clues before writing your own sentence.`,
    ];
  }

  if (strand === 'writing_grammar') {
    return [
      `A clear paragraph usually starts with one controlling idea. The next sentences add evidence, examples, or explanation. Revision is the step where a writer removes repeated words, combines choppy sentences, and checks that every sentence supports the idea.`,
      `For ${moduleTitle}, draft first for meaning, then revise one sentence so the grammar or organization is stronger.`,
    ];
  }

  return [
    `A strong discussion response has a point, a detail, and a question. The point tells listeners what you think. The detail shows what your thinking is based on. The question keeps the conversation moving.`,
    `For ${moduleTitle}, prepare notes that are clear enough to say aloud or use in a short discussion.`,
  ];
};

const focusFor = (blockKind: DailyPlanBlockKind, strand: ElaStrand): string => {
  if (blockKind === 'repair') return 'repair the skill before moving forward';
  if (blockKind === 'diagnostic') return 'show the current starting point';
  if (strand === 'writing_grammar') return 'draft, revise, and explain the writing choice';
  if (strand === 'vocabulary') return 'use context to explain meaning';
  if (strand === 'speaking_listening') return 'prepare a clear discussion point';
  if (strand === 'reading_literature') return 'connect text evidence to a character, theme, or event';
  return 'identify the main idea or author point with evidence';
};

export const buildElaBlockContent = (input: ElaBlockContentInput): ElaBlockContent => {
  const strand = normalizeStrand(input.strand, input.moduleSlug);
  const moduleTitle = input.moduleTitle?.trim() || slugLabel(input.moduleSlug);
  const contentKind = contentKindFor(input.blockKind, strand);
  const id = ['ela-content', strand, input.blockKind, input.moduleSlug].join('::');

  return {
    id,
    title: `${moduleTitle} ${contentKind.replaceAll('_', ' ')}`,
    strand,
    sourceType: 'deterministic_scaffold',
    contentKind,
    focus: focusFor(input.blockKind, strand),
    body: bodyFor(input.blockKind, strand, moduleTitle),
    sourceLabel: 'ElevatED deterministic scaffold',
    parentSummary: `This content gives a short ${contentKind.replaceAll('_', ' ')} for ${strand.replaceAll('_', ' ')} practice.`,
  };
};
