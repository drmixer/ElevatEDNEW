type AssessmentRow = {
  id: number;
  module_id: number | null;
  created_at?: string | null;
  metadata: Record<string, unknown> | null;
};

type PlacementSelectionOptions = {
  targetGradeBand: string;
  goalFocus?: string | null;
};

const normalizeKey = (value: string): string => value.trim().toLowerCase().replace(/[\s-]+/g, '_');

const canonicalizeSubjectKey = (value: string): string => {
  const normalized = normalizeKey(value);
  if (normalized === 'english' || normalized === 'english_language_arts') return 'ela';
  if (normalized === 'cs') return 'computer_science';
  return normalized;
};

const resolveFocusSubjectKey = (focus?: string | null): string | null => {
  if (!focus || !focus.trim().length) return null;
  const normalized = canonicalizeSubjectKey(focus);
  const allowed = new Set(['math', 'ela', 'science', 'social_studies', 'computer_science']);
  return allowed.has(normalized) ? normalized : null;
};

const getString = (metadata: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const raw = metadata[key];
    if (typeof raw === 'string' && raw.trim().length) return raw;
  }
  return null;
};

const getStringList = (metadata: Record<string, unknown>, key: string): string[] => {
  const raw = metadata[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.trim().length);
};

export const selectPlacementAssessmentId = (rows: AssessmentRow[], options: PlacementSelectionOptions): number | null => {
  const coreOrder = ['math', 'ela', 'science'];
  const coreSet = new Set(coreOrder);
  const targetBandNormalized = options.targetGradeBand.toLowerCase();
  const desiredSubjectKey = resolveFocusSubjectKey(options.goalFocus);

  const gradeBandMatches = (targetBand: string, metadataBand: string): boolean => {
    const target = targetBand.trim().toLowerCase();
    const meta = metadataBand.trim().toLowerCase();
    if (!meta.length) return true;
    if (meta === target) return true;

    const bandMap: Record<string, string[]> = {
      'k-2': ['k', '1', '2', 'k-2'],
      '3-5': ['3', '4', '5', '3-5'],
      '6-8': ['6', '7', '8', '6-8'],
      '9-12': ['9', '10', '11', '12', '9-12'],
    };

    const allowed = bandMap[target];
    if (allowed) {
      return allowed.includes(meta);
    }

    // Numeric grade target (rare): accept if metadata is the same numeric grade.
    return meta === target;
  };

  const candidates = rows
    .filter((row) => row.module_id == null)
    .map((row) => {
      const metadata = row.metadata;
      if (!metadata) return null;
      const purposeRaw = getString(metadata, ['purpose', 'type', 'kind']) ?? '';
      const purpose = normalizeKey(purposeRaw);
      if (purpose === 'baseline') return null;
      if (purpose !== 'placement' && purpose !== 'diagnostic') return null;

      const bandRaw = getString(metadata, ['grade_band', 'gradeBand', 'grade']);
      if (bandRaw && !gradeBandMatches(targetBandNormalized, bandRaw)) return null;

      const subjectKeyRaw = getString(metadata, ['subject_key', 'subjectKey']);
      const subjectKey = subjectKeyRaw ? canonicalizeSubjectKey(subjectKeyRaw) : null;
      const subjectList = getStringList(metadata, 'subjects').map(canonicalizeSubjectKey);

      return {
        id: row.id,
        purpose: purpose as 'placement' | 'diagnostic',
        subjectKey,
        subjects: subjectList,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const placements = candidates.filter((row) => row.purpose === 'placement');
  const diagnostics = candidates.filter((row) => row.purpose === 'diagnostic');

  const pickBySubject = (list: typeof candidates, subjectKey: string): number | null => {
    const direct = list.find((row) => row.subjectKey === subjectKey);
    if (direct) return direct.id;
    const mixed = list.find((row) => row.subjects.includes(subjectKey));
    return mixed?.id ?? null;
  };

  const pickCore = (list: typeof candidates): number | null => {
    for (const key of coreOrder) {
      const match = pickBySubject(list, key);
      if (match) return match;
    }
    const mixedCore = list.find((row) => row.subjectKey == null && row.subjects.some((key) => coreSet.has(key)));
    return mixedCore?.id ?? null;
  };

  if (desiredSubjectKey) {
    return pickBySubject(placements, desiredSubjectKey) ?? pickBySubject(diagnostics, desiredSubjectKey) ?? null;
  }

  return pickCore(placements) ?? pickCore(diagnostics) ?? placements[0]?.id ?? diagnostics[0]?.id ?? null;
};
