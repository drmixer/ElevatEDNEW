import type { SupabaseClient } from '@supabase/supabase-js';

import {
  chooseMathAssignment,
  chooseMathTargetStrand,
  MATH_MASTERY_SCORE_THRESHOLD,
  MATH_WEAK_SCORE_THRESHOLD,
  type MathAdaptiveStrand,
  type MathEvidence,
  type MathPrerequisiteMap,
  type MathRotationHistoryEntry,
  type MathStrandRotationReason,
  type MathStrandState,
} from '../shared/mathAdaptivePolicy.js';
import { loadMathPrerequisiteMap } from './homeschoolPlans.js';

type StudentSubjectStateRow = {
  subject?: string | null;
  expected_level?: number | string | null;
  working_level?: number | string | null;
  level_confidence?: number | string | null;
  strand_scores?: Record<string, unknown> | null;
  weak_standard_codes?: string[] | null;
  recommended_module_slugs?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type MathAdaptiveVariantEventInput = {
  adaptiveVariantId: string;
  adaptiveVariantKind?: string | null;
  moduleSlug: string;
  score: number;
  accuracy?: number | null;
  completedAt?: string;
  payload?: Record<string, unknown> | null;
};

type MathSubjectStateBuildInput = MathAdaptiveVariantEventInput & {
  studentId: string;
  currentState?: StudentSubjectStateRow | null;
  mathMap: MathPrerequisiteMap;
};

type MathSubjectStateUpsert = {
  student_id: string;
  subject: 'math';
  expected_level: number;
  working_level: number;
  level_confidence: number;
  placement_status: 'completed';
  strand_scores: Record<string, unknown>;
  weak_standard_codes: string[];
  recommended_module_slugs: string[];
  metadata: Record<string, unknown>;
};

const ADAPTIVE_STRANDS = new Set<MathAdaptiveStrand>([
  'place_value_operations',
  'fractions_decimals',
  'ratios_rates_percent',
  'expressions_equations_functions',
  'geometry_measurement',
  'data_probability_statistics',
  'problem_solving_modeling',
]);

const clampScore = (score: number): number => Math.max(0, Math.min(100, Math.round(score)));
const clampConfidence = (value: number): number => Math.max(0, Math.min(0.99, Number(value.toFixed(3))));

const readRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

const readNumber = (value: unknown): number | undefined => {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : undefined;
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

const unique = (values: string[]): string[] => Array.from(new Set(values.filter((value) => value.length > 0)));

const without = (values: string[], removed: string): string[] => values.filter((value) => value !== removed);

const mapExistingStrandStates = (row: StudentSubjectStateRow | null | undefined): MathStrandState[] => {
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
      },
    ];
  });

  if (explicitStates.length > 0) return explicitStates;

  const targetStrand = readAdaptiveStrand(metadata.target_strand ?? metadata.targetStrand);
  if (!targetStrand) return [];

  return [
    {
      adaptiveStrand: targetStrand,
      currentModuleSlug: readString(metadata.current_module_slug ?? metadata.currentModuleSlug) ?? undefined,
      workingGrade: readNumber(row.working_level) ?? readNumber(metadata.working_grade ?? metadata.workingGrade),
      confidence: readNumber(row.level_confidence) ?? readNumber(metadata.confidence),
      masteredModuleSlugs: readStringArray(metadata.mastered_module_slugs ?? metadata.masteredModuleSlugs),
      weakModuleSlugs: [
        ...readStringArray(metadata.weak_module_slugs ?? metadata.weakModuleSlugs),
        ...readStringArray(row.weak_standard_codes),
      ],
    },
  ];
};

const readRecentEvidence = (metadata: Record<string, unknown>): MathEvidence[] =>
  Array.isArray(metadata.recent_math_evidence)
    ? metadata.recent_math_evidence.flatMap((item) => {
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
      })
    : [];

const readRotationHistory = (value: unknown): MathRotationHistoryEntry[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const record = readRecord(item);
        const date = readString(record.date);
        const targetStrand = readAdaptiveStrand(record.target_strand ?? record.targetStrand);
        const assignedModuleSlug = readString(record.assigned_module_slug ?? record.assignedModuleSlug);
        const rotationReason = readRotationReason(record.rotation_reason ?? record.rotationReason);
        if (!date || !targetStrand || !assignedModuleSlug || !rotationReason) return [];
        const outcome = readString(record.outcome);
        return [
          {
            date,
            targetStrand,
            assignedModuleSlug,
            rotationReason,
            completedModuleSlug: readString(record.completed_module_slug ?? record.completedModuleSlug) ?? undefined,
            score: readNumber(record.score),
            outcome: outcome === 'mastered' || outcome === 'practice' || outcome === 'weak' ? outcome : undefined,
            parentSummary: readString(record.parent_summary ?? record.parentSummary) ?? undefined,
          } satisfies MathRotationHistoryEntry,
        ];
      })
    : [];

const updateConfidence = (current: number | undefined, score: number): number => {
  const base = current ?? 0.5;
  if (score >= MATH_MASTERY_SCORE_THRESHOLD) {
    return clampConfidence(Math.max(base, 0.68) + 0.08);
  }
  if (score < MATH_WEAK_SCORE_THRESHOLD) {
    return clampConfidence(Math.min(base, 0.65) - 0.12);
  }
  return clampConfidence(Math.max(0.45, base));
};

export const buildMathSubjectStateUpdate = ({
  studentId,
  currentState = null,
  mathMap,
  adaptiveVariantId,
  adaptiveVariantKind,
  moduleSlug,
  score,
  accuracy,
  completedAt = new Date().toISOString(),
  payload,
}: MathSubjectStateBuildInput): MathSubjectStateUpsert | null => {
  const moduleEntry = mathMap.modules.find((entry) => entry.slug === moduleSlug);
  if (!moduleEntry) return null;

  const normalizedScore = clampScore(score);
  const metadata = readRecord(currentState?.metadata);
  const strandScores = readRecord(currentState?.strand_scores);
  const existingStates = mapExistingStrandStates(currentState);
  const existingState = existingStates.find((state) => state.adaptiveStrand === moduleEntry.adaptive_strand);
  const existingEvidence = readRecentEvidence(metadata);
  const existingRotationHistory = readRotationHistory(metadata.math_rotation_history);
  const completedEvidence: MathEvidence = {
    moduleSlug,
    scorePct: normalizedScore,
    completedAt,
  };
  const recentEvidence = [...existingEvidence, completedEvidence].slice(-8);

  const wasMastered = normalizedScore >= MATH_MASTERY_SCORE_THRESHOLD;
  const wasWeak = normalizedScore < MATH_WEAK_SCORE_THRESHOLD;
  const masteredModuleSlugs = wasMastered
    ? unique([...(existingState?.masteredModuleSlugs ?? []), moduleSlug])
    : existingState?.masteredModuleSlugs ?? [];
  const weakModuleSlugs = wasMastered
    ? without(existingState?.weakModuleSlugs ?? [], moduleSlug)
    : wasWeak
      ? unique([...(existingState?.weakModuleSlugs ?? []), moduleSlug])
      : existingState?.weakModuleSlugs ?? [];
  const confidence = updateConfidence(existingState?.confidence ?? readNumber(currentState?.level_confidence), normalizedScore);

  const provisionalState: MathStrandState = {
    adaptiveStrand: moduleEntry.adaptive_strand,
    currentModuleSlug: moduleSlug,
    workingGrade: moduleEntry.grade,
    confidence,
    masteredModuleSlugs,
    weakModuleSlugs,
  };
  const strandStates = [
    ...existingStates.filter((state) => state.adaptiveStrand !== moduleEntry.adaptive_strand),
    provisionalState,
  ];
  const rotation = chooseMathTargetStrand({
    map: mathMap,
    strandStates,
    recentEvidence,
    rotationHistory: existingRotationHistory,
    completedModuleSlug: moduleSlug,
  });
  const decision = chooseMathAssignment({
    map: mathMap,
    targetStrand: rotation.targetStrand,
    strandStates,
    recentEvidence,
    rotationHistory: existingRotationHistory,
    completedModuleSlug: moduleSlug,
  });

  const workingGrade = mathMap.modules.find((entry) => entry.slug === decision.recommendedModuleSlug)?.grade ?? moduleEntry.grade;
  const completedStrandState: MathStrandState = {
    ...provisionalState,
    currentModuleSlug: rotation.targetStrand === moduleEntry.adaptive_strand ? decision.recommendedModuleSlug : moduleSlug,
    workingGrade: rotation.targetStrand === moduleEntry.adaptive_strand ? workingGrade : moduleEntry.grade,
  };
  const existingTargetState = strandStates.find((state) => state.adaptiveStrand === rotation.targetStrand);
  const targetStrandState: MathStrandState = rotation.targetStrand === moduleEntry.adaptive_strand
    ? completedStrandState
    : {
        adaptiveStrand: rotation.targetStrand,
        currentModuleSlug: decision.recommendedModuleSlug,
        workingGrade,
        confidence: existingTargetState?.confidence ?? confidence,
        masteredModuleSlugs: existingTargetState?.masteredModuleSlugs ?? [],
        weakModuleSlugs: existingTargetState?.weakModuleSlugs ?? [],
      };
  const nextState: MathStrandState = targetStrandState;
  const nextStrandStateRows = rotation.targetStrand === moduleEntry.adaptive_strand
    ? [completedStrandState]
    : [completedStrandState, targetStrandState];
  const strandScoreUpdates = Object.fromEntries(
    nextStrandStateRows.map((state) => [
      state.adaptiveStrand,
      {
        adaptive_strand: state.adaptiveStrand,
        current_module_slug: state.currentModuleSlug,
        working_grade: state.workingGrade,
        confidence: state.confidence,
        mastered_module_slugs: state.masteredModuleSlugs ?? [],
        weak_module_slugs: state.weakModuleSlugs ?? [],
        last_score: state.adaptiveStrand === moduleEntry.adaptive_strand ? normalizedScore : undefined,
        last_adaptive_variant_id: state.adaptiveStrand === moduleEntry.adaptive_strand ? adaptiveVariantId : undefined,
        last_updated_at: completedAt,
      },
    ]),
  );
  const parentSummary =
    rotation.reasonCode === 'explicit_target_strand' || rotation.reasonCode === 'continue_current_strand'
      ? decision.parentSummary
      : `${rotation.parentSummary} ${decision.parentSummary}`;
  const outcome = wasMastered ? 'mastered' : wasWeak ? 'weak' : 'practice';
  const nextRotationHistory = [
    ...existingRotationHistory,
    {
      date: completedAt.slice(0, 10),
      targetStrand: rotation.targetStrand,
      assignedModuleSlug: decision.recommendedModuleSlug,
      rotationReason: rotation.reasonCode,
      completedModuleSlug: moduleSlug,
      score: normalizedScore,
      outcome,
      parentSummary,
    } satisfies MathRotationHistoryEntry,
  ].slice(-10);
  const strandStateKeys = unique([
    ...readStringArray(metadata.strand_state_keys),
    moduleEntry.adaptive_strand,
    rotation.targetStrand,
  ]);
  const nextStrandScores = {
    ...strandScores,
    ...strandScoreUpdates,
  };
  const lastResult = {
    adaptive_variant_id: adaptiveVariantId,
    adaptive_variant_kind: adaptiveVariantKind ?? null,
    module_slug: moduleSlug,
    adaptive_strand: moduleEntry.adaptive_strand,
    score: normalizedScore,
    accuracy: accuracy ?? normalizedScore,
    completed_at: completedAt,
    outcome,
    target_strand: rotation.targetStrand,
    rotation_reason: rotation.reasonCode,
    next_module_slug: decision.recommendedModuleSlug,
    reason_code: decision.reasonCode,
    parent_summary: parentSummary,
    practice_item_count: readNumber(payload?.practice_item_count) ?? null,
    practice_items_scored: readNumber(payload?.practice_items_scored) ?? null,
  };
  const nextMetadata = {
    ...metadata,
    math_subject_state_version: 1,
    target_strand: rotation.targetStrand,
    current_module_slug: decision.recommendedModuleSlug,
    working_grade: workingGrade,
    confidence: nextState.confidence,
    mastered_module_slugs: nextState.masteredModuleSlugs ?? [],
    weak_module_slugs: nextState.weakModuleSlugs ?? [],
    strand_state_keys: strandStateKeys,
    recent_math_evidence: recentEvidence.map((item) => ({
      moduleSlug: item.moduleSlug,
      scorePct: item.scorePct,
      completedAt: item.completedAt,
    })),
    math_rotation_history: nextRotationHistory.map((item) => ({
      date: item.date,
      target_strand: item.targetStrand,
      assigned_module_slug: item.assignedModuleSlug,
      rotation_reason: item.rotationReason,
      completed_module_slug: item.completedModuleSlug,
      score: item.score,
      outcome: item.outcome,
      parent_summary: item.parentSummary,
    })),
    last_adaptive_variant_result: lastResult,
  };

  const expectedLevel = readNumber(currentState?.expected_level) ?? moduleEntry.grade;
  return {
    student_id: studentId,
    subject: 'math',
    expected_level: expectedLevel,
    working_level: workingGrade,
    level_confidence: nextState.confidence ?? confidence,
    placement_status: 'completed',
    strand_scores: nextStrandScores,
    weak_standard_codes: unique([
      ...readStringArray(currentState?.weak_standard_codes).filter((slug) => slug !== moduleSlug),
      ...weakModuleSlugs,
    ]),
    recommended_module_slugs: unique([decision.recommendedModuleSlug, ...decision.supportingModuleSlugs]),
    metadata: nextMetadata,
  };
};

export const updateMathSubjectStateFromAdaptiveVariantEvent = async (
  supabase: SupabaseClient,
  studentId: string,
  event: MathAdaptiveVariantEventInput,
  options: { mathMap?: MathPrerequisiteMap } = {},
): Promise<MathSubjectStateUpsert | null> => {
  const mathMap = options.mathMap ?? loadMathPrerequisiteMap();
  const { data, error } = await supabase
    .from('student_subject_state')
    .select('subject, expected_level, working_level, level_confidence, strand_scores, weak_standard_codes, recommended_module_slugs, metadata')
    .eq('student_id', studentId)
    .eq('subject', 'math')
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load math subject state: ${error.message}`);
  }

  const update = buildMathSubjectStateUpdate({
    studentId,
    currentState: (data ?? null) as StudentSubjectStateRow | null,
    mathMap,
    ...event,
  });
  if (!update) return null;

  const result = await supabase
    .from('student_subject_state')
    .upsert(update, { onConflict: 'student_id,subject' });

  if (result.error) {
    throw new Error(`Unable to update math subject state: ${result.error.message}`);
  }

  return update;
};
