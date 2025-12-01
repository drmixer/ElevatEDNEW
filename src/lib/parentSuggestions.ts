import type { ParentChildSnapshot, ParentCoachingSuggestion, Subject } from '../types';
import { parentSuggestionLibrary } from '../data/parentSuggestionLibrary';

const gradeBandFor = (grade: number | null | undefined): 'g3_5' | 'g6_8' | 'any' => {
  if (grade == null) return 'any';
  if (grade <= 5) return 'g3_5';
  if (grade <= 8) return 'g6_8';
  return 'any';
};

const hashSeed = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // keep 32-bit
  }
  return Math.abs(hash);
};

const pickSuggestions = (
  subject: Subject,
  gradeBand: 'g3_5' | 'g6_8' | 'any',
  count: number,
  seed: string,
  mastery: number | null | undefined,
): ParentCoachingSuggestion[] => {
  const candidates = parentSuggestionLibrary.filter(
    (entry) => entry.subject === subject && (entry.gradeBand === gradeBand || entry.gradeBand === 'any'),
  );

  const suggestions: ParentCoachingSuggestion[] = [];
  const random = hashSeed(seed);
  for (let i = 0; i < candidates.length && suggestions.length < count; i += 1) {
    const idx = (random + i) % candidates.length;
    const entry = candidates[idx];
    suggestions.push({
      id: entry.id,
      subject: entry.subject,
      action: entry.action,
      timeMinutes: entry.timeMinutes,
      why: entry.whyTemplate({ mastery, concept: null }),
      source: 'library',
    });
  }

  return suggestions;
};

export const buildCoachingSuggestions = (
  child: ParentChildSnapshot,
  opts?: { max?: number; seed?: string; excludeIds?: Set<string> },
): ParentCoachingSuggestion[] => {
  const max = opts?.max ?? 4;
  const seed = opts?.seed ?? new Date().toISOString().slice(0, 10);
  const excludeIds = opts?.excludeIds ?? new Set<string>();
  const gradeBand = gradeBandFor(child.grade);
  const weakestSubject =
    child.masteryBySubject?.slice()?.sort((a, b) => a.mastery - b.mastery)?.[0]?.subject ?? 'math';
  const weakestMastery =
    child.masteryBySubject?.slice()?.sort((a, b) => a.mastery - b.mastery)?.[0]?.mastery ?? null;

  const primary = pickSuggestions(weakestSubject, gradeBand, max, `${child.id}-${seed}`, weakestMastery).filter(
    (item) => !excludeIds.has(item.id),
  );
  if (primary.length >= max) return primary.slice(0, max);

  const fallbackSubject: Subject = weakestSubject === 'math' ? 'english' : 'math';
  const secondary = pickSuggestions(
    fallbackSubject,
    gradeBand,
    max - primary.length,
    `${child.id}-${seed}-fallback`,
    weakestMastery,
  ).filter((item) => !excludeIds.has(item.id));

  const combined = [...primary, ...secondary];
  return combined.length
    ? combined.slice(0, max)
    : [
        {
          id: `fallback-${child.id}`,
          subject: weakestSubject,
          action: 'Ask them to explain one thing they learned today in their own words.',
          timeMinutes: 5,
          why: 'Explaining builds confidence and reveals gaps.',
          source: 'fallback',
        },
      ];
};
