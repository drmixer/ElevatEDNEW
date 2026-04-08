export const MIN_PLACEMENT_LEVEL = 0;
export const MAX_PLACEMENT_LEVEL = 8;
export const PHASE1_PLACEMENT_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

const clampPlacementLevel = (value: number): number =>
  Math.max(MIN_PLACEMENT_LEVEL, Math.min(MAX_PLACEMENT_LEVEL, Math.round(value)));

const parseGradeToken = (value: string): number | null => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed.length) return null;
  if (trimmed === 'k') return 0;
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizePlacementLevel = (
  value: string | number | null | undefined,
  fallback = 6,
): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampPlacementLevel(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return fallback;

    const exactLevel = parseGradeToken(trimmed);
    if (exactLevel != null) {
      return clampPlacementLevel(exactLevel);
    }

    const rangeMatch = trimmed.match(/^([a-z0-9]+)-([a-z0-9]+)$/);
    if (rangeMatch) {
      const start = parseGradeToken(rangeMatch[1] ?? '');
      const end = parseGradeToken(rangeMatch[2] ?? '');
      if (start != null && end != null) {
        return clampPlacementLevel((start + end) / 2);
      }
    }
  }

  return clampPlacementLevel(fallback);
};

export type PlacementSubjectKey = 'math' | 'ela' | 'science';

const SUBJECT_KEY_ALIASES: Record<string, PlacementSubjectKey> = {
  math: 'math',
  mathematics: 'math',
  ela: 'ela',
  english: 'ela',
  english_language_arts: 'ela',
  english_language_arts_: 'ela',
  science: 'science',
};

export const normalizePlacementSubjectKey = (value: string | null | undefined): PlacementSubjectKey | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return SUBJECT_KEY_ALIASES[normalized] ?? null;
};

export const parsePlacementSubjectList = (
  value: string | string[] | null | undefined,
  fallback: PlacementSubjectKey[] = ['math', 'ela'],
): PlacementSubjectKey[] => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const normalized = rawValues
    .map((entry) => normalizePlacementSubjectKey(entry))
    .filter((entry): entry is PlacementSubjectKey => entry !== null);

  if (normalized.length === 0) {
    return [...fallback];
  }

  return Array.from(new Set(normalized));
};

export const placementSubjectLabel = (subjectKey: PlacementSubjectKey): string => {
  switch (subjectKey) {
    case 'math':
      return 'Mathematics';
    case 'ela':
      return 'English Language Arts';
    case 'science':
      return 'Science';
  }
};

export const placementWindowForLevel = (level: number): { min_level: number; max_level: number } => ({
  min_level: Math.max(MIN_PLACEMENT_LEVEL, level - 1),
  max_level: Math.min(MAX_PLACEMENT_LEVEL, level + 1),
});

type FoundationalDiagnosticItem = {
  id: string;
  difficulty?: number;
  strand?: string;
  standard?: string;
};

export const buildFoundationalDiagnosticDifficultyMap = <T extends FoundationalDiagnosticItem>(
  items: T[],
  gradeBand: string | number | null | undefined,
): Map<string, number> => {
  const placementLevel = normalizePlacementLevel(gradeBand);
  if (placementLevel >= 3) {
    return new Map();
  }

  const authoredDifficulties = Array.from(
    new Set(
      items
        .map((item) => item.difficulty)
        .filter((difficulty): difficulty is number => typeof difficulty === 'number' && Number.isFinite(difficulty))
        .map((difficulty) => Math.round(difficulty)),
    ),
  );

  if (authoredDifficulties.length > 1) {
    return new Map();
  }

  const groups = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = [item.standard?.trim().toLowerCase(), item.strand?.trim().toLowerCase()].filter(Boolean).join('::') || '__all__';
    const group = groups.get(groupKey) ?? [];
    group.push(item);
    groups.set(groupKey, group);
  }

  const difficultyById = new Map<string, number>();
  for (const group of groups.values()) {
    const bucketCount = Math.min(3, Math.max(1, group.length));
    group.forEach((item, index) => {
      const difficulty = Math.min(3, Math.floor((index * bucketCount) / group.length) + 1);
      difficultyById.set(item.id, difficulty);
    });
  }

  return difficultyById;
};

export const standardsFromValue = (value: string | string[] | null | undefined): string[] => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .filter((entry): entry is string => typeof entry === 'string')
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    );
  }

  if (typeof value === 'string' && value.trim().length) {
    return [value.trim()];
  }

  return [];
};
