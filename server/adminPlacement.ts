import type { SupabaseClient } from '@supabase/supabase-js';

type AttemptMetadata = Record<string, unknown> | null | undefined;
type PathMetadata = Record<string, unknown> | null | undefined;
type EntryMetadata = Record<string, unknown> | null | undefined;

export type CatPlacementReviewGap = {
  standardCode: string;
  observedLevel: number | null;
  confidence: number | null;
};

export type CatPlacementReviewAnchor = {
  reviewModuleSlug: string | null;
  reviewModuleTitle: string | null;
  gapStandardCode: string | null;
  previousModuleSlug: string | null;
  nextModuleSlug: string | null;
};

export type CatPlacementReviewAttempt = {
  attemptId: number;
  assessmentId: number | null;
  attemptNumber: number;
  studentId: string;
  studentName: string | null;
  gradeLevel: number | null;
  subject: string | null;
  gradeBand: string | null;
  status: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  expectedLevel: number | null;
  workingLevel: number | null;
  diagnosticConfidence: number | null;
  confidenceLow: number | null;
  confidenceHigh: number | null;
  coverageFallbackUsed: boolean;
  lowConfidence: boolean;
  terminationReason: string | null;
  prerequisiteGaps: CatPlacementReviewGap[];
  testedLevels: Array<{ level: number; correct: number; total: number; accuracyPct: number }>;
  pathId: number | null;
  reviewAnchors: CatPlacementReviewAnchor[];
};

const CAT_V2_ENGINE_VERSION = 'cat_v2';

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const readInteger = (value: unknown): number | null => {
  const parsed = readNumber(value);
  return parsed == null ? null : Math.round(parsed);
};

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length ? value.trim() : null;

const readGapList = (value: unknown): CatPlacementReviewGap[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = entry as Record<string, unknown> | null;
      const standardCode = readString(record?.standardCode ?? record?.standard_code ?? null);
      if (!standardCode) return null;
      return {
        standardCode,
        observedLevel: readInteger(record?.observedLevel ?? record?.observed_level ?? null),
        confidence: readNumber(record?.confidence ?? null),
      } satisfies CatPlacementReviewGap;
    })
    .filter((entry): entry is CatPlacementReviewGap => Boolean(entry));
};

const readTestedLevels = (
  value: unknown,
): Array<{ level: number; correct: number; total: number; accuracyPct: number }> => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = entry as Record<string, unknown> | null;
      const level = readInteger(record?.level);
      const correct = readInteger(record?.correct);
      const total = readInteger(record?.total);
      const accuracyPct = readInteger(record?.accuracyPct ?? record?.accuracy_pct);
      if (level == null || correct == null || total == null || accuracyPct == null) return null;
      return { level, correct, total, accuracyPct };
    })
    .filter((entry): entry is { level: number; correct: number; total: number; accuracyPct: number } => Boolean(entry));
};

const isCatAttempt = (metadata: AttemptMetadata): boolean =>
  readString(metadata?.diagnostic_version)?.toLowerCase() === CAT_V2_ENGINE_VERSION;

const buildStudentName = (row: Record<string, unknown> | null | undefined): string | null => {
  const first = readString(row?.first_name) ?? '';
  const last = readString(row?.last_name) ?? '';
  const full = `${first} ${last}`.trim();
  return full || null;
};

const extractReviewAnchors = (
  entries: Array<{
    type: string | null;
    target_standard_codes: string[] | null;
    metadata: EntryMetadata;
  }>,
): CatPlacementReviewAnchor[] =>
  entries
    .map((entry, index) => {
      const reason = readString(entry.metadata?.reason);
      if (entry.type !== 'review' && reason !== 'remediation') {
        return null;
      }
      const previous = entries[index - 1] ?? null;
      const next = entries[index + 1] ?? null;
      return {
        reviewModuleSlug: readString(entry.metadata?.module_slug),
        reviewModuleTitle: readString(entry.metadata?.module_title),
        gapStandardCode:
          readString(entry.metadata?.gap_standard_code) ??
          (Array.isArray(entry.target_standard_codes) && typeof entry.target_standard_codes[0] === 'string'
            ? entry.target_standard_codes[0]
            : null),
        previousModuleSlug: readString(previous?.metadata?.module_slug),
        nextModuleSlug: readString(next?.metadata?.module_slug),
      } satisfies CatPlacementReviewAnchor;
    })
    .filter((entry): entry is CatPlacementReviewAnchor => Boolean(entry));

export const listRecentCatPlacementAttempts = async (
  supabase: SupabaseClient,
  options?: { limit?: number },
): Promise<CatPlacementReviewAttempt[]> => {
  const requestedLimit =
    typeof options?.limit === 'number' && Number.isFinite(options.limit) ? Math.max(1, Math.min(25, options.limit)) : 8;

  const { data: attemptRows, error: attemptError } = await supabase
    .from('student_assessment_attempts')
    .select('id, student_id, assessment_id, attempt_number, status, updated_at, completed_at, metadata')
    .order('updated_at', { ascending: false })
    .limit(Math.max(20, requestedLimit * 5));

  if (attemptError) {
    throw new Error(`Unable to load placement attempts: ${attemptError.message}`);
  }

  const catAttempts = ((attemptRows ?? []) as Array<Record<string, unknown>>)
    .filter((row) => isCatAttempt(row.metadata as AttemptMetadata))
    .slice(0, requestedLimit);

  if (!catAttempts.length) {
    return [];
  }

  const studentIds = Array.from(
    new Set(catAttempts.map((row) => readString(row.student_id)).filter((value): value is string => Boolean(value))),
  );

  const [profileResult, pathResult] = await Promise.all([
    studentIds.length
      ? supabase.from('student_profiles').select('id, first_name, last_name, grade_level').in('id', studentIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase
          .from('student_paths')
          .select('id, student_id, metadata, created_at')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profileResult.error) {
    throw new Error(`Unable to load student profiles for CAT review: ${profileResult.error.message}`);
  }
  if (pathResult.error) {
    throw new Error(`Unable to load student paths for CAT review: ${pathResult.error.message}`);
  }

  const profileById = new Map<string, Record<string, unknown>>();
  ((profileResult.data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    const id = readString(row.id);
    if (id) profileById.set(id, row);
  });

  const chosenPathByAttemptId = new Map<number, { id: number; metadata: PathMetadata }>();
  ((pathResult.data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    const pathId = readInteger(row.id);
    const attemptId = readInteger((row.metadata as PathMetadata)?.attempt_id);
    if (pathId == null || attemptId == null || chosenPathByAttemptId.has(attemptId)) {
      return;
    }
    chosenPathByAttemptId.set(attemptId, { id: pathId, metadata: row.metadata as PathMetadata });
  });

  const pathIds = Array.from(new Set(Array.from(chosenPathByAttemptId.values()).map((row) => row.id)));
  const { data: entryRows, error: entryError } = pathIds.length
    ? await supabase
        .from('student_path_entries')
        .select('path_id, position, type, target_standard_codes, metadata')
        .in('path_id', pathIds)
        .order('path_id', { ascending: true })
        .order('position', { ascending: true })
    : { data: [], error: null };

  if (entryError) {
    throw new Error(`Unable to load CAT review path entries: ${entryError.message}`);
  }

  const entriesByPathId = new Map<
    number,
    Array<{
      type: string | null;
      target_standard_codes: string[] | null;
      metadata: EntryMetadata;
    }>
  >();
  ((entryRows ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    const pathId = readInteger(row.path_id);
    if (pathId == null) return;
    const list = entriesByPathId.get(pathId) ?? [];
    list.push({
      type: readString(row.type),
      target_standard_codes: Array.isArray(row.target_standard_codes) ? (row.target_standard_codes as string[]) : null,
      metadata: (row.metadata as EntryMetadata) ?? null,
    });
    entriesByPathId.set(pathId, list);
  });

  return catAttempts.map((row) => {
    const metadata = (row.metadata as AttemptMetadata) ?? null;
    const studentId = readString(row.student_id) ?? '';
    const profile = profileById.get(studentId) ?? null;
    const attemptId = readInteger(row.id) ?? 0;
    const matchedPath = chosenPathByAttemptId.get(attemptId) ?? null;
    const matchedEntries = matchedPath ? entriesByPathId.get(matchedPath.id) ?? [] : [];

    return {
      attemptId,
      assessmentId: readInteger(row.assessment_id),
      attemptNumber: readInteger(row.attempt_number) ?? 1,
      studentId,
      studentName: buildStudentName(profile),
      gradeLevel: readInteger(profile?.grade_level),
      subject: readString(metadata?.subject),
      gradeBand: readString(metadata?.grade_band),
      status: readString(row.status),
      updatedAt: readString(row.updated_at),
      completedAt: readString(row.completed_at),
      expectedLevel: readInteger(metadata?.expected_level),
      workingLevel: readInteger(metadata?.working_level),
      diagnosticConfidence: readNumber(metadata?.level_confidence),
      confidenceLow: readNumber(metadata?.confidence_low),
      confidenceHigh: readNumber(metadata?.confidence_high),
      coverageFallbackUsed: metadata?.coverage_fallback_used === true,
      lowConfidence:
        metadata?.confidence_low == null || metadata?.confidence_high == null
          ? false
          : readNumber(metadata?.level_confidence) != null && readNumber(metadata?.level_confidence)! < 0.6,
      terminationReason: readString(metadata?.termination_reason),
      prerequisiteGaps: readGapList(metadata?.prerequisite_gaps),
      testedLevels: readTestedLevels(metadata?.tested_levels),
      pathId: matchedPath?.id ?? null,
      reviewAnchors: extractReviewAnchors(matchedEntries),
    } satisfies CatPlacementReviewAttempt;
  });
};
