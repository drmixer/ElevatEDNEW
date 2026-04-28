import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildElaBlockContent,
  type ElaBlockContent,
} from '../shared/elaBlockContent.js';
import type { DailyPlanBlock, DailyPlanBlockKind } from '../shared/homeschoolDailyPlan.js';
import type { ElaStrand } from '../shared/elaHomeschool.js';
import {
  fetchStudentElaDailyPlan,
} from './elaHomeschoolPlans.js';

type ModuleRow = {
  id: number;
  slug: string;
  title: string | null;
  subject?: string | null;
  strand?: string | null;
  topic?: string | null;
};

type LessonRow = {
  id: number;
  title: string | null;
  slug?: string | null;
  content: string | null;
  estimated_duration_minutes?: number | string | null;
  attribution_block?: string | null;
  open_track?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

export type ElaBlockContentResolution = {
  block: DailyPlanBlock;
  content: ElaBlockContent;
};

const ELA_STRANDS = new Set<ElaStrand>([
  'reading_literature',
  'reading_informational',
  'vocabulary',
  'writing_grammar',
  'speaking_listening',
]);

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const readElaStrand = (value: unknown): ElaStrand | null => {
  const text = readString(value);
  return text && ELA_STRANDS.has(text as ElaStrand) ? (text as ElaStrand) : null;
};

const inferStrand = (block: DailyPlanBlock, module: ModuleRow | null): ElaStrand => {
  const explicit = readElaStrand(module?.strand);
  if (explicit) return explicit;
  const normalized = `${module?.strand ?? ''} ${module?.topic ?? ''} ${block.moduleSlug}`.toLowerCase();
  if (normalized.includes('literature')) return 'reading_literature';
  if (normalized.includes('vocabulary')) return 'vocabulary';
  if (normalized.includes('writing') || normalized.includes('grammar')) return 'writing_grammar';
  if (normalized.includes('speaking') || normalized.includes('listening')) return 'speaking_listening';
  return 'reading_informational';
};

const stripMarkdown = (value: string): string =>
  value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>~-]/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();

const lessonParagraphs = (content: string | null | undefined): string[] => {
  if (!content) return [];
  const cleaned = stripMarkdown(content);
  return cleaned
    .split(/\n{2,}|(?<=\.)\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 40)
    .slice(0, 3);
};

const normalizeSearchText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const metadataText = (metadata: Record<string, unknown> | null | undefined): string =>
  metadata ? normalizeSearchText(JSON.stringify(metadata)) : '';

const lessonSearchText = (lesson: LessonRow): string =>
  normalizeSearchText(`${lesson.slug ?? ''} ${lesson.title ?? ''} ${metadataText(lesson.metadata)}`);

const contentSearchText = (lesson: LessonRow): string =>
  normalizeSearchText(lesson.content ?? '');

const termsForBlock = (blockKind: DailyPlanBlockKind): string[] => {
  if (blockKind === 'repair') return ['repair', 'review', 'reteach', 'correct', 'correction', 'fix'];
  if (blockKind === 'diagnostic') return ['diagnostic', 'check', 'pretest', 'pre test', 'starting', 'warmup'];
  if (blockKind === 'reflection') return ['reflection', 'reflect', 'wrap', 'summary', 'debrief'];
  if (blockKind === 'independent_practice') return ['independent', 'practice', 'write', 'draft', 'revise'];
  if (blockKind === 'guided_practice') return ['guided', 'practice', 'evidence', 'response'];
  if (blockKind === 'exit_ticket') return ['exit', 'ticket', 'check'];
  if (blockKind === 'warmup') return ['warmup', 'warm up', 'review'];
  if (blockKind === 'challenge') return ['challenge', 'extend', 'extension'];
  return ['launch', 'lesson', 'intro', 'mini'];
};

const genericLaunchTerms = ['launch', 'intro', 'introduction', 'lesson', 'mini'];

const tokenizeModuleTerms = (block: DailyPlanBlock, module: ModuleRow | null): string[] => {
  const text = normalizeSearchText(`${block.moduleSlug} ${module?.title ?? ''} ${module?.topic ?? ''}`);
  const blocked = new Set(['and', 'arts', 'ela', 'english', 'grade', 'language', 'open', 'licensed']);
  return Array.from(new Set(text.split(' ')))
    .filter((term) => term.length >= 4 && !/^\d+$/.test(term) && !blocked.has(term))
    .slice(0, 8);
};

type LessonRank = {
  blockKindScore: number;
  moduleScore: number;
  contentScore: number;
  fallbackScore: number;
  score: number;
};

const countTermHits = (text: string, terms: string[]): number =>
  terms.reduce((count, term) => count + (text.includes(normalizeSearchText(term)) ? 1 : 0), 0);

const lessonRank = (
  lesson: LessonRow,
  block: DailyPlanBlock,
  module: ModuleRow | null,
): LessonRank => {
  const searchable = lessonSearchText(lesson);
  const content = contentSearchText(lesson);
  const blockTerms = termsForBlock(block.kind);
  const moduleTerms = tokenizeModuleTerms(block, module);

  const titleSlugMetadataHits = countTermHits(searchable, blockTerms);
  const contentHits = countTermHits(content, blockTerms);
  const moduleHits = countTermHits(searchable, moduleTerms);
  const fallbackHits = countTermHits(searchable, genericLaunchTerms);

  const blockKindScore = titleSlugMetadataHits * 40;
  const moduleScore = Math.min(moduleHits, 4) * 8;
  const contentScore = Math.min(contentHits, 2) * 4;
  const fallbackScore = block.kind === 'lesson' || block.kind === 'diagnostic'
    ? Math.min(fallbackHits, 2) * 4
    : -Math.min(fallbackHits, 2) * 4;

  return {
    blockKindScore,
    moduleScore,
    contentScore,
    fallbackScore,
    score: blockKindScore + moduleScore + contentScore + fallbackScore,
  };
};

const selectLesson = (
  lessons: LessonRow[],
  block: DailyPlanBlock,
  module: ModuleRow | null,
): LessonRow | null =>
  lessons
    .filter((lesson) => lessonParagraphs(lesson.content).length > 0)
    .sort((a, b) => {
      const aRank = lessonRank(a, block, module);
      const bRank = lessonRank(b, block, module);
      return bRank.score - aRank.score || a.id - b.id;
    })[0] ?? null;

const contentKindForBlock = (
  blockKind: DailyPlanBlockKind,
  strand: ElaStrand,
): ElaBlockContent['contentKind'] => {
  if (blockKind === 'reflection') return 'reflection_note';
  if (strand === 'writing_grammar') return 'mini_lesson';
  if (strand === 'vocabulary') return 'context_paragraph';
  if (strand === 'speaking_listening') return 'discussion_brief';
  return 'passage';
};

const focusForBlock = (block: DailyPlanBlock, strand: ElaStrand): string => {
  if (block.kind === 'repair') return 'repair the skill before moving forward';
  if (block.kind === 'diagnostic') return 'show the current starting point';
  if (strand === 'writing_grammar') return 'draft, revise, and explain the writing choice';
  if (strand === 'vocabulary') return 'use context to explain meaning';
  if (strand === 'speaking_listening') return 'prepare a clear discussion point';
  if (strand === 'reading_literature') return 'connect text evidence to a character, theme, or event';
  return 'identify the main idea or author point with evidence';
};

const fallbackContent = (block: DailyPlanBlock, moduleTitle?: string | null, strand?: ElaStrand): ElaBlockContent =>
  buildElaBlockContent({
    blockKind: block.kind,
    moduleSlug: block.moduleSlug,
    moduleTitle,
    strand,
  });

const fetchModule = async (supabase: SupabaseClient, moduleSlug: string): Promise<ModuleRow | null> => {
  const result = await supabase
    .from('modules')
    .select('id, slug, title, subject, strand, topic')
    .eq('slug', moduleSlug)
    .eq('visibility', 'public')
    .maybeSingle();

  if (result.error) {
    throw new Error(`Failed to load ELA module content: ${result.error.message}`);
  }

  return (result.data ?? null) as ModuleRow | null;
};

const fetchLessons = async (supabase: SupabaseClient, moduleId: number): Promise<LessonRow[]> => {
  const result = await supabase
    .from('lessons')
    .select('id, title, slug, content, estimated_duration_minutes, attribution_block, open_track, metadata')
    .eq('module_id', moduleId)
    .eq('visibility', 'public')
    .order('id', { ascending: true })
    .limit(12);

  if (result.error) {
    throw new Error(`Failed to load ELA lesson content: ${result.error.message}`);
  }

  return (result.data ?? []) as LessonRow[];
};

export const resolveElaBlockContent = async (
  supabase: SupabaseClient,
  block: DailyPlanBlock,
): Promise<ElaBlockContent> => {
  const module = await fetchModule(supabase, block.moduleSlug);
  const strand = inferStrand(block, module);

  if (!module) {
    return fallbackContent(block, null, strand);
  }

  const lessons = await fetchLessons(supabase, module.id);
  const lesson = selectLesson(lessons, block, module);
  if (!lesson) {
    return fallbackContent(block, module.title, strand);
  }

  const body = lessonParagraphs(lesson.content);
  return {
    id: `ela-authored-lesson::${lesson.id}::${block.id}`,
    title: lesson.title ?? module.title ?? block.title,
    strand,
    sourceType: 'authored_lesson',
    contentKind: contentKindForBlock(block.kind, strand),
    focus: focusForBlock(block, strand),
    body,
    sourceLabel: lesson.attribution_block?.trim() || 'ElevatED authored lesson',
    parentSummary: `This content comes from authored lesson ${lesson.title ?? lesson.id} for the ${block.kind.replaceAll('_', ' ')} block in ${module.title ?? block.moduleSlug}.`,
  };
};

export const fetchStudentElaBlockContent = async (
  supabase: SupabaseClient,
  studentId: string,
  blockId: string,
  options: { date?: string } = {},
): Promise<ElaBlockContentResolution | null> => {
  const plan = await fetchStudentElaDailyPlan(supabase, studentId, { date: options.date });
  const block = plan.blocks.find((entry) => entry.id === blockId);
  if (!block) return null;

  const content = await resolveElaBlockContent(supabase, block);
  return { block, content };
};
