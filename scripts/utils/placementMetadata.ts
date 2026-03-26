export const normalizePlacementLevel = (
  value: string | number | null | undefined,
  fallback = 6,
): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(3, Math.min(8, Math.round(value)));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return fallback;
    if (trimmed === 'k' || trimmed === 'k-2') return 3;

    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = Number.parseInt(rangeMatch[1] ?? '', 10);
      const end = Number.parseInt(rangeMatch[2] ?? '', 10);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        return Math.max(3, Math.min(8, Math.round((start + end) / 2)));
      }
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(3, Math.min(8, parsed));
    }
  }

  return fallback;
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

export const PHASE1_PLACEMENT_LEVELS = [3, 4, 5, 6, 7, 8] as const;

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
  min_level: Math.max(3, level - 1),
  max_level: Math.min(8, level + 1),
});

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
