import type { LearningPathItem, Subject } from '../types';
import { normalizeSubject } from './subjects';

// @ts-expect-error bundler provides JSON import typing
import rawPaths from '../../data/curriculum/learning_paths_phase13.json';

type CanonicalSequenceEntry = {
  position: number;
  module_slug: string;
  module_title: string;
  strand?: string | null;
  standard_codes?: string[];
  metadata?: Record<string, unknown>;
};

type CanonicalPath = {
  grade_band: string;
  subject: string;
  sequence: CanonicalSequenceEntry[];
};

const canonicalPaths = (rawPaths as CanonicalPath[]) ?? [];

const SUBJECT_MAP: Record<string, Subject> = {
  math: 'math',
  ela: 'english',
  english: 'english',
  english_language_arts: 'english',
};

const normalizePathSubject = (subject: string | null | undefined): Subject | null => {
  if (!subject) return null;
  const normalized = subject.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const mapped = SUBJECT_MAP[normalized];
  if (mapped) return mapped;
  const viaNormalize = normalizeSubject(subject);
  return viaNormalize;
};

export const getCanonicalSequence = (
  grade: number | string | null | undefined,
  subject: Subject | null | undefined,
): CanonicalSequenceEntry[] => {
  const normalizedSubject = subject ? subject : null;
  if (!normalizedSubject) return [];
  const gradeKey = grade != null ? grade.toString() : null;

  const candidate =
    canonicalPaths.find(
      (entry) =>
        entry.grade_band === gradeKey &&
        normalizePathSubject(entry.subject) === normalizedSubject,
    ) ??
    canonicalPaths.find((entry) => normalizePathSubject(entry.subject) === normalizedSubject);

  return candidate?.sequence ?? [];
};

export const buildCanonicalLearningPath = (params: {
  grade: number | string | null | undefined;
  subject: Subject;
  preferredModules?: string[];
  limit?: number;
}): LearningPathItem[] => {
  const { grade, subject, preferredModules, limit } = params;
  const sequence = getCanonicalSequence(grade, subject);
  if (!sequence.length) return [];

  const preferred = new Set((preferredModules ?? []).map((slug) => slug.toLowerCase()));
  const ordered = sequence.slice().sort((a, b) => {
    const aPreferred = preferred.has(a.module_slug.toLowerCase()) ? 0 : 1;
    const bPreferred = preferred.has(b.module_slug.toLowerCase()) ? 0 : 1;
    if (aPreferred !== bPreferred) return aPreferred - bPreferred;
    return a.position - b.position;
  });

  const entries = limit && limit > 0 ? ordered.slice(0, limit) : ordered;

  return entries.map((entry) => ({
    id: entry.module_slug,
    moduleSlug: entry.module_slug,
    subject,
    topic: entry.module_title,
    concept: entry.strand ?? 'canonical_sequence',
    difficulty: 15,
    status: 'not_started',
    xpReward: 60,
    strand: entry.strand ?? undefined,
    standardCodes: entry.standard_codes ?? [],
  }));
};

export const canonicalPositionLookup = (
  grade: number | string | null | undefined,
  subject: Subject | null | undefined,
): Map<string, number> => {
  const sequence = getCanonicalSequence(grade, subject);
  const map = new Map<string, number>();
  sequence.forEach((entry) => {
    map.set(entry.module_slug, entry.position);
  });
  return map;
};
