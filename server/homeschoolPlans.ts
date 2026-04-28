import fs from 'node:fs';
import path from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildMathDailyPlan,
  type DailyHomeschoolPlan,
} from '../shared/homeschoolDailyPlan.js';
import {
  MATH_MASTERY_SCORE_THRESHOLD,
  MATH_WEAK_SCORE_THRESHOLD,
} from '../shared/mathAdaptivePolicy.js';
import {
  findMathAdaptiveVariantById,
  type MathAdaptiveVariant,
  type MathAdaptiveVariantCatalog,
} from '../shared/mathAdaptiveVariants.js';
import type {
  MathAdaptiveStrand,
  MathEvidence,
  MathPrerequisiteMap,
  MathRotationHistoryEntry,
  MathStrandRotationReason,
  MathStrandState,
} from '../shared/mathAdaptivePolicy.js';
import type {
  MathAdaptiveVariantResultSummary,
  MathParentPreferenceSummary,
  MathRotationHistorySummary,
  MathSubjectStateSummary,
  MathWeeklyRecordModuleSummary,
  MathWeeklyRecordSummary,
} from '../shared/mathSubjectStateSummary.js';

type StudentSubjectStateRow = {
  subject: string;
  expected_level?: number | null;
  placement_status?: string | null;
  working_level: number | null;
  level_confidence: number | null;
  strand_scores: Record<string, unknown> | null;
  weak_standard_codes: string[] | null;
  recommended_module_slugs: string[] | null;
  metadata: Record<string, unknown> | null;
};

type StudentProgressModuleRow = {
  status: string | null;
  mastery_pct: number | string | null;
  attempts: number | null;
  last_activity_at: string | null;
  lessons:
    | {
        id: number;
        module_id: number | null;
        modules:
          | {
              slug: string | null;
              subject: string | null;
            }
          | null;
      }
    | null;
};

type StudentProgressWeeklyRow = {
  status: string | null;
  mastery_pct: number | string | null;
  last_activity_at: string | null;
  lessons:
    | {
        title: string | null;
        estimated_duration_minutes: number | string | null;
        modules:
          | {
              title: string | null;
              slug: string | null;
              subject: string | null;
            }
          | null;
      }
    | null;
};

const DEFAULT_MATH_MAP_PATH = path.resolve(
  process.cwd(),
  'data/curriculum/math_3_8_prerequisite_map.json',
);
const DEFAULT_MATH_VARIANTS_PATH = path.resolve(
  process.cwd(),
  'data/curriculum/math_adaptive_variants_3_8.json',
);

const ADAPTIVE_STRANDS = new Set<MathAdaptiveStrand>([
  'place_value_operations',
  'fractions_decimals',
  'ratios_rates_percent',
  'expressions_equations_functions',
  'geometry_measurement',
  'data_probability_statistics',
  'problem_solving_modeling',
]);

let cachedMathMap: MathPrerequisiteMap | null = null;
let cachedMathVariants: MathAdaptiveVariantCatalog | null = null;

export const loadMathPrerequisiteMap = (mapPath = DEFAULT_MATH_MAP_PATH): MathPrerequisiteMap => {
  if (mapPath === DEFAULT_MATH_MAP_PATH && cachedMathMap) return cachedMathMap;
  const parsed = JSON.parse(fs.readFileSync(mapPath, 'utf8')) as MathPrerequisiteMap;
  if (!Array.isArray(parsed.modules)) {
    throw new Error(`Math prerequisite map at ${mapPath} is missing modules.`);
  }
  if (mapPath === DEFAULT_MATH_MAP_PATH) cachedMathMap = parsed;
  return parsed;
};

export const loadMathAdaptiveVariantCatalog = (
  variantsPath = DEFAULT_MATH_VARIANTS_PATH,
): MathAdaptiveVariantCatalog => {
  if (variantsPath === DEFAULT_MATH_VARIANTS_PATH && cachedMathVariants) return cachedMathVariants;
  const parsed = JSON.parse(fs.readFileSync(variantsPath, 'utf8')) as MathAdaptiveVariantCatalog;
  if (!Array.isArray(parsed.variants)) {
    throw new Error(`Math adaptive variant catalog at ${variantsPath} is missing variants.`);
  }
  if (variantsPath === DEFAULT_MATH_VARIANTS_PATH) cachedMathVariants = parsed;
  return parsed;
};

export const fetchMathAdaptiveVariant = (
  variantId: string,
  catalog: MathAdaptiveVariantCatalog = loadMathAdaptiveVariantCatalog(),
): MathAdaptiveVariant | null => findMathAdaptiveVariantById(catalog, variantId);

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];

const readNumber = (value: unknown): number | undefined => {
  const numberValue = typeof value === 'string' ? Number(value) : value;
  return typeof numberValue === 'number' && Number.isFinite(numberValue) ? numberValue : undefined;
};

const readAdaptiveStrand = (value: unknown): MathAdaptiveStrand | null => {
  const text = readString(value);
  return text && ADAPTIVE_STRANDS.has(text as MathAdaptiveStrand) ? (text as MathAdaptiveStrand) : null;
};

const ROTATION_REASONS = new Set<MathStrandRotationReason>([
  'explicit_target_strand',
  'parent_preferred_strand',
  'weak_strand_repair',
  'strong_mastery_due_strand',
  'continue_current_strand',
  'default_foundation_strand',
]);

const readRotationReason = (value: unknown): MathStrandRotationReason | null => {
  const text = readString(value);
  return text && ROTATION_REASONS.has(text as MathStrandRotationReason) ? (text as MathStrandRotationReason) : null;
};

const readRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const mapSubjectState = (row: StudentSubjectStateRow | null): MathStrandState[] => {
  if (!row) return [];

  const metadata = readRecord(row.metadata);
  const strandScores = readRecord(row.strand_scores);
  const explicitStates = readStringArray(metadata.strand_state_keys).flatMap((key) => {
    const state = readRecord(strandScores[key]);
    const adaptiveStrand = readAdaptiveStrand(state.adaptive_strand ?? key);
    if (!adaptiveStrand) return [];
    return [
      {
        adaptiveStrand,
        currentModuleSlug: readString(state.current_module_slug ?? state.currentModuleSlug) ?? undefined,
        workingGrade: readNumber(state.working_grade ?? state.workingGrade),
        confidence: readNumber(state.confidence),
        masteredModuleSlugs: readStringArray(state.mastered_module_slugs ?? state.masteredModuleSlugs),
        weakModuleSlugs: readStringArray(state.weak_module_slugs ?? state.weakModuleSlugs),
      } satisfies MathStrandState,
    ];
  });

  if (explicitStates.length > 0) return explicitStates;

  const targetStrand = readAdaptiveStrand(metadata.target_strand ?? metadata.targetStrand) ?? 'place_value_operations';
  const recommended = row.recommended_module_slugs ?? [];
  return [
    {
      adaptiveStrand: targetStrand,
      currentModuleSlug:
        readString(metadata.current_module_slug ?? metadata.currentModuleSlug) ?? recommended[0] ?? undefined,
      workingGrade: row.working_level ?? readNumber(metadata.working_grade ?? metadata.workingGrade),
      confidence: row.level_confidence ?? readNumber(metadata.confidence),
      masteredModuleSlugs: readStringArray(metadata.mastered_module_slugs ?? metadata.masteredModuleSlugs),
      weakModuleSlugs: [
        ...readStringArray(metadata.weak_module_slugs ?? metadata.weakModuleSlugs),
        ...readStringArray(row.weak_standard_codes),
      ],
    },
  ];
};

const mapSubjectStateEvidence = (row: StudentSubjectStateRow | null): MathEvidence[] => {
  if (!row) return [];
  const metadata = readRecord(row.metadata);
  const evidence = Array.isArray(metadata.recent_math_evidence) ? metadata.recent_math_evidence : [];
  return evidence.flatMap((item) => {
    const record = readRecord(item);
    const moduleSlug = readString(record.moduleSlug ?? record.module_slug);
    const scorePct = readNumber(record.scorePct ?? record.score_pct);
    if (!moduleSlug || scorePct == null) return [];
    return [
      {
        moduleSlug,
        scorePct,
        completedAt: readString(record.completedAt ?? record.completed_at) ?? undefined,
      },
    ];
  });
};

const moduleTitle = (mathMap: MathPrerequisiteMap, slug: string | null | undefined): string | undefined =>
  slug ? mathMap.modules.find((entry) => entry.slug === slug)?.title : undefined;

const mapRotationHistory = (value: unknown): MathRotationHistoryEntry[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const record = readRecord(item);
        const date = readString(record.date);
        const targetStrand = readAdaptiveStrand(record.target_strand ?? record.targetStrand);
        const assignedModuleSlug = readString(record.assigned_module_slug ?? record.assignedModuleSlug);
        const rotationReason = readRotationReason(record.rotation_reason ?? record.rotationReason);
        if (!date || !targetStrand || !assignedModuleSlug || !rotationReason) return [];
        const score = readNumber(record.score);
        const outcome = readString(record.outcome);
        return [
          {
            date,
            targetStrand,
            assignedModuleSlug,
            rotationReason,
            completedModuleSlug: readString(record.completed_module_slug ?? record.completedModuleSlug) ?? undefined,
            score,
            outcome: outcome === 'mastered' || outcome === 'practice' || outcome === 'weak' ? outcome : undefined,
            parentSummary: readString(record.parent_summary ?? record.parentSummary) ?? undefined,
          } satisfies MathRotationHistoryEntry,
        ];
      })
    : [];

const mapRotationHistorySummary = (
  value: unknown,
  mathMap: MathPrerequisiteMap,
): MathRotationHistorySummary[] =>
  mapRotationHistory(value).map((item) => ({
    ...item,
    assignedModuleTitle: moduleTitle(mathMap, item.assignedModuleSlug),
    completedModuleTitle: moduleTitle(mathMap, item.completedModuleSlug),
  }));

const mapMathParentPreference = (value: unknown): MathParentPreferenceSummary | null => {
  const record = readRecord(value);
  if (Object.keys(record).length === 0) return null;
  return {
    preferredStrand: readAdaptiveStrand(record.preferred_strand ?? record.preferredStrand),
    weekStart: readString(record.week_start ?? record.weekStart),
    updatedAt: readString(record.updated_at ?? record.updatedAt),
    updatedBy: readString(record.updated_by ?? record.updatedBy),
  };
};

const mapLastVariantResult = (
  value: unknown,
  mathMap: MathPrerequisiteMap,
): MathAdaptiveVariantResultSummary | null => {
  const record = readRecord(value);
  const adaptiveVariantId = readString(record.adaptive_variant_id);
  const moduleSlug = readString(record.module_slug);
  const nextModuleSlug = readString(record.next_module_slug);
  const adaptiveStrand = readAdaptiveStrand(record.adaptive_strand);
  const score = readNumber(record.score);
  const completedAt = readString(record.completed_at);
  const outcome = readString(record.outcome);
  const reasonCode = readString(record.reason_code);
  const parentSummary = readString(record.parent_summary);
  if (
    !adaptiveVariantId ||
    !moduleSlug ||
    !nextModuleSlug ||
    !adaptiveStrand ||
    score == null ||
    !completedAt ||
    (outcome !== 'mastered' && outcome !== 'practice' && outcome !== 'weak') ||
    !reasonCode ||
    !parentSummary
  ) {
    return null;
  }

  return {
    adaptiveVariantId,
    adaptiveVariantKind: readString(record.adaptive_variant_kind),
    moduleSlug,
    moduleTitle: moduleTitle(mathMap, moduleSlug),
    adaptiveStrand,
    score,
    accuracy: readNumber(record.accuracy) ?? score,
    completedAt,
    outcome,
    nextModuleSlug,
    nextModuleTitle: moduleTitle(mathMap, nextModuleSlug),
    reasonCode,
    parentSummary,
    practiceItemCount: readNumber(record.practice_item_count) ?? null,
    practiceItemsScored: readNumber(record.practice_items_scored) ?? null,
  };
};

const mapMathSubjectStateSummary = (
  row: StudentSubjectStateRow | null,
  mathMap: MathPrerequisiteMap,
): MathSubjectStateSummary | null => {
  if (!row) return null;
  const states = mapSubjectState(row);
  const metadata = readRecord(row.metadata);
  const targetStrand = readAdaptiveStrand(metadata.target_strand ?? metadata.targetStrand);
  const currentState = states.find((state) => state.adaptiveStrand === targetStrand) ?? states[0] ?? null;
  const currentStrand = currentState?.adaptiveStrand ?? targetStrand ?? 'place_value_operations';
  const currentModuleSlug =
    currentState?.currentModuleSlug ??
    readString(metadata.current_module_slug ?? metadata.currentModuleSlug) ??
    row.recommended_module_slugs?.[0];
  const recentEvidence = mapSubjectStateEvidence(row).map((item) => ({
    moduleSlug: item.moduleSlug,
    moduleTitle: moduleTitle(mathMap, item.moduleSlug),
    scorePct: item.scorePct,
    completedAt: item.completedAt,
  }));
  const rotationHistory = mapRotationHistorySummary(metadata.math_rotation_history, mathMap);
  const parentPreference = mapMathParentPreference(metadata.math_parent_preference);

  return {
    subject: 'math',
    placementStatus: row.placement_status ?? 'unknown',
    currentStrand,
    currentModuleSlug,
    currentModuleTitle: moduleTitle(mathMap, currentModuleSlug),
    workingGrade: currentState?.workingGrade ?? row.working_level ?? readNumber(metadata.working_grade),
    confidence: currentState?.confidence ?? row.level_confidence ?? readNumber(metadata.confidence),
    masteredModuleSlugs: currentState?.masteredModuleSlugs ?? readStringArray(metadata.mastered_module_slugs),
    weakModuleSlugs: currentState?.weakModuleSlugs ?? readStringArray(metadata.weak_module_slugs),
    recommendedModuleSlugs: row.recommended_module_slugs ?? [],
    lastAdaptiveVariantResult: mapLastVariantResult(metadata.last_adaptive_variant_result, mathMap),
    recentEvidence,
    rotationHistory,
    parentPreference,
  };
};

const progressToEvidence = (
  rows: StudentProgressModuleRow[],
  mathMap: MathPrerequisiteMap,
): { evidence: MathEvidence[]; latestModuleSlug?: string } => {
  const mathSlugs = new Set(mathMap.modules.map((module) => module.slug));
  const evidence: MathEvidence[] = [];

  for (const row of rows) {
    const moduleSlug = row.lessons?.modules?.slug ?? null;
    if (!moduleSlug || !mathSlugs.has(moduleSlug)) continue;
    const masteryPct = readNumber(row.mastery_pct);
    if (masteryPct == null) continue;
    evidence.push({
      moduleSlug,
      scorePct: masteryPct,
      completedAt: row.last_activity_at ?? undefined,
    });
  }

  const ordered = evidence.sort((a, b) => {
    const aTime = Date.parse(a.completedAt ?? '');
    const bTime = Date.parse(b.completedAt ?? '');
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
    return 0;
  });

  return {
    evidence: ordered,
    latestModuleSlug: ordered[ordered.length - 1]?.moduleSlug,
  };
};

export const fetchStudentMathDailyPlan = async (
  supabase: SupabaseClient,
  studentId: string,
  options: {
    date?: string;
    mathMap?: MathPrerequisiteMap;
    variantCatalog?: MathAdaptiveVariantCatalog | null;
    targetStrand?: MathAdaptiveStrand;
  } = {},
): Promise<DailyHomeschoolPlan> => {
  const mathMap = options.mathMap ?? loadMathPrerequisiteMap();
  const variantCatalog = options.variantCatalog === undefined ? loadMathAdaptiveVariantCatalog() : options.variantCatalog;

  const [stateResult, progressResult] = await Promise.all([
    supabase
      .from('student_subject_state')
      .select('subject, working_level, level_confidence, strand_scores, weak_standard_codes, recommended_module_slugs, metadata')
      .eq('student_id', studentId)
      .eq('subject', 'math')
      .maybeSingle(),
    supabase
      .from('student_progress')
      .select(
        `status, mastery_pct, attempts, last_activity_at,
         lessons (
           id,
           module_id,
           modules ( slug, subject )
         )`,
      )
      .eq('student_id', studentId)
      .order('last_activity_at', { ascending: false })
      .limit(30),
  ]);

  if (stateResult.error) {
    throw new Error(`Failed to load math subject state: ${stateResult.error.message}`);
  }
  if (progressResult.error) {
    throw new Error(`Failed to load math progress evidence: ${progressResult.error.message}`);
  }

  const stateRow = (stateResult.data ?? null) as StudentSubjectStateRow | null;
  const subjectState = mapSubjectState(stateRow);
  const subjectEvidence = mapSubjectStateEvidence(stateRow);
  const rotationHistory = mapRotationHistory(readRecord(stateRow?.metadata).math_rotation_history);
  const parentPreference = mapMathParentPreference(readRecord(stateRow?.metadata).math_parent_preference);
  const { evidence, latestModuleSlug } = progressToEvidence(
    ((progressResult.data ?? []) as StudentProgressModuleRow[]).slice(),
    mathMap,
  );
  const combinedEvidence = [...evidence, ...subjectEvidence].sort((a, b) => {
    const aTime = Date.parse(a.completedAt ?? '');
    const bTime = Date.parse(b.completedAt ?? '');
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
    return 0;
  });
  const latestEvidenceModuleSlug = combinedEvidence[combinedEvidence.length - 1]?.moduleSlug ?? latestModuleSlug;

  return buildMathDailyPlan({
    date: options.date,
    studentId,
    mathMap,
    variantCatalog,
    targetStrand: options.targetStrand,
    preferredStrand: parentPreference?.preferredStrand ?? undefined,
    strandStates: subjectState,
    recentEvidence: combinedEvidence,
    rotationHistory,
    completedModuleSlug: latestEvidenceModuleSlug,
  });
};

export const fetchStudentMathSubjectState = async (
  supabase: SupabaseClient,
  studentId: string,
  options: { mathMap?: MathPrerequisiteMap } = {},
): Promise<MathSubjectStateSummary | null> => {
  const mathMap = options.mathMap ?? loadMathPrerequisiteMap();
  const { data, error } = await supabase
    .from('student_subject_state')
    .select('subject, placement_status, working_level, level_confidence, strand_scores, weak_standard_codes, recommended_module_slugs, metadata')
    .eq('student_id', studentId)
    .eq('subject', 'math')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load math subject state: ${error.message}`);
  }

  return mapMathSubjectStateSummary((data ?? null) as StudentSubjectStateRow | null, mathMap);
};

const currentWeekStartIso = (date = new Date()): string => {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diff);
  return utc.toISOString().slice(0, 10);
};

const addDaysIso = (dateIso: string, days: number): string => {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const isWithinIsoWeek = (value: string | undefined, weekStart: string, weekEnd: string): boolean => {
  if (!value) return false;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  const startTime = Date.parse(`${weekStart}T00:00:00.000Z`);
  const endTime = Date.parse(`${weekEnd}T00:00:00.000Z`);
  return time >= startTime && time < endTime;
};

const outcomeForScore = (score: number | undefined): 'mastered' | 'practice' | 'weak' | undefined => {
  if (score == null) return undefined;
  if (score >= MATH_MASTERY_SCORE_THRESHOLD) return 'mastered';
  if (score < MATH_WEAK_SCORE_THRESHOLD) return 'weak';
  return 'practice';
};

const uniqueStrings = (values: Array<string | undefined>): string[] =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value))));

export const fetchStudentMathWeeklyRecord = async (
  supabase: SupabaseClient,
  studentId: string,
  options: { weekStart?: string; mathMap?: MathPrerequisiteMap } = {},
): Promise<MathWeeklyRecordSummary> => {
  const mathMap = options.mathMap ?? loadMathPrerequisiteMap();
  const weekStart = options.weekStart && isIsoDate(options.weekStart) ? options.weekStart : currentWeekStartIso();
  const weekEnd = addDaysIso(weekStart, 7);
  const mathSlugs = new Set(mathMap.modules.map((module) => module.slug));

  const [stateResult, progressResult] = await Promise.all([
    supabase
      .from('student_subject_state')
      .select('subject, placement_status, working_level, level_confidence, strand_scores, weak_standard_codes, recommended_module_slugs, metadata')
      .eq('student_id', studentId)
      .eq('subject', 'math')
      .maybeSingle(),
    supabase
      .from('student_progress')
      .select(
        `status, mastery_pct, last_activity_at,
         lessons (
           title,
           estimated_duration_minutes,
           modules ( title, slug, subject )
         )`,
      )
      .eq('student_id', studentId)
      .order('last_activity_at', { ascending: false })
      .limit(100),
  ]);

  if (stateResult.error) {
    throw new Error(`Failed to load math subject state: ${stateResult.error.message}`);
  }
  if (progressResult.error) {
    throw new Error(`Failed to load weekly math progress: ${progressResult.error.message}`);
  }

  const state = mapMathSubjectStateSummary((stateResult.data ?? null) as StudentSubjectStateRow | null, mathMap);
  const adaptiveModules: MathWeeklyRecordModuleSummary[] = (state?.recentEvidence ?? [])
    .filter((item) => isWithinIsoWeek(item.completedAt, weekStart, weekEnd))
    .map((item) => ({
      moduleSlug: item.moduleSlug,
      moduleTitle: item.moduleTitle,
      completedAt: item.completedAt,
      scorePct: item.scorePct,
      source: 'adaptive_variant',
      outcome: outcomeForScore(item.scorePct),
    }));

  const progressModules: MathWeeklyRecordModuleSummary[] = ((progressResult.data ?? []) as StudentProgressWeeklyRow[])
    .flatMap((row) => {
      const moduleSlug = row.lessons?.modules?.slug ?? null;
      if (row.status !== 'completed' || !moduleSlug || !mathSlugs.has(moduleSlug)) return [];
      if (!isWithinIsoWeek(row.last_activity_at ?? undefined, weekStart, weekEnd)) return [];
      const scorePct = readNumber(row.mastery_pct);
      return [
        {
          moduleSlug,
          moduleTitle: moduleTitle(mathMap, moduleSlug) ?? row.lessons?.modules?.title ?? row.lessons?.title ?? undefined,
          completedAt: row.last_activity_at ?? undefined,
          scorePct,
          estimatedMinutes: readNumber(row.lessons?.estimated_duration_minutes),
          source: 'lesson_progress',
          outcome: outcomeForScore(scorePct),
        } satisfies MathWeeklyRecordModuleSummary,
      ];
    });

  const completedModules = [...adaptiveModules, ...progressModules].sort((a, b) => {
    const aTime = Date.parse(a.completedAt ?? '');
    const bTime = Date.parse(b.completedAt ?? '');
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) return bTime - aTime;
    return 0;
  });
  const weeklyRotations = (state?.rotationHistory ?? []).filter((item) =>
    isWithinIsoWeek(`${item.date}T00:00:00.000Z`, weekStart, weekEnd),
  );
  const masteredModuleSlugs = uniqueStrings([
    ...completedModules.filter((item) => item.outcome === 'mastered').map((item) => item.moduleSlug),
    ...weeklyRotations.filter((item) => item.outcome === 'mastered').map((item) => item.completedModuleSlug),
  ]);
  const weakModuleSlugs = uniqueStrings([
    ...completedModules.filter((item) => item.outcome === 'weak').map((item) => item.moduleSlug),
    ...weeklyRotations.filter((item) => item.outcome === 'weak').map((item) => item.completedModuleSlug),
  ]);
  const estimatedMinutes = completedModules.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
  const latestAdaptiveResult = state?.lastAdaptiveVariantResult;
  const latestWeeklyRotation = weeklyRotations
    .slice()
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  const latestChangeSummary =
    latestAdaptiveResult && isWithinIsoWeek(latestAdaptiveResult.completedAt, weekStart, weekEnd)
      ? `This week changed because ${
          latestAdaptiveResult.moduleTitle ??
          moduleTitle(mathMap, latestAdaptiveResult.moduleSlug) ??
          latestAdaptiveResult.moduleSlug
        } scored ${latestAdaptiveResult.score}%. ${latestAdaptiveResult.parentSummary}`
      : latestWeeklyRotation
        ? `This week changed because math rotated to ${
            latestWeeklyRotation.assignedModuleTitle ??
            moduleTitle(mathMap, latestWeeklyRotation.assignedModuleSlug) ??
            latestWeeklyRotation.assignedModuleSlug
          } after ${latestWeeklyRotation.rotationReason.replaceAll('_', ' ')}.`
        : undefined;
  const parentNotes = [
    completedModules.length > 0
      ? `${completedModules.length} math check${completedModules.length === 1 ? '' : 's'} or lesson${completedModules.length === 1 ? '' : 's'} recorded this week.`
      : 'No completed math checks or lessons are recorded for this week yet.',
    estimatedMinutes > 0
      ? `Completed math lessons account for about ${estimatedMinutes} estimated minutes.`
      : 'Minute totals will appear when completed math lessons include duration estimates.',
    masteredModuleSlugs.length > 0
      ? `${masteredModuleSlugs.length} module${masteredModuleSlugs.length === 1 ? '' : 's'} showed mastery-level evidence.`
      : 'No mastery-level math evidence is recorded for this week yet.',
    weakModuleSlugs.length > 0
      ? `${weakModuleSlugs.length} module${weakModuleSlugs.length === 1 ? '' : 's'} need repair attention.`
      : 'No new weak math modules were recorded this week.',
  ];

  return {
    subject: 'math',
    studentId,
    weekStart,
    weekEnd,
    estimatedMinutes,
    completedModuleCount: completedModules.length,
    completedModules,
    masteredModuleSlugs,
    weakModuleSlugs,
    currentModuleSlug: state?.currentModuleSlug,
    currentModuleTitle: state?.currentModuleTitle,
    currentStrand: state?.currentStrand ?? 'place_value_operations',
    rotationHistory: weeklyRotations,
    parentPreference: state?.parentPreference ?? null,
    latestChangeSummary,
    parentNotes,
  };
};

export const fetchStudentMathParentPreference = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<MathParentPreferenceSummary | null> => {
  const { data, error } = await supabase
    .from('student_subject_state')
    .select('metadata')
    .eq('student_id', studentId)
    .eq('subject', 'math')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load math parent preference: ${error.message}`);
  }

  return mapMathParentPreference(readRecord(data?.metadata).math_parent_preference);
};

export const updateStudentMathParentPreference = async (
  supabase: SupabaseClient,
  studentId: string,
  parentId: string,
  preferredStrand: MathAdaptiveStrand | null,
): Promise<MathParentPreferenceSummary> => {
  const stateResult = await supabase
    .from('student_subject_state')
    .select('subject, expected_level, placement_status, working_level, level_confidence, strand_scores, weak_standard_codes, recommended_module_slugs, metadata')
    .eq('student_id', studentId)
    .eq('subject', 'math')
    .maybeSingle();

  if (stateResult.error) {
    throw new Error(`Failed to load math subject state: ${stateResult.error.message}`);
  }

  const existing = (stateResult.data ?? null) as StudentSubjectStateRow | null;
  const profileResult = existing
    ? null
    : await supabase
        .from('student_profiles')
        .select('grade_level')
        .eq('id', studentId)
        .maybeSingle();

  if (profileResult?.error) {
    throw new Error(`Failed to load learner grade for math preference: ${profileResult.error.message}`);
  }

  const updatedAt = new Date().toISOString();
  const preference: MathParentPreferenceSummary = {
    preferredStrand,
    weekStart: currentWeekStartIso(new Date(updatedAt)),
    updatedAt,
    updatedBy: parentId,
  };
  const metadata = {
    ...readRecord(existing?.metadata),
    math_parent_preference: {
      preferred_strand: preferredStrand,
      week_start: preference.weekStart,
      updated_at: preference.updatedAt,
      updated_by: parentId,
    },
  };
  const expectedLevel =
    existing?.expected_level ??
    readNumber((profileResult?.data as { grade_level?: number | null } | null)?.grade_level) ??
    3;

  const result = await supabase.from('student_subject_state').upsert(
    {
      student_id: studentId,
      subject: 'math',
      expected_level: expectedLevel,
      working_level: existing?.working_level ?? expectedLevel,
      level_confidence: existing?.level_confidence ?? 0,
      placement_status: existing?.placement_status ?? 'not_started',
      strand_scores: existing?.strand_scores ?? {},
      weak_standard_codes: existing?.weak_standard_codes ?? [],
      recommended_module_slugs: existing?.recommended_module_slugs ?? [],
      metadata,
    },
    { onConflict: 'student_id,subject' },
  );

  if (result.error) {
    throw new Error(`Failed to update math parent preference: ${result.error.message}`);
  }

  return preference;
};
