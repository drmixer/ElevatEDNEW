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
const CORE_PLANNER_SUBJECTS: Subject[] = ['math', 'english'];
const CONTEXTUAL_SUPPORT_SUBJECTS: Subject[] = ['science', 'social_studies'];

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
    pathSource: 'subject_placement',
  }));
};

export type SubjectPlacementSnapshot = {
  subject: Subject;
  expectedLevel?: number | null;
  workingLevel?: number | null;
  preferredModules?: string[];
};

const buildSubjectWeight = (placement?: SubjectPlacementSnapshot | null): number => {
  if (!placement) return 1;
  if (placement.expectedLevel == null || placement.workingLevel == null) return 1;
  return placement.expectedLevel - placement.workingLevel >= 2 ? 2 : 1;
};

const parseNumericGrade = (grade: number | string | null | undefined): number | null => {
  if (typeof grade === 'number' && Number.isFinite(grade)) return grade;
  if (typeof grade === 'string' && grade.trim().length) {
    const parsed = Number.parseInt(grade.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const annotateCrossSubjectAccess = (
  entries: LearningPathItem[],
  nominalGrade: number,
  accessibilityLevel: number | null,
): LearningPathItem[] =>
  entries.map((entry) => ({
    ...entry,
    pathSource: 'cross_subject_access',
    concept: 'cross_subject_access',
    accessibilityLevel: accessibilityLevel ?? undefined,
    themeGrade: nominalGrade,
  }));

export const buildBlendedLearningPath = (params: {
  nominalGrade: number | string | null | undefined;
  placements?: SubjectPlacementSnapshot[];
  limit?: number;
}): LearningPathItem[] => {
  const { nominalGrade, placements = [], limit = 8 } = params;
  const placementMap = new Map<Subject, SubjectPlacementSnapshot>();
  placements.forEach((placement) => {
    if (CORE_PLANNER_SUBJECTS.includes(placement.subject) || CONTEXTUAL_SUPPORT_SUBJECTS.includes(placement.subject)) {
      placementMap.set(placement.subject, placement);
    }
  });

  const nominalGradeNumber = parseNumericGrade(nominalGrade);
  const englishPlacement = placementMap.get('english');
  const englishWorkingLevel = englishPlacement?.workingLevel ?? null;

  const queues = CORE_PLANNER_SUBJECTS.map((subject) => {
    const placement = placementMap.get(subject);
    const targetGrade = placement?.workingLevel ?? nominalGrade;
    if (targetGrade == null) return { subject, weight: 0, entries: [] as LearningPathItem[] };
    return {
      subject,
      weight: buildSubjectWeight(placement),
      entries: buildCanonicalLearningPath({
        grade: targetGrade,
        subject,
        preferredModules: placement?.preferredModules,
        limit: Math.max(limit * 2, 8),
      }),
    };
  });

  if (nominalGradeNumber != null) {
    CONTEXTUAL_SUPPORT_SUBJECTS.forEach((subject) => {
      const sequence = getCanonicalSequence(nominalGradeNumber, subject);
      if (!sequence.length) return;
      queues.push({
        subject,
        weight: 1,
        entries: annotateCrossSubjectAccess(
          buildCanonicalLearningPath({
            grade: nominalGradeNumber,
            subject,
            preferredModules: placementMap.get(subject)?.preferredModules,
            limit: Math.max(limit, 4),
          }),
          nominalGradeNumber,
          englishWorkingLevel,
        ),
      });
    });
  }

  const viableQueues = queues.filter((queue) => queue.entries.length > 0);

  if (!viableQueues.length) return [];

  const cursors = new Map<Subject, number>();
  viableQueues.forEach((queue) => cursors.set(queue.subject, 0));

  const result: LearningPathItem[] = [];
  while (result.length < limit) {
    let added = false;
    for (const queue of viableQueues) {
      for (let slot = 0; slot < queue.weight && result.length < limit; slot += 1) {
        const cursor = cursors.get(queue.subject) ?? 0;
        const next = queue.entries[cursor];
        if (!next) break;
        result.push(next);
        cursors.set(queue.subject, cursor + 1);
        added = true;
      }
    }
    if (!added) break;
  }

  return result;
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
