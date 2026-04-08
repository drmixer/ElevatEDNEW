import type { SupabaseClient } from '@supabase/supabase-js';

import type { StudentPreferences } from './personalization.js';
import { getStudentPreferences, updateStudentPreferences } from './personalization.js';
import { getRuntimeConfig, type RuntimeConfig } from './config.js';
import { recordOpsEvent } from './opsMetrics.js';
import { captureServerException, raiseAlert } from './monitoring.js';
import { HttpError } from './httpError.js';
import { selectPlacementAssessmentId } from './placementSelection.js';
import { validatePlacementQuestions } from './placementValidation.js';
import { parseProfileLearningPath, projectProfileLearningPathEntries, type ProfileLearningPathItem } from './learningPathProjection.js';
import {
  buildCatPlacementSummary,
  CAT_V2_DIAGNOSTIC_TYPE,
  CAT_V2_ENGINE_VERSION,
  isCatV2GradeBandEligible,
  isCatV2SubjectEligible,
  type CatPlacementResponse,
  type CatPlacementSummary,
} from './catPlacement.js';

type PathBuildOptions = {
  gradeBand?: string | null;
  subject?: string | null;
  workingLevel?: number | null;
  preferredModuleSlugs?: string[];
  goalFocus?: string | null;
  source?: string;
  limit?: number;
  metadata?: Record<string, unknown>;
};

type PlacementQuestion = {
  id: string;
  bankQuestionId: number;
  prompt: string;
  type: string;
  options: Array<{ id: number; text: string; isCorrect: boolean; feedback?: string | null }>;
  weight: number;
  difficulty: number;
  strand: string | null;
  targetStandards: string[];
  metadata?: Record<string, unknown> | null;
};

type PlacementStartResult = {
  assessmentId: number;
  attemptId: number;
  attemptNumber: number;
  gradeBand: string;
  subject: string | null;
  expectedLevel: number | null;
  engineVersion?: string;
  resumeToken: string;
  items: PlacementQuestion[];
  existingResponses: Array<{ questionId: number; selectedOptionId: number | null; isCorrect: boolean | null }>;
};

type PlacementResponseInput = {
  bankQuestionId: number;
  optionId: number | null;
  timeSpentSeconds?: number | null;
};

type PlacementSaveResult = {
  isCorrect: boolean;
  engineVersion?: string;
  nextItem?: PlacementQuestion | null;
  isComplete?: boolean;
};

type StrandEstimate = { strand: string; correct: number; total: number; accuracyPct: number };
const LEGACY_PLACEMENT_ENGINE_VERSION = 'legacy_v1';
const LEGACY_DIAGNOSTIC_TYPE = 'legacy_placement';
const MIN_WORKING_LEVEL = 0;
const MAX_WORKING_LEVEL = 8;
const MAX_PLACEMENT_REMEDIATION_INSERTS = 2;

export type PathEntry = {
  id: number;
  path_id: number;
  position: number;
  type: string;
  module_id: number | null;
  lesson_id: number | null;
  assessment_id: number | null;
  status: string;
  score: number | null;
  time_spent_s: number | null;
  target_standard_codes: string[];
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type PathSummary = {
  id: number;
  subject?: string | null;
  status: string;
  started_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
};

export type SubjectState = {
  id: number;
  student_id: string;
  subject: string;
  expected_level: number;
  working_level: number | null;
  level_confidence: number;
  diagnostic_version?: string | null;
  prior_level_hint?: number | null;
  confidence_low?: number | null;
  confidence_high?: number | null;
  placement_status: string;
  diagnostic_assessment_id: number | null;
  diagnostic_attempt_id: number | null;
  diagnostic_completed_at: string | null;
  strand_scores: Record<string, unknown>;
  weak_standard_codes: string[];
  prerequisite_gaps?: unknown[] | null;
  recommended_module_slugs: string[];
  last_path_id: number | null;
  calibration_state?: Record<string, unknown>;
  last_recalibrated_at?: string | null;
  last_diagnostic_type?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type CanonicalSequenceItem = {
  position: number;
  module_id: number | null;
  module_slug: string | null;
  module_title: string | null;
  subject?: string | null;
  standard_codes: string[] | null;
  metadata?: Record<string, unknown> | null;
};

type PlacementPrerequisiteGap = {
  standardCode: string;
  observedLevel: number | null;
  confidence: number | null;
};

type PlacementRemediationModule = {
  gap: PlacementPrerequisiteGap;
  moduleId: number;
  moduleSlug: string | null;
  moduleTitle: string | null;
  subject: string | null;
};

type QuestionBankRow = {
  id: number;
  prompt: string;
  question_type: string;
  difficulty: number | null;
  solution_explanation?: string | null;
  metadata?: Record<string, unknown> | null;
  tags?: string[] | null;
};

type PlacementAttemptMetadata = Record<string, unknown> & {
  diagnostic_version?: string;
  item_route?: unknown;
  item_pool_assessment_ids?: unknown;
  prior_level_hint?: unknown;
};

type AdaptiveAttempt = {
  standards: string[];
  correct: boolean;
  difficulty: number | null;
  source: string;
  createdAt: string;
  accuracy: number | null;
};

type StoredAssessmentResponseRow = {
  question_id: number;
  selected_option_id?: number | null;
  is_correct?: boolean | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

type SubjectMixSummary = {
  counts: Array<{ subject: string; count: number }>;
  label: string;
  primarySubject: string | null;
  primaryCoreSubject: string | null;
};

type SubjectMasteryAggregate = {
  subject: string | null;
  mastery: number | null;
};

type LiveSubjectEvent = {
  subject: string;
  eventType: string;
  createdAt: string;
  accuracy: number | null;
  standards: string[];
  completionSignal: boolean;
  signalDirection: 'support' | 'stretch' | 'steady';
};

export type SubjectSignalSnapshot = {
  subject: string;
  recentAccuracy: number | null;
  masteryPct: number | null;
  masteryTrend: 'support' | 'steady' | 'stretch';
  supportPressure: number;
  stretchReadiness: number;
  evidenceCount: number;
  lessonSignals: number;
  weakStandards: string[];
  lastReplannedAt: string | null;
};

let TARGET_ACCURACY_BAND = { min: 0.65, max: 0.8 };
const MAX_ADAPTIVE_ATTEMPTS = 24;
const MAX_STANDARDS_TRACKED = 4;
let MAX_REMEDIATION_INSERTS = 2;
let MAX_PENDING_PRACTICE = 3;
const CORE_PROFILE_SUBJECTS = ['math', 'english'] as const;
const CONTEXTUAL_PROFILE_SUBJECTS = ['science', 'social_studies'] as const;
const PROFILE_BLEND_SIGNAL_KEY = 'profile_blend_signal';
const PROFILE_REPLAN_STABLE_SIGNAL_COUNT = 3;
const PROFILE_REPLAN_DEBOUNCE_MS = 5 * 60 * 1000;
const PROFILE_REPLAN_EVENT_SAMPLE = 60;
const PROFILE_LEARNING_PATH_LIMIT = 8;
const syncAdaptiveConfig = async (supabase: SupabaseClient | null) => {
  try {
    const config = await getRuntimeConfig(supabase ?? null);
    TARGET_ACCURACY_BAND = {
      min: config.adaptive.targetAccuracyMin,
      max: config.adaptive.targetAccuracyMax,
    };
    MAX_REMEDIATION_INSERTS = config.adaptive.maxRemediationPending;
    MAX_PENDING_PRACTICE = config.adaptive.maxPracticePending;
    return config;
  } catch (error) {
    console.warn('[adaptive] falling back to default config', error);
    captureServerException(error, { stage: 'adaptive_config_sync' });
    return null;
  }
};

const deriveGradeBand = (gradeLevel?: number | null, gradeBand?: string | null): string => {
  if (gradeBand && gradeBand.trim().length > 0) return gradeBand;
  if (!gradeLevel) return '6-8';
  if (gradeLevel <= 2) return 'K-2';
  if (gradeLevel <= 5) return '3-5';
  if (gradeLevel <= 8) return '6-8';
  return '9-12';
};

const gradeBandToLevel = (gradeBand?: string | null): number | null => {
  if (!gradeBand) return null;
  const normalized = gradeBand.trim().toUpperCase();
  if (normalized === 'K-2') return 2;
  if (normalized === '3-5') return 4;
  if (normalized === '6-8') return 7;
  if (normalized === '9-12') return 10;
  const numeric = Number.parseInt(normalized, 10);
  return Number.isFinite(numeric) ? numeric : null;
};

const clampWorkingLevel = (level: number | null | undefined): number | null => {
  if (typeof level !== 'number' || !Number.isFinite(level)) return null;
  return Math.max(MIN_WORKING_LEVEL, Math.min(MAX_WORKING_LEVEL, Math.round(level)));
};

const normalizeSubjectKey = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return null;
  if (normalized === 'ela' || normalized === 'english_language_arts' || normalized === 'reading' || normalized === 'writing') {
    return 'english';
  }
  if (normalized === 'mathematics') return 'math';
  return normalized;
};

export const resolvePlacementEngineVersion = (params: {
  config?: RuntimeConfig | null;
  subject?: string | null;
  gradeBand?: string | null;
}): string => {
  const activeEngine = params.config?.placement.activeEngine?.trim().toLowerCase() ?? LEGACY_PLACEMENT_ENGINE_VERSION;
  const subject = normalizeSubjectKey(params.subject ?? null);

  if (activeEngine === CAT_V2_ENGINE_VERSION && isCatV2SubjectEligible(subject) && isCatV2GradeBandEligible(params.gradeBand)) {
    return CAT_V2_ENGINE_VERSION;
  }

  return LEGACY_PLACEMENT_ENGINE_VERSION;
};

const subjectVariants = (subject: string | null | undefined): string[] => {
  const normalized = normalizeSubjectKey(subject);
  switch (normalized) {
    case 'math':
      return ['math', 'mathematics'];
    case 'english':
      return ['english', 'ela', 'english_language_arts', 'english language arts', 'reading_&_writing', 'reading & writing'];
    default:
      return normalized ? [normalized, normalized.replace(/_/g, ' ')] : [];
  }
};

const subjectMatches = (candidate: string | null | undefined, subject: string | null | undefined): boolean => {
  if (!subject) return true;
  const candidateKey = normalizeSubjectKey(candidate);
  return candidateKey != null && subjectVariants(subject).some((value) => normalizeSubjectKey(value) === candidateKey);
};

export const deriveExpectedLevel = (params: {
  ageYears?: number | null;
  gradeLevel?: number | null;
  gradeBand?: string | null;
}): number => {
  const agePrior =
    typeof params.ageYears === 'number' && Number.isFinite(params.ageYears)
      ? clampWorkingLevel(params.ageYears - 5)
      : null;
  const gradePrior =
    typeof params.gradeLevel === 'number' && Number.isFinite(params.gradeLevel)
      ? clampWorkingLevel(params.gradeLevel)
      : clampWorkingLevel(gradeBandToLevel(params.gradeBand ?? null));

  if (agePrior != null && gradePrior != null) {
    return clampWorkingLevel(Math.round((agePrior + gradePrior) / 2)) ?? 6;
  }
  return agePrior ?? gradePrior ?? 6;
};

const splitName = (fullName?: string | null): { first: string; last: string | null } => {
  if (!fullName) return { first: 'Student', last: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0] ?? 'Student', last: null };
  }
  return { first: parts[0] ?? 'Student', last: parts.slice(1).join(' ') || null };
};

const buildLegacyDiagnosticTrace = (params: {
  subject?: string | null;
  gradeBand?: string | null;
  expectedLevel?: number | null;
  workingLevel?: number | null;
  levelConfidence?: number | null;
  phase?: 'start' | 'complete';
}) => ({
  diagnostic_version: LEGACY_PLACEMENT_ENGINE_VERSION,
  diagnostic_type: LEGACY_DIAGNOSTIC_TYPE,
  placement_engine_version: LEGACY_PLACEMENT_ENGINE_VERSION,
  phase: params.phase ?? 'complete',
  subject: params.subject ?? null,
  grade_band: params.gradeBand ?? null,
  prior_level_hint: params.expectedLevel ?? null,
  expected_level: params.expectedLevel ?? null,
  working_level: params.workingLevel ?? null,
  level_confidence: params.levelConfidence ?? null,
});

const buildCatDiagnosticTrace = (params: {
  subject?: string | null;
  gradeBand?: string | null;
  expectedLevel?: number | null;
  summary?: CatPlacementSummary | null;
  itemPoolAssessmentIds?: number[];
  phase?: 'start' | 'in_progress' | 'complete';
}) => ({
  diagnostic_version: CAT_V2_ENGINE_VERSION,
  diagnostic_type: CAT_V2_DIAGNOSTIC_TYPE,
  placement_engine_version: CAT_V2_ENGINE_VERSION,
  phase: params.phase ?? 'complete',
  subject: params.subject ?? null,
  grade_band: params.gradeBand ?? null,
  prior_level_hint: params.expectedLevel ?? null,
  posterior_level: params.summary?.currentEstimate ?? params.expectedLevel ?? null,
  expected_level: params.expectedLevel ?? null,
  working_level: params.summary?.workingLevel ?? null,
  level_confidence: params.summary?.diagnosticConfidence ?? null,
  confidence_low: params.summary?.confidenceLow ?? null,
  confidence_high: params.summary?.confidenceHigh ?? null,
  coverage_fallback_used: params.summary?.coverageFallbackUsed ?? false,
  termination_reason: params.summary?.terminationReason ?? null,
  item_route: params.summary?.itemRoute ?? [],
  prerequisite_gaps: params.summary?.prerequisiteGaps ?? [],
  item_pool_assessment_ids: params.itemPoolAssessmentIds ?? [],
});

const isCatPlacementAttemptMetadata = (metadata: Record<string, unknown> | null | undefined): boolean =>
  typeof metadata?.diagnostic_version === 'string' && metadata.diagnostic_version.toLowerCase() === CAT_V2_ENGINE_VERSION;

const readNumberList = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) =>
      typeof entry === 'number'
        ? entry
        : typeof entry === 'string' && entry.trim().length
          ? Number.parseInt(entry.trim(), 10)
          : Number.NaN,
    )
    .filter((entry) => Number.isFinite(entry));
};

const readCatRouteIndex = (metadata: Record<string, unknown> | null | undefined): number | null => {
  const raw = metadata?.cat_route_index;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim().length) {
    const parsed = Number.parseInt(raw.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const hasMissingAssessmentResponseMetadataColumn = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === '42703') return true;
  return (
    typeof candidate.message === 'string' &&
    (candidate.message.includes('student_assessment_responses.metadata') ||
      candidate.message.includes("Could not find the 'metadata' column of 'student_assessment_responses'"))
  );
};

const readMissingSchemaColumn = (error: unknown, table: string): string | null => {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { message?: unknown };
  if (typeof candidate.message !== 'string') return null;

  const schemaCachePattern = new RegExp(`Could not find the '([^']+)' column of '${table}'`);
  const schemaCacheMatch = candidate.message.match(schemaCachePattern);
  if (schemaCacheMatch?.[1]) {
    return schemaCacheMatch[1];
  }

  const postgresPattern = new RegExp(`column ${table}\\.([a-z_]+) does not exist`, 'i');
  const postgresMatch = candidate.message.match(postgresPattern);
  if (postgresMatch?.[1]) {
    return postgresMatch[1];
  }

  return null;
};

const loadAssessmentResponsesByAttempt = async (
  supabase: SupabaseClient,
  attemptId: number,
): Promise<StoredAssessmentResponseRow[]> => {
  const metadataSelect = await supabase
    .from('student_assessment_responses')
    .select('question_id, selected_option_id, is_correct, metadata, created_at')
    .eq('attempt_id', attemptId);

  if (!metadataSelect.error) {
    return (metadataSelect.data ?? []) as StoredAssessmentResponseRow[];
  }

  if (!hasMissingAssessmentResponseMetadataColumn(metadataSelect.error)) {
    throw new Error(metadataSelect.error.message);
  }

  const fallbackSelect = await supabase
    .from('student_assessment_responses')
    .select('question_id, selected_option_id, is_correct, created_at')
    .eq('attempt_id', attemptId);

  if (fallbackSelect.error) {
    throw new Error(fallbackSelect.error.message);
  }

  return ((fallbackSelect.data ?? []) as Array<Omit<StoredAssessmentResponseRow, 'metadata'>>).map((row) => ({
    ...row,
    metadata: null,
  }));
};

const removeAssessmentResponseMetadata = (
  payload: Record<string, unknown> | Array<Record<string, unknown>>,
): Record<string, unknown> | Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) {
    return payload.map((entry) => {
      const next = { ...entry };
      delete next.metadata;
      return next;
    });
  }
  const next = { ...payload };
  delete next.metadata;
  return next;
};

const upsertAssessmentResponses = async (
  supabase: SupabaseClient,
  payload: Record<string, unknown> | Array<Record<string, unknown>>,
): Promise<void> => {
  const initialWrite = await supabase
    .from('student_assessment_responses')
    .upsert(payload, { onConflict: 'attempt_id,question_id' });

  if (!initialWrite.error) {
    return;
  }

  if (!hasMissingAssessmentResponseMetadataColumn(initialWrite.error)) {
    throw new Error(initialWrite.error.message);
  }

  const fallbackWrite = await supabase
    .from('student_assessment_responses')
    .upsert(removeAssessmentResponseMetadata(payload), { onConflict: 'attempt_id,question_id' });

  if (fallbackWrite.error) {
    throw new Error(fallbackWrite.error.message);
  }
};

const sortCatResponseRows = <
  T extends {
    question_id: unknown;
    is_correct?: unknown;
    metadata?: Record<string, unknown> | null;
    created_at?: string | null;
  },
>(
  rows: T[],
): T[] =>
  rows.slice().sort((left, right) => {
    const leftIndex = readCatRouteIndex(left.metadata);
    const rightIndex = readCatRouteIndex(right.metadata);
    if (leftIndex != null && rightIndex != null && leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    if (leftIndex != null) return -1;
    if (rightIndex != null) return 1;
    const leftCreatedAt = typeof left.created_at === 'string' ? Date.parse(left.created_at) : Number.NaN;
    const rightCreatedAt = typeof right.created_at === 'string' ? Date.parse(right.created_at) : Number.NaN;
    if (Number.isFinite(leftCreatedAt) && Number.isFinite(rightCreatedAt) && leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt - rightCreatedAt;
    }
    return Number(left.question_id) - Number(right.question_id);
  });

const selectQuestionProjection = 'question_id, section_id, question_order, weight, metadata';

const loadPlacementQuestionPool = async (
  supabase: SupabaseClient,
  assessmentIds: number[],
): Promise<PlacementQuestion[]> => {
  const uniqueAssessmentIds = Array.from(new Set(assessmentIds.filter((id) => Number.isFinite(id))));
  if (!uniqueAssessmentIds.length) {
    return [];
  }

  const { data: sectionRows, error: sectionError } = await supabase
    .from('assessment_sections')
    .select('id, assessment_id, section_order')
    .in('assessment_id', uniqueAssessmentIds)
    .order('assessment_id', { ascending: true })
    .order('section_order', { ascending: true });

  if (sectionError) {
    throw new Error(`Unable to load CAT assessment sections: ${sectionError.message}`);
  }

  const sections = (sectionRows ?? []) as Array<{ id: number; assessment_id: number; section_order: number | null }>;
  const sectionIds = sections.map((section) => section.id);
  if (!sectionIds.length) {
    return [];
  }

  const { data: links, error: linkError } = await supabase
    .from('assessment_questions')
    .select(selectQuestionProjection)
    .in('section_id', sectionIds)
    .order('question_order', { ascending: true });

  if (linkError) {
    throw new Error(`Unable to load CAT assessment questions: ${linkError.message}`);
  }

  const questionLinks = (links ?? []) as Array<{
    question_id: number;
    section_id: number;
    question_order: number;
    weight: number | null;
    metadata: Record<string, unknown> | null;
  }>;
  const questionIds = Array.from(new Set(questionLinks.map((link) => link.question_id)));
  if (!questionIds.length) {
    return [];
  }

  const [questionBankResult, optionsResult] = await Promise.all([
    supabase
      .from('question_bank')
      .select('id, prompt, question_type, difficulty, solution_explanation, metadata, tags')
      .in('id', questionIds),
    supabase
      .from('question_options')
      .select('id, question_id, option_order, content, is_correct, feedback')
      .in('question_id', questionIds)
      .order('option_order', { ascending: true }),
  ]);

  if (questionBankResult.error) {
    throw new Error(`Failed to load CAT question bank rows: ${questionBankResult.error.message}`);
  }
  if (optionsResult.error) {
    throw new Error(`Failed to load CAT question options: ${optionsResult.error.message}`);
  }

  const bankLookup = new Map<number, QuestionBankRow>();
  (questionBankResult.data ?? []).forEach((row) => {
    bankLookup.set(row.id as number, row as QuestionBankRow);
  });

  const optionLookup = new Map<number, PlacementQuestion['options']>();
  (optionsResult.data ?? []).forEach((row) => {
    const optionRow = row as { id: number; question_id: number; content: string; is_correct: boolean; feedback?: string | null };
    const list = optionLookup.get(optionRow.question_id) ?? [];
    list.push({
      id: optionRow.id,
      text: optionRow.content,
      isCorrect: optionRow.is_correct,
      feedback: optionRow.feedback ?? null,
    });
    optionLookup.set(optionRow.question_id, list);
  });

  const sectionLookup = new Map<number, { assessmentId: number; sectionOrder: number }>();
  sections.forEach((section) => {
    sectionLookup.set(section.id, {
      assessmentId: section.assessment_id,
      sectionOrder: section.section_order ?? 0,
    });
  });

  const questions = questionLinks
    .map((link, index) => {
      const bankQuestion = bankLookup.get(link.question_id);
      if (!bankQuestion) return null;
      const metadata = (bankQuestion.metadata ?? {}) as Record<string, unknown>;
      const tags = Array.isArray(bankQuestion.tags) ? (bankQuestion.tags as string[]) : [];
      const strand =
        (metadata.strand as string | undefined) ??
        (link.metadata?.strand as string | undefined) ??
        (tags.length ? tags[0] : null);
      const standards = Array.isArray(metadata.standards)
        ? (metadata.standards as string[])
        : Array.isArray(link.metadata?.standards)
          ? ((link.metadata?.standards as string[]) ?? [])
          : [];
      return {
        id: `cat-q-${link.question_id}-${index + 1}`,
        bankQuestionId: link.question_id,
        prompt: bankQuestion.prompt,
        type: bankQuestion.question_type as PlacementQuestion['type'],
        options: optionLookup.get(link.question_id) ?? [],
        weight: link.weight ?? 1,
        difficulty: bankQuestion.difficulty ?? 3,
        strand: strand ?? null,
        targetStandards: standards,
        metadata,
      } satisfies PlacementQuestion;
    })
    .filter((question): question is PlacementQuestion => Boolean(question))
    .sort((left, right) => {
      const leftLevel = readPlacementLevel(left.metadata?.placement_level) ?? readPlacementLevel(left.metadata?.placementLevel) ?? 99;
      const rightLevel = readPlacementLevel(right.metadata?.placement_level) ?? readPlacementLevel(right.metadata?.placementLevel) ?? 99;
      if (leftLevel !== rightLevel) return leftLevel - rightLevel;
      const leftDifficulty = typeof left.difficulty === 'number' ? left.difficulty : 99;
      const rightDifficulty = typeof right.difficulty === 'number' ? right.difficulty : 99;
      if (leftDifficulty !== rightDifficulty) return leftDifficulty - rightDifficulty;
      return left.bankQuestionId - right.bankQuestionId;
    });

  const validation = validatePlacementQuestions(questions, { assessmentId: uniqueAssessmentIds[0] ?? 0 });
  return validation.questions as PlacementQuestion[];
};

const findCatPlacementPool = async (
  supabase: SupabaseClient,
  subject: string,
): Promise<{ assessmentIds: number[]; questions: PlacementQuestion[] }> => {
  const { data, error } = await supabase
    .from('assessments')
    .select('id, module_id, metadata, created_at')
    .is('module_id', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(400);

  if (error) {
    throw new Error(`Unable to read CAT assessments: ${error.message}`);
  }

  const assessmentIds = ((data ?? []) as Array<{ id: number; module_id: number | null; metadata: Record<string, unknown> | null }>)
    .filter((row) => row.module_id == null)
    .filter((row) => {
      const metadata = row.metadata ?? {};
      const purpose = String((metadata.purpose as string | undefined) ?? '').trim().toLowerCase();
      if (purpose !== 'diagnostic') return false;
      return subjectMatches(String((metadata.subject_key as string | undefined) ?? ''), subject);
    })
    .map((row) => row.id as number);

  const questions = await loadPlacementQuestionPool(supabase, assessmentIds);
  return { assessmentIds, questions };
};

const buildCatDisplayItems = (
  questionMap: Map<number, PlacementQuestion>,
  summary: CatPlacementSummary,
): PlacementQuestion[] => {
  const served = summary.itemRoute
    .map((entry) => questionMap.get(entry.bankQuestionId) ?? null)
    .filter((question): question is PlacementQuestion => Boolean(question));
  const next =
    summary.terminationReason || !summary.nextItem
      ? null
      : questionMap.get(summary.nextItem.bankQuestionId) ?? null;

  if (next && !served.some((question) => question.bankQuestionId === next.bankQuestionId)) {
    return [...served, next];
  }
  return served;
};

const loadStudentProfile = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<{
  grade_level: number | null;
  grade_band: string | null;
  age_years: number | null;
  learning_path: unknown;
  preferences: StudentPreferences;
}> => {
  const [profile, preferences] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('grade_level, grade_band, age_years, learning_path')
      .eq('id', studentId)
      .maybeSingle(),
    getStudentPreferences(supabase, studentId),
  ]);

  if (profile.error) {
    throw new Error(`Unable to load student profile: ${profile.error.message}`);
  }

  return {
    grade_level: (profile.data?.grade_level as number | null | undefined) ?? null,
    grade_band: (profile.data?.grade_band as string | null | undefined) ?? null,
    age_years: (profile.data?.age_years as number | null | undefined) ?? null,
    learning_path: profile.data?.learning_path ?? null,
    preferences,
  };
};

export const ensureStudentProfileProvisioned = async (
  supabase: SupabaseClient,
  serviceSupabase: SupabaseClient | null,
  studentId: string,
  options?: {
    gradeBand?: string | null;
    gradeLevel?: number | null;
    ageYears?: number | null;
    fullName?: string | null;
    optInAi?: boolean;
    avatarId?: string | null;
    tutorPersonaId?: string | null;
  },
): Promise<void> => {
  const writer = serviceSupabase ?? supabase;

  const [{ data: profileRow, error: profileError }, { data: studentRow, error: studentError }] = await Promise.all([
    writer.from('profiles').select('full_name').eq('id', studentId).maybeSingle(),
    writer.from('student_profiles').select('id').eq('id', studentId).maybeSingle(),
  ]);

  if (profileError) {
    throw new Error(`Unable to load profile: ${profileError.message}`);
  }
  if (studentError) {
    throw new Error(`Unable to verify student profile: ${studentError.message}`);
  }

  const fullName = options?.fullName ?? ((profileRow?.full_name as string | null | undefined) ?? null);
  const { first, last } = splitName(fullName);
  const gradeLevel =
    typeof options?.gradeLevel === 'number' && Number.isFinite(options.gradeLevel)
      ? Math.max(1, Math.min(12, Math.round(options.gradeLevel)))
      : gradeBandToLevel(options?.gradeBand ?? null);
  const ageYears =
    typeof options?.ageYears === 'number' && Number.isFinite(options.ageYears)
      ? Math.max(3, Math.min(20, Math.round(options.ageYears)))
      : null;
  const resolvedGradeBand = options?.gradeBand ?? (gradeLevel ? deriveGradeBand(gradeLevel, null) : null);

  if (!studentRow) {
    // Ensure a parent profile exists to satisfy the FK; for now, fall back to self-parenting if none exists.
    const parentId = studentId;
    const { data: parentRow, error: parentError } = await writer
      .from('parent_profiles')
      .select('id')
      .eq('id', parentId)
      .maybeSingle();
    if (parentError) {
      throw new Error(`Unable to verify parent profile: ${parentError.message}`);
    }
    if (!parentRow) {
      const { error: parentInsertError } = await writer
        .from('parent_profiles')
        .insert({ id: parentId, full_name: fullName ?? first });
      if (parentInsertError) {
        throw new Error(`Unable to provision parent profile placeholder: ${parentInsertError.message}`);
      }
    }

    const insertPayload: Record<string, unknown> = {
      id: studentId,
      parent_id: parentId,
      first_name: first,
      last_name: last,
      grade_level: gradeLevel,
    };
    if (resolvedGradeBand) {
      insertPayload.grade_band = resolvedGradeBand;
    }
    if (ageYears != null) {
      insertPayload.age_years = ageYears;
    }

    const { error: insertError } = await writer.from('student_profiles').insert(insertPayload);
    if (insertError) {
      throw new Error(`Unable to provision student profile: ${insertError.message}`);
    }
  } else {
    const updates: Record<string, unknown> = {};
    if (resolvedGradeBand) {
      updates.grade_band = resolvedGradeBand;
    }
    if (gradeLevel) {
      updates.grade_level = gradeLevel;
    }
    if (ageYears != null) {
      updates.age_years = ageYears;
    }
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await writer.from('student_profiles').update(updates).eq('id', studentId);
      if (updateError) {
        throw new Error(`Unable to update student profile: ${updateError.message}`);
      }
    }
  }

  if (fullName) {
    const { error: nameUpdateError } = await writer
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', studentId);
    if (nameUpdateError) {
      console.warn('[placement] Unable to persist full name', nameUpdateError);
    }
  }

  // Ensure preferences exist and reflect the latest onboarding selections.
  const preferenceUpdates: Record<string, unknown> = {};
  if (options?.avatarId) preferenceUpdates.avatar_id = options.avatarId;
  if (options?.tutorPersonaId) preferenceUpdates.tutor_persona_id = options.tutorPersonaId;
  if (typeof options?.optInAi === 'boolean') preferenceUpdates.opt_in_ai = options.optInAi;

  if (Object.keys(preferenceUpdates).length > 0) {
    try {
      await updateStudentPreferences(supabase, studentId, preferenceUpdates);
    } catch (prefError) {
      console.warn('[placement] Unable to update student preferences', prefError);
    }
  } else {
    await getStudentPreferences(supabase, studentId);
  }
};

const findPlacementAssessmentId = async (
  supabase: SupabaseClient,
  targetGradeBand: string,
  subject?: string | null,
  targetLevel?: number | null,
  goalFocus?: string | null,
): Promise<number | null> => {
  const { data, error } = await supabase
    .from('assessments')
    .select('id, module_id, metadata, created_at')
    .is('module_id', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Unable to read assessments: ${error.message}`);
  }

  const id = selectPlacementAssessmentId((data ?? []) as Array<{ id: number; module_id: number | null; created_at?: string | null; metadata: Record<string, unknown> | null }>, {
    targetGradeBand,
    subjectKey: subject,
    targetLevel,
    goalFocus,
  });
  return id;
};

const loadPlacementQuestions = async (
  supabase: SupabaseClient,
  assessmentId: number,
): Promise<{ questions: PlacementQuestion[]; validation: { invalidReasons: Array<{ bankQuestionId: number; reason: string }>; filteredOutCount: number } }> => {
  const { data: sectionRows, error: sectionError } = await supabase
    .from('assessment_sections')
    .select('id, section_order')
    .eq('assessment_id', assessmentId)
    .order('section_order', { ascending: true });

  if (sectionError) {
    throw new Error(`Unable to load assessment sections: ${sectionError.message}`);
  }

  const sectionOrderById = new Map<number, number>();
  (sectionRows ?? []).forEach((row) => {
    sectionOrderById.set(row.id as number, (row.section_order as number | null | undefined) ?? 0);
  });

  const sectionIds = (sectionRows ?? []).map((section) => section.id as number);
  if (!sectionIds.length) {
    throw new HttpError(409, 'Placement assessment is missing sections.', 'placement_content_missing');
  }

  const { data: links, error: linkError } = await supabase
    .from('assessment_questions')
    .select('question_id, section_id, question_order, weight, metadata')
    .in('section_id', sectionIds)
    .order('question_order', { ascending: true });

  if (linkError) {
    throw new Error(`Unable to load assessment questions: ${linkError.message}`);
  }

  const questionLinks = (links ?? []) as Array<{
    question_id: number;
    section_id: number;
    question_order: number;
    weight: number | null;
    metadata: Record<string, unknown> | null;
  }>;

  const questionIds = Array.from(new Set(questionLinks.map((link) => link.question_id)));
  if (!questionIds.length) {
    throw new HttpError(409, 'Placement assessment has no questions configured.', 'placement_content_missing');
  }

  const [questionBankResult, optionsResult, skillsResult] = await Promise.all([
    supabase
      .from('question_bank')
      .select('id, prompt, question_type, difficulty, solution_explanation, metadata, tags')
      .in('id', questionIds),
    supabase
      .from('question_options')
      .select('id, question_id, option_order, content, is_correct, feedback')
      .in('question_id', questionIds)
      .order('option_order', { ascending: true }),
    supabase
      .from('question_skills')
      .select('question_id, skill_id, skills ( name )')
      .in('question_id', questionIds),
  ]);

  if (questionBankResult.error) {
    throw new Error(`Failed to load assessment questions: ${questionBankResult.error.message}`);
  }
  if (optionsResult.error) {
    throw new Error(`Failed to load assessment options: ${optionsResult.error.message}`);
  }
  if (skillsResult.error) {
    console.warn('[placement] Unable to load question skill mappings', skillsResult.error);
  }

  const bankLookup = new Map<number, QuestionBankRow>();
  (questionBankResult.data ?? []).forEach((row) => {
    bankLookup.set(row.id as number, row as QuestionBankRow);
  });

  const optionLookup = new Map<number, PlacementQuestion['options']>();
  (optionsResult.data ?? []).forEach((row) => {
    const optionRow = row as { id: number; question_id: number; content: string; is_correct: boolean; feedback?: string | null };
    const list = optionLookup.get(optionRow.question_id) ?? [];
    list.push({
      id: optionRow.id,
      text: optionRow.content,
      isCorrect: optionRow.is_correct,
      feedback: optionRow.feedback ?? null,
    });
    optionLookup.set(optionRow.question_id, list);
  });

  const skillLookup = new Map<number, { id: number; name: string | null }[]>();
  (skillsResult.data ?? []).forEach((row) => {
    const skillRow = row as { question_id: number; skill_id: number; skills?: { name?: string | null } | null };
    const list = skillLookup.get(skillRow.question_id) ?? [];
    list.push({ id: skillRow.skill_id, name: skillRow.skills?.name ?? null });
    skillLookup.set(skillRow.question_id, list);
  });

  const questions = questionLinks
    .map((link, index) => {
      const bankQuestion = bankLookup.get(link.question_id);
      if (!bankQuestion) return null;
      const metadata = (bankQuestion.metadata ?? {}) as Record<string, unknown>;
      const tags = Array.isArray(bankQuestion.tags) ? (bankQuestion.tags as string[]) : [];
      const strand =
        (metadata.strand as string | undefined) ??
        (link.metadata?.strand as string | undefined) ??
        (tags.length ? tags[0] : null);
      const standards = Array.isArray(metadata.standards)
        ? (metadata.standards as string[])
        : Array.isArray(link.metadata?.standards)
          ? ((link.metadata?.standards as string[]) ?? [])
          : [];
      return {
        id: `q-${link.question_id}-${index + 1}`,
        bankQuestionId: link.question_id,
        prompt: bankQuestion.prompt,
        type: bankQuestion.question_type as PlacementQuestion['type'],
        options: optionLookup.get(link.question_id) ?? [],
        weight: link.weight ?? 1,
        difficulty: bankQuestion.difficulty ?? 3,
        strand: strand ?? null,
        targetStandards: standards,
        metadata: metadata,
      } satisfies PlacementQuestion;
    })
    .filter((question): question is PlacementQuestion => Boolean(question))
    .sort((a, b) => {
      const aLink = questionLinks.find((link) => link.question_id === a.bankQuestionId);
      const bLink = questionLinks.find((link) => link.question_id === b.bankQuestionId);
      const aSectionOrder = aLink ? (sectionOrderById.get(aLink.section_id) ?? 0) : 0;
      const bSectionOrder = bLink ? (sectionOrderById.get(bLink.section_id) ?? 0) : 0;
      if (aSectionOrder !== bSectionOrder) return aSectionOrder - bSectionOrder;
      return (aLink?.question_order ?? 0) - (bLink?.question_order ?? 0);
    });

  const validation = validatePlacementQuestions(questions, { assessmentId });
  return {
    questions: validation.questions as PlacementQuestion[],
    validation: { invalidReasons: validation.invalidReasons, filteredOutCount: validation.filteredOutCount },
  };
};

export const startPlacementAssessment = async (
  supabase: SupabaseClient,
  studentId: string,
  options?: {
    gradeBand?: string | null;
    gradeLevel?: number | null;
    ageYears?: number | null;
    subject?: string | null;
    itemPoolAssessmentIds?: number[] | null;
    fullName?: string | null;
    optInAi?: boolean;
    avatarId?: string | null;
    tutorPersonaId?: string | null;
    serviceSupabase?: SupabaseClient | null;
  },
): Promise<PlacementStartResult> => {
  await ensureStudentProfileProvisioned(supabase, options?.serviceSupabase ?? null, studentId, {
    gradeBand: options?.gradeBand,
    gradeLevel: options?.gradeLevel,
    ageYears: options?.ageYears,
    fullName: options?.fullName,
    optInAi: options?.optInAi,
    avatarId: options?.avatarId ?? null,
    tutorPersonaId: options?.tutorPersonaId ?? null,
  });

  const profile = await loadStudentProfile(supabase, studentId);
  const resolvedGradeBand = deriveGradeBand(profile.grade_level, options?.gradeBand ?? profile.grade_band);
  const subject = normalizeSubjectKey(options?.subject ?? null);
  const expectedLevel = deriveExpectedLevel({
    ageYears: options?.ageYears ?? profile.age_years,
    gradeLevel: options?.gradeLevel ?? profile.grade_level,
    gradeBand: resolvedGradeBand,
  });
  const runtimeConfig = await getRuntimeConfig(supabase);
  const engineVersion = resolvePlacementEngineVersion({
    config: runtimeConfig,
    subject,
    gradeBand: resolvedGradeBand,
  });

  const contentClient = options?.serviceSupabase ?? supabase;
  const requestedPoolAssessmentIds = Array.from(
    new Set((options?.itemPoolAssessmentIds ?? []).filter((id): id is number => Number.isFinite(id))),
  );
  const assessmentId = await findPlacementAssessmentId(
    contentClient,
    resolvedGradeBand,
    subject,
    expectedLevel,
    profile.preferences.goal_focus ?? null,
  );
  if (!assessmentId) {
    throw new HttpError(
      404,
      'No placement assessment is available for your grade band yet.',
      'placement_assessment_missing',
      { gradeBand: resolvedGradeBand },
    );
  }

  const { data: assessmentSnapshot, error: assessmentSnapshotError } = await contentClient
    .from('assessments')
    .select('id, module_id, metadata')
    .eq('id', assessmentId)
    .maybeSingle();

  if (assessmentSnapshotError) {
    console.warn('[placement] Unable to load assessment metadata snapshot', assessmentSnapshotError);
  }

  const { data: lastAttempt, error: lastAttemptError } = await supabase
    .from('student_assessment_attempts')
    .select('id, attempt_number, status, metadata')
    .eq('student_id', studentId)
    .eq('assessment_id', assessmentId)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastAttemptError) {
    throw new Error(`Unable to read prior attempts: ${lastAttemptError.message}`);
  }

  const lastAttemptNumber = (lastAttempt?.attempt_number as number | undefined) ?? 0;
  const hasInProgress = (lastAttempt?.status as string | null) === 'in_progress';
  const attemptNumber = hasInProgress ? lastAttemptNumber : lastAttemptNumber + 1;

  let attemptId = (lastAttempt?.id as number | null | undefined) ?? null;
  let activeAttemptMetadata = (lastAttempt?.metadata as PlacementAttemptMetadata | null | undefined) ?? null;

  if (!attemptId || !hasInProgress) {
    let attemptMetadata: Record<string, unknown> = {
      source: 'placement',
      ...buildLegacyDiagnosticTrace({
        subject,
        gradeBand: resolvedGradeBand,
        expectedLevel,
        phase: 'start',
      }),
    };

    if (engineVersion === CAT_V2_ENGINE_VERSION && subject) {
      const catPool =
        requestedPoolAssessmentIds.length > 0
          ? { assessmentIds: requestedPoolAssessmentIds, questions: await loadPlacementQuestionPool(contentClient, requestedPoolAssessmentIds) }
          : await findCatPlacementPool(contentClient, subject);
      const initialSummary = buildCatPlacementSummary({
        itemPool: catPool.questions,
        priorLevelHint: expectedLevel,
        responses: [],
      });
      attemptMetadata = {
        source: 'placement',
        ...buildCatDiagnosticTrace({
          subject,
          gradeBand: resolvedGradeBand,
          expectedLevel,
          summary: initialSummary,
          itemPoolAssessmentIds: catPool.assessmentIds,
          phase: 'start',
        }),
      };
    }
    activeAttemptMetadata = attemptMetadata as PlacementAttemptMetadata;

    const { data: attempt, error: attemptError } = await supabase
      .from('student_assessment_attempts')
      .insert({
        student_id: studentId,
        assessment_id: assessmentId,
        attempt_number: attemptNumber,
        status: 'in_progress',
        metadata: attemptMetadata,
      })
      .select('id')
      .maybeSingle();

    if (attemptError || !attempt?.id) {
      throw new Error(`Unable to start placement attempt: ${attemptError?.message ?? 'unknown error'}`);
    }

    attemptId = attempt.id as number;
  }

  if (engineVersion === CAT_V2_ENGINE_VERSION && subject) {
    const attemptMetadata = activeAttemptMetadata;
    const assessmentIds = readNumberList(attemptMetadata?.item_pool_assessment_ids);
    const catPool =
      assessmentIds.length > 0
        ? { assessmentIds, questions: await loadPlacementQuestionPool(contentClient, assessmentIds) }
        : await findCatPlacementPool(contentClient, subject);
    const questionMap = new Map<number, PlacementQuestion>();
    catPool.questions.forEach((question) => questionMap.set(question.bankQuestionId, question));

    let responseRows: StoredAssessmentResponseRow[] = [];
    try {
      responseRows = await loadAssessmentResponsesByAttempt(supabase, attemptId);
    } catch (responseError) {
      console.warn('[placement] Unable to hydrate CAT responses', responseError);
    }

    const sortedResponses = sortCatResponseRows(
      responseRows,
    );
    const existingResponses: PlacementStartResult['existingResponses'] = sortedResponses.map((row) => ({
      questionId: row.question_id as number,
      selectedOptionId: (row.selected_option_id as number | null | undefined) ?? null,
      isCorrect: (row.is_correct as boolean | null | undefined) ?? null,
    }));
    const summary = buildCatPlacementSummary({
      itemPool: catPool.questions,
      priorLevelHint: expectedLevel,
      responses: sortedResponses.map(
        (row) =>
          ({
            bankQuestionId: row.question_id as number,
            isCorrect: Boolean(row.is_correct),
          }) satisfies CatPlacementResponse,
      ),
    });
    const resumeToken = Buffer.from(`${studentId}:${attemptId}`).toString('base64');

    return {
      assessmentId,
      attemptId,
      attemptNumber,
      gradeBand: resolvedGradeBand,
      subject,
      expectedLevel,
      engineVersion,
      resumeToken,
      items: buildCatDisplayItems(questionMap, summary),
      existingResponses,
    };
  }

  let questions: PlacementQuestion[] = [];
  let validationSnapshot: { invalidReasons: Array<{ bankQuestionId: number; reason: string }>; filteredOutCount: number } | null =
    null;
  try {
    const loaded = await loadPlacementQuestions(contentClient, assessmentId);
    questions = loaded.questions;
    validationSnapshot = loaded.validation;
  } catch (error) {
    if (error instanceof HttpError && error.code === 'placement_content_invalid') {
      recordOpsEvent({
        type: 'placement_content_invalid',
        label: String(assessmentId),
        reason: error.code,
        metadata: {
          assessmentId,
          gradeBand: resolvedGradeBand,
          moduleId: (assessmentSnapshot?.module_id as number | null | undefined) ?? null,
          purpose: ((assessmentSnapshot?.metadata as Record<string, unknown> | null | undefined)?.purpose as string | undefined) ?? null,
          details: error.details ?? null,
        },
      });
      raiseAlert('placement_zero_valid_questions', {
        assessmentId,
        gradeBand: resolvedGradeBand,
        moduleId: (assessmentSnapshot?.module_id as number | null | undefined) ?? null,
        purpose: ((assessmentSnapshot?.metadata as Record<string, unknown> | null | undefined)?.purpose as string | undefined) ?? null,
      });
    }
    throw error;
  }

  recordOpsEvent({
    type: 'placement_selected',
    label: String(assessmentId),
    metadata: {
      assessmentId,
      gradeBand: resolvedGradeBand,
      moduleId: (assessmentSnapshot?.module_id as number | null | undefined) ?? null,
      purpose: ((assessmentSnapshot?.metadata as Record<string, unknown> | null | undefined)?.purpose as string | undefined) ?? null,
      totalQuestions: questions.length,
      skippedCount: validationSnapshot?.filteredOutCount ?? null,
      invalidCount: validationSnapshot?.invalidReasons.length ?? null,
    },
  });

  const { data: responseRows, error: responseError } = await supabase
    .from('student_assessment_responses')
    .select('question_id, selected_option_id, is_correct')
    .eq('attempt_id', attemptId);

  if (responseError) {
    console.warn('[placement] Unable to hydrate previous responses', responseError);
  }

  const existingResponses: PlacementStartResult['existingResponses'] = [];
  (responseRows ?? []).forEach((row) => {
    existingResponses.push({
      questionId: row.question_id as number,
      selectedOptionId: (row.selected_option_id as number | null | undefined) ?? null,
      isCorrect: (row.is_correct as boolean | null | undefined) ?? null,
    });
  });

  const resumeToken = Buffer.from(`${studentId}:${attemptId}`).toString('base64');

  return {
    assessmentId,
    attemptId,
    attemptNumber,
    gradeBand: resolvedGradeBand,
    subject,
    expectedLevel,
    engineVersion,
    resumeToken,
    items: questions,
    existingResponses,
  };
};

/**
 * Expand a grade band like '3-5' into individual grade strings ['3', '4', '5']
 * Also handles single grades like '4' -> ['4']
 */
const expandGradeBand = (gradeBand: string): string[] => {
  const normalized = gradeBand.trim();

  // Handle K-2 format
  if (normalized.toLowerCase() === 'k-2' || normalized.toLowerCase() === 'k') {
    return ['K', '1', '2'];
  }

  // Handle range format like '3-5', '6-8', '9-12'
  const rangeMatch = normalized.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = Number.parseInt(rangeMatch[1]!, 10);
    const end = Number.parseInt(rangeMatch[2]!, 10);
    const grades: string[] = [];
    for (let i = start; i <= end; i++) {
      grades.push(String(i));
    }
    return grades;
  }

  // Handle single grade number
  const numericGrade = Number.parseInt(normalized, 10);
  if (Number.isFinite(numericGrade) && numericGrade >= 1 && numericGrade <= 12) {
    return [String(numericGrade)];
  }

  // Fallback: return as-is
  return [normalized];
};

const fetchCanonicalSequence = async (
  supabase: SupabaseClient,
  gradeBand: string,
  subject: string | null,
  limit: number,
  gradeLevel?: number | null,
): Promise<CanonicalSequenceItem[]> => {
  const { data, error } = await supabase
    .from('learning_sequences')
    .select('position, module_id, module_slug, module_title, subject, standard_codes, metadata')
    .eq('grade_band', gradeBand)
    .order('position', { ascending: true });

  if (error) {
    throw new Error(`Unable to read learning sequences: ${error.message}`);
  }

  const exactSequence = (data ?? []).filter((row) => subjectMatches(row.subject as string | null | undefined, subject));
  if (exactSequence.length > 0) {
    return exactSequence.slice(0, limit).map((row) => ({
      position: row.position as number,
      module_id: (row.module_id as number | null | undefined) ?? null,
      module_slug: (row.module_slug as string | null | undefined) ?? null,
      module_title: (row.module_title as string | null | undefined) ?? null,
      subject: (row.subject as string | null | undefined) ?? null,
      standard_codes: (row.standard_codes as string[] | null | undefined) ?? null,
      metadata: (row.metadata as Record<string, unknown> | null | undefined) ?? null,
    }));
  }

  // Expand the grade band to individual grades (e.g., '3-5' -> ['3', '4', '5'])
  const expandedGrades = expandGradeBand(gradeBand);

  // Prioritize the student's exact grade level if available
  let orderedGrades = [...expandedGrades];
  if (gradeLevel != null && gradeLevel >= 1 && gradeLevel <= 12) {
    const exactGrade = String(gradeLevel);
    // Put exact grade first, then others
    orderedGrades = [exactGrade, ...expandedGrades.filter(g => g !== exactGrade)];
  }

  // Try to find modules matching any of the expanded grades
  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select('id, slug, title, grade_band, subject')
    .in('grade_band', orderedGrades)
    .order('id', { ascending: true })
    .limit(limit * 20);

  if (modulesError) {
    throw new Error(`Unable to read fallback modules: ${modulesError.message}`);
  }

  const subjectFilteredModules = (modules ?? []).filter((module) =>
    subjectMatches(module.subject as string | null | undefined, subject),
  );

  if (subjectFilteredModules.length > 0) {
    // Sort to prioritize exact grade level, then by grade closeness
    const targetGrade = gradeLevel ?? gradeBandToLevel(gradeBand) ?? 5;
    const sorted = [...subjectFilteredModules].sort((a, b) => {
      const aGrade = Number.parseInt(a.grade_band ?? '0', 10) || 0;
      const bGrade = Number.parseInt(b.grade_band ?? '0', 10) || 0;
      const aDist = Math.abs(aGrade - targetGrade);
      const bDist = Math.abs(bGrade - targetGrade);
      return aDist - bDist;
    });

    return sorted.slice(0, limit).map((module, index) => ({
      position: index + 1,
      module_id: module.id as number,
      module_slug: (module.slug as string | null | undefined) ?? null,
      module_title: (module.title as string | null | undefined) ?? null,
      subject: (module.subject as string | null | undefined) ?? null,
      standard_codes: [],
      metadata: null,
    }));
  }

  // Ultimate fallback: try any modules if none found for the grade band
  console.warn(`[learningPaths] No modules found for grade band ${gradeBand}, expanding search`);
  const { data: fallbackModules } = await supabase
    .from('modules')
    .select('id, slug, title, grade_band, subject')
    .order('id', { ascending: true })
    .limit(limit * 20);

  const broadFallback = (fallbackModules ?? []).filter((module) =>
    subjectMatches(module.subject as string | null | undefined, subject),
  );

  return broadFallback.slice(0, limit).map((module, index) => ({
    position: index + 1,
    module_id: module.id as number,
    module_slug: (module.slug as string | null | undefined) ?? null,
    module_title: (module.title as string | null | undefined) ?? null,
    subject: (module.subject as string | null | undefined) ?? null,
    standard_codes: [],
    metadata: null,
  }));
};

const readPlacementGapLevel = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampWorkingLevel(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed)) {
      return clampWorkingLevel(parsed);
    }
  }
  return null;
};

const readPlacementGapConfidence = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, Number(value.toFixed(2))));
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(1, Number(parsed.toFixed(2))));
    }
  }
  return null;
};

const readPlacementPrerequisiteGaps = (value: unknown): PlacementPrerequisiteGap[] => {
  if (!Array.isArray(value)) return [];

  const gaps = value
    .map((entry) => {
      const record = entry as Record<string, unknown> | null;
      const standardCode =
        typeof record?.standardCode === 'string'
          ? record.standardCode.trim()
          : typeof record?.standard_code === 'string'
            ? record.standard_code.trim()
            : '';
      if (!standardCode) {
        return null;
      }

      return {
        standardCode,
        observedLevel: readPlacementGapLevel(record?.observedLevel ?? record?.observed_level ?? null),
        confidence: readPlacementGapConfidence(record?.confidence ?? null),
      } satisfies PlacementPrerequisiteGap;
    })
    .filter((entry): entry is PlacementPrerequisiteGap => Boolean(entry));

  return Array.from(new Map(gaps.map((gap) => [gap.standardCode, gap])).values());
};

const normalizeStandardCode = (value: string): string => value.trim().toUpperCase();

const buildStandardDependencyKeys = (value: string): string[] => {
  const normalized = normalizeStandardCode(value);
  if (!normalized) return [];

  const segments = normalized.split('.').filter(Boolean);
  if (segments.length === 0) return [];

  const keys = new Set<string>([normalized]);
  const first = segments[0] ?? '';
  const second = segments[1] ?? '';
  const third = segments[2] ?? '';

  if (/^\d+$/.test(first) && second) {
    keys.add(`DOMAIN:${second}`);
    if (third) {
      keys.add(`CLUSTER:${second}.${third}`);
      keys.add(`GRADE_DOMAIN:${first}.${second}`);
    }
  } else if (/^[A-Z]+$/.test(first)) {
    keys.add(`STRAND:${first}`);
    if (/^\d+$/.test(second)) {
      keys.add(`GRADE_STRAND:${first}.${second}`);
    }
  }

  return Array.from(keys);
};

const scoreStandardDependencyMatch = (gapCode: string, sequenceCode: string): number => {
  const normalizedGap = normalizeStandardCode(gapCode);
  const normalizedSequence = normalizeStandardCode(sequenceCode);
  if (!normalizedGap || !normalizedSequence) return 0;
  if (normalizedGap === normalizedSequence) return 4;

  const gapKeys = new Set(buildStandardDependencyKeys(normalizedGap));
  const sequenceKeys = new Set(buildStandardDependencyKeys(normalizedSequence));
  if (Array.from(gapKeys).some((key) => key.startsWith('CLUSTER:') && sequenceKeys.has(key))) return 3;
  if (Array.from(gapKeys).some((key) => key.startsWith('GRADE_DOMAIN:') && sequenceKeys.has(key))) return 2;
  if (
    Array.from(gapKeys).some(
      (key) => (key.startsWith('DOMAIN:') || key.startsWith('STRAND:')) && sequenceKeys.has(key),
    )
  ) {
    return 1;
  }

  return 0;
};

const getExplicitSequenceDependencyCodes = (sequenceItem: CanonicalSequenceItem): string[] =>
  normalizeStandards(
    sequenceItem.metadata?.prerequisite_standard_codes ??
      sequenceItem.metadata?.depends_on_standard_codes ??
      sequenceItem.metadata?.dependency_standard_codes ??
      [],
  );

const findSequenceAnchorIndexForGap = (sequence: CanonicalSequenceItem[], gapCode: string): number => {
  let bestExplicitIndex = -1;
  let bestExplicitScore = 0;
  let bestIndex = -1;
  let bestScore = 0;

  sequence.forEach((sequenceItem, index) => {
    const explicitScore = Math.max(
      0,
      ...getExplicitSequenceDependencyCodes(sequenceItem).map((sequenceCode) => scoreStandardDependencyMatch(gapCode, sequenceCode)),
    );
    if (explicitScore > bestExplicitScore) {
      bestExplicitScore = explicitScore;
      bestExplicitIndex = index;
    }

    const itemScore = Math.max(
      0,
      ...(sequenceItem.standard_codes ?? []).map((sequenceCode) => scoreStandardDependencyMatch(gapCode, sequenceCode)),
    );

    if (itemScore > bestScore) {
      bestScore = itemScore;
      bestIndex = index;
    }
  });

  if (bestExplicitIndex >= 0) {
    return bestExplicitIndex;
  }

  return bestIndex;
};

const loadPlacementRemediationModules = async (
  supabase: SupabaseClient,
  params: {
    subject: string | null;
    workingLevel: number | null;
    prerequisiteGaps: PlacementPrerequisiteGap[];
    preferredModuleSlugs: string[];
    canonicalSequence: CanonicalSequenceItem[];
  },
): Promise<PlacementRemediationModule[]> => {
  if (!params.prerequisiteGaps.length) {
    return [];
  }

  const { data: standardRows, error: standardsError } = await supabase
    .from('standards')
    .select('id, code')
    .in(
      'code',
      params.prerequisiteGaps.map((gap) => gap.standardCode),
    );

  if (standardsError) {
    throw new Error(`Unable to resolve prerequisite gap standards: ${standardsError.message}`);
  }

  const standardIdToCode = new Map<number, string>();
  for (const row of standardRows ?? []) {
    const id = typeof row.id === 'number' ? row.id : null;
    const code = typeof row.code === 'string' ? row.code.trim() : '';
    if (id != null && code) {
      standardIdToCode.set(id, code);
    }
  }

  if (!standardIdToCode.size) {
    return [];
  }

  const { data: moduleStandardRows, error: moduleStandardsError } = await supabase
    .from('module_standards')
    .select('module_id, standard_id')
    .in('standard_id', Array.from(standardIdToCode.keys()));

  if (moduleStandardsError) {
    throw new Error(`Unable to resolve remediation module mappings: ${moduleStandardsError.message}`);
  }

  const moduleIds = Array.from(
    new Set(
      (moduleStandardRows ?? [])
        .map((row) => (typeof row.module_id === 'number' ? row.module_id : null))
        .filter((value): value is number => value != null),
    ),
  );

  if (!moduleIds.length) {
    return [];
  }

  const { data: moduleRows, error: modulesError } = await supabase
    .from('modules')
    .select('id, slug, title, grade_band, subject')
    .in('id', moduleIds);

  if (modulesError) {
    throw new Error(`Unable to load remediation modules: ${modulesError.message}`);
  }

  const candidateModules = (moduleRows ?? [])
    .map((row) => ({
      id: row.id as number,
      slug: (row.slug as string | null | undefined) ?? null,
      title: (row.title as string | null | undefined) ?? null,
      gradeBand: (row.grade_band as string | null | undefined) ?? null,
      subject: normalizeSubjectKey((row.subject as string | null | undefined) ?? null),
    }))
    .filter((row) => subjectMatches(row.subject, params.subject))
    .filter((row) => {
      if (params.workingLevel == null) return true;
      const candidateLevel = gradeBandToLevel(row.gradeBand);
      return candidateLevel == null || candidateLevel <= params.workingLevel;
    });

  if (!candidateModules.length) {
    return [];
  }

  const standardCodesByModuleId = new Map<number, Set<string>>();
  for (const row of moduleStandardRows ?? []) {
    const moduleId = typeof row.module_id === 'number' ? row.module_id : null;
    const standardId = typeof row.standard_id === 'number' ? row.standard_id : null;
    const code = standardId != null ? standardIdToCode.get(standardId) ?? null : null;
    if (moduleId == null || !code) continue;
    const codes = standardCodesByModuleId.get(moduleId) ?? new Set<string>();
    codes.add(code);
    standardCodesByModuleId.set(moduleId, codes);
  }

  const preferredOrder = new Map(params.preferredModuleSlugs.map((slug, index) => [slug, index] as const));
  const existingSequenceModuleIds = new Set(
    params.canonicalSequence
      .map((item) => item.module_id)
      .filter((value): value is number => typeof value === 'number'),
  );
  const chosenModuleIds = new Set<number>();
  const remediationModules: PlacementRemediationModule[] = [];

  for (const gap of params.prerequisiteGaps) {
    const rankedCandidates = candidateModules
      .filter((module) => standardCodesByModuleId.get(module.id)?.has(gap.standardCode))
      .filter((module) => !existingSequenceModuleIds.has(module.id))
      .filter((module) => !chosenModuleIds.has(module.id))
      .sort((left, right) => {
        const leftPreferred = preferredOrder.get(left.slug ?? '') ?? Number.MAX_SAFE_INTEGER;
        const rightPreferred = preferredOrder.get(right.slug ?? '') ?? Number.MAX_SAFE_INTEGER;
        if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred;

        const targetLevel = gap.observedLevel ?? params.workingLevel;
        const leftDistance = targetLevel == null ? 0 : Math.abs((gradeBandToLevel(left.gradeBand) ?? targetLevel) - targetLevel);
        const rightDistance = targetLevel == null ? 0 : Math.abs((gradeBandToLevel(right.gradeBand) ?? targetLevel) - targetLevel);
        if (leftDistance !== rightDistance) return leftDistance - rightDistance;

        return left.id - right.id;
      });

    const selected = rankedCandidates[0];
    if (!selected) {
      continue;
    }

    remediationModules.push({
      gap,
      moduleId: selected.id,
      moduleSlug: selected.slug,
      moduleTitle: selected.title,
      subject: selected.subject,
    });
    chosenModuleIds.add(selected.id);

    if (remediationModules.length >= MAX_PLACEMENT_REMEDIATION_INSERTS) {
      break;
    }
  }

  return remediationModules;
};


export const buildStudentPath = async (
  supabase: SupabaseClient,
  studentId: string,
  options?: PathBuildOptions,
): Promise<{ pathId: number; entries: PathEntry[] }> => {
  const profile = await loadStudentProfile(supabase, studentId);
  const subject = normalizeSubjectKey(options?.subject ?? null);
  const gradeBand =
    options?.workingLevel != null
      ? String(options.workingLevel)
      : deriveGradeBand(profile.grade_level, options?.gradeBand ?? profile.grade_band);

  let pauseQuery = supabase
    .from('student_paths')
    .update({ status: 'paused' })
    .eq('student_id', studentId)
    .eq('status', 'active');
  if (subject) {
    pauseQuery = pauseQuery.eq('subject', subject);
  }

  const { error: pauseError } = await pauseQuery;

  if (pauseError) {
    throw new Error(`Unable to pause existing paths: ${pauseError.message}`);
  }

  const { data: pathRow, error: pathError } = await supabase
    .from('student_paths')
    .insert({
      student_id: studentId,
      subject,
      status: 'active',
      metadata: {
        source: options?.source ?? 'placement',
        subject,
        grade_band: gradeBand,
        working_level: options?.workingLevel ?? null,
        goal_focus: options?.goalFocus ?? profile.preferences.goal_focus ?? null,
        ...(options?.metadata ?? {}),
      },
    })
    .select('id')
    .maybeSingle();

  if (pathError || !pathRow?.id) {
    throw new Error(`Unable to create learning path: ${pathError?.message ?? 'unknown error'}`);
  }

  const sequence = await fetchCanonicalSequence(
    supabase,
    gradeBand,
    subject,
    options?.limit ?? 12,
    options?.workingLevel ?? profile.grade_level,
  );

  const prerequisiteGaps = readPlacementPrerequisiteGaps(options?.metadata?.prerequisite_gaps);
  const remediationModules = await loadPlacementRemediationModules(supabase, {
    subject,
    workingLevel: options?.workingLevel ?? profile.grade_level ?? null,
    prerequisiteGaps,
    preferredModuleSlugs: options?.preferredModuleSlugs ?? [],
    canonicalSequence: sequence,
  });

  const lessonPlan = sequence.map((item) => ({
    type: 'lesson',
    moduleId: item.module_id,
    moduleSlug: item.module_slug,
    moduleTitle: item.module_title,
    subject: subject ?? normalizeSubjectKey(item.subject ?? null),
    targetStandardCodes: item.standard_codes ?? [],
    metadata: {
      module_slug: item.module_slug,
      module_title: item.module_title,
      subject: subject ?? normalizeSubjectKey(item.subject ?? null),
      source: options?.source ?? 'placement',
    },
  }));

  const leadingRemediationPlan: Array<{
    type: string;
    moduleId: number;
    moduleSlug: string | null;
    moduleTitle: string | null;
    subject: string | null;
    targetStandardCodes: string[];
    metadata: Record<string, unknown>;
  }> = [];
  const anchoredRemediationPlan = new Map<
    number,
    Array<{
      type: string;
      moduleId: number;
      moduleSlug: string | null;
      moduleTitle: string | null;
      subject: string | null;
      targetStandardCodes: string[];
      metadata: Record<string, unknown>;
    }>
  >();

  remediationModules.forEach((item) => {
    const remediationEntry = {
      type: 'review',
      moduleId: item.moduleId,
      moduleSlug: item.moduleSlug,
      moduleTitle: item.moduleTitle,
      subject: subject ?? item.subject,
      targetStandardCodes: [item.gap.standardCode],
      metadata: {
        module_slug: item.moduleSlug,
        module_title: item.moduleTitle,
        subject: subject ?? item.subject,
        source: options?.source ?? 'placement',
        reason: 'remediation',
        gap_standard_code: item.gap.standardCode,
        gap_observed_level: item.gap.observedLevel,
        gap_confidence: item.gap.confidence,
      },
    };

    const anchorIndex = findSequenceAnchorIndexForGap(sequence, item.gap.standardCode);
    if (anchorIndex < 0) {
      leadingRemediationPlan.push(remediationEntry);
      return;
    }

    const anchoredEntries = anchoredRemediationPlan.get(anchorIndex) ?? [];
    anchoredEntries.push(remediationEntry);
    anchoredRemediationPlan.set(anchorIndex, anchoredEntries);
  });

  const entryPlan = [...leadingRemediationPlan];
  lessonPlan.forEach((lessonEntry, index) => {
    const anchoredEntries = anchoredRemediationPlan.get(index);
    if (anchoredEntries?.length) {
      entryPlan.push(...anchoredEntries);
    }
    entryPlan.push(lessonEntry);
  });

  const entries = entryPlan.map((item, index) => ({
    path_id: pathRow.id as number,
    position: index + 1,
    type: item.type,
    module_id: item.moduleId,
    lesson_id: null,
    assessment_id: null,
    status: 'not_started',
    target_standard_codes: item.targetStandardCodes,
    metadata: item.metadata,
  }));

  if (entries.length > 0) {
    const { error: entryError } = await supabase.from('student_path_entries').insert(entries);
    if (entryError) {
      throw new Error(`Unable to seed path entries: ${entryError.message}`);
    }
  }

  const { data: entryRows, error: entryQueryError } = await supabase
    .from('student_path_entries')
    .select('id, path_id, position, type, module_id, lesson_id, assessment_id, status, score, time_spent_s, target_standard_codes, metadata, created_at, updated_at')
    .eq('path_id', pathRow.id)
    .order('position');

  if (entryQueryError) {
    throw new Error(`Unable to read path entries: ${entryQueryError.message}`);
  }

  return {
    pathId: pathRow.id as number,
    entries: (entryRows as PathEntry[]) ?? [],
  };
};

const readPlacementLevel = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampWorkingLevel(value);
  }
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return clampWorkingLevel(parsed);
    }
  }
  return null;
};

const getQuestionPlacementLevel = (question: PlacementQuestion, fallbackLevel: number): number => {
  const metadata = (question.metadata ?? {}) as Record<string, unknown>;
  return (
    readPlacementLevel(metadata.placement_level) ??
    readPlacementLevel(metadata.placementLevel) ??
    readPlacementLevel(metadata.target_level) ??
    fallbackLevel
  );
};

const getPreferredModuleSlugs = (
  responsesForScoring: Array<{ question: PlacementQuestion; isCorrect: boolean }>,
): string[] => {
  const moduleWeights = new Map<string, number>();

  const addWeight = (slug: string | null | undefined, weight: number) => {
    if (!slug || !slug.trim().length) return;
    moduleWeights.set(slug, (moduleWeights.get(slug) ?? 0) + weight);
  };

  responsesForScoring.forEach(({ question, isCorrect }) => {
    const placement = ((question.metadata as Record<string, unknown> | null | undefined)?.placement ??
      null) as Record<string, unknown> | null;
    const key = isCorrect ? 'on_mastery' : 'on_miss';
    const slugs = Array.isArray(placement?.[key]) ? (placement?.[key] as string[]) : [];
    slugs.forEach((slug) => addWeight(slug, isCorrect ? 2 : 1));
  });

  return Array.from(moduleWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => slug)
    .slice(0, 6);
};

export const deriveWorkingLevelEstimate = (params: {
  responsesForScoring: Array<{ question: PlacementQuestion; isCorrect: boolean }>;
  expectedLevel: number;
}) => {
  const levelBuckets = new Map<number, { correct: number; total: number }>();
  const strandScores = new Map<string, { correct: number; total: number; standards: Set<string> }>();

  params.responsesForScoring.forEach(({ question, isCorrect }) => {
    const level = getQuestionPlacementLevel(question, params.expectedLevel);
    const levelBucket = levelBuckets.get(level) ?? { correct: 0, total: 0 };
    if (isCorrect) levelBucket.correct += 1;
    levelBucket.total += 1;
    levelBuckets.set(level, levelBucket);

    const strand = question.strand ?? 'general';
    const strandBucket = strandScores.get(strand) ?? { correct: 0, total: 0, standards: new Set<string>() };
    if (isCorrect) strandBucket.correct += 1;
    strandBucket.total += 1;
    question.targetStandards.forEach((code) => strandBucket.standards.add(code));
    strandScores.set(strand, strandBucket);
  });

  const testedLevels = Array.from(levelBuckets.entries())
    .map(([level, stats]) => ({
      level,
      correct: stats.correct,
      total: stats.total,
      accuracyPct: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    }))
    .sort((a, b) => a.level - b.level);

  const passingLevels = testedLevels.filter((entry) => entry.total >= 2 && entry.accuracyPct >= 70);
  const partialLevels = testedLevels.filter((entry) => entry.accuracyPct >= 50);

  const workingLevel =
    passingLevels.at(-1)?.level ??
    partialLevels[0]?.level ??
    testedLevels[0]?.level ??
    params.expectedLevel;

  let levelConfidence = 0.45;
  const chosenLevel = testedLevels.find((entry) => entry.level === workingLevel) ?? null;
  const higherLevel = testedLevels.find((entry) => entry.level > workingLevel) ?? null;
  if (chosenLevel && chosenLevel.total >= 3 && chosenLevel.accuracyPct >= 80 && (!higherLevel || higherLevel.accuracyPct < 60)) {
    levelConfidence = 0.85;
  } else if (chosenLevel && chosenLevel.total >= 2 && chosenLevel.accuracyPct >= 70) {
    levelConfidence = 0.65;
  }

  const strandEstimates: StrandEstimate[] = Array.from(strandScores.entries()).map(([strand, stats]) => ({
    strand,
    correct: stats.correct,
    total: stats.total,
    accuracyPct: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
  }));

  const weakStandardCodes = Array.from(strandScores.values())
    .filter((stats) => stats.total > 0 && Math.round((stats.correct / stats.total) * 100) < 60)
    .flatMap((stats) => Array.from(stats.standards))
    .filter((code, index, list) => list.indexOf(code) === index)
    .slice(0, MAX_STANDARDS_TRACKED * 2);

  return {
    workingLevel,
    levelConfidence,
    testedLevels,
    strandEstimates,
    weakStandardCodes,
  };
};

const upsertStudentSubjectState = async (
  supabase: SupabaseClient,
  payload: {
    studentId: string;
    subject: string;
    expectedLevel: number;
    workingLevel: number;
    levelConfidence: number;
    diagnosticAssessmentId: number;
    diagnosticAttemptId: number;
    strandScores: StrandEstimate[];
    weakStandardCodes: string[];
    diagnosticVersion?: string;
    priorLevelHint?: number | null;
    confidenceLow?: number | null;
    confidenceHigh?: number | null;
    prerequisiteGaps?: unknown[];
    calibrationState?: Record<string, unknown>;
    lastDiagnosticType?: string;
    recommendedModuleSlugs: string[];
    lastPathId: number | null;
    metadata?: Record<string, unknown>;
  },
): Promise<SubjectState> => {
  const supportedOptionalColumns = new Set([
    'diagnostic_version',
    'prior_level_hint',
    'confidence_low',
    'confidence_high',
    'prerequisite_gaps',
    'calibration_state',
    'last_diagnostic_type',
  ]);

  const fullRow: Record<string, unknown> = {
    student_id: payload.studentId,
    subject: payload.subject,
    expected_level: payload.expectedLevel,
    working_level: payload.workingLevel,
    level_confidence: payload.levelConfidence,
    diagnostic_version: payload.diagnosticVersion ?? LEGACY_PLACEMENT_ENGINE_VERSION,
    prior_level_hint: payload.priorLevelHint ?? payload.expectedLevel,
    confidence_low: payload.confidenceLow ?? null,
    confidence_high: payload.confidenceHigh ?? null,
    placement_status: 'completed',
    diagnostic_assessment_id: payload.diagnosticAssessmentId,
    diagnostic_attempt_id: payload.diagnosticAttemptId,
    diagnostic_completed_at: new Date().toISOString(),
    strand_scores: Object.fromEntries(
      payload.strandScores.map((strand) => [strand.strand, { correct: strand.correct, total: strand.total, accuracyPct: strand.accuracyPct }]),
    ),
    weak_standard_codes: payload.weakStandardCodes,
    prerequisite_gaps: payload.prerequisiteGaps ?? [],
    recommended_module_slugs: payload.recommendedModuleSlugs,
    last_path_id: payload.lastPathId,
    calibration_state: payload.calibrationState ?? {},
    last_diagnostic_type: payload.lastDiagnosticType ?? LEGACY_DIAGNOSTIC_TYPE,
    metadata: payload.metadata ?? {},
  };
  let row: Record<string, unknown> = { ...fullRow };

  while (true) {
    const { data, error } = await supabase
      .from('student_subject_state')
      .upsert(row, { onConflict: 'student_id,subject' })
      .select('*')
      .maybeSingle();

    if (!error && data) {
      return { ...fullRow, ...data } as SubjectState;
    }

    const missingColumn = readMissingSchemaColumn(error, 'student_subject_state');
    if (missingColumn && supportedOptionalColumns.has(missingColumn) && missingColumn in row) {
      const nextRow = { ...row };
      delete nextRow[missingColumn];
      row = nextRow;
      continue;
    }

    throw new Error(`Unable to persist student subject state: ${error?.message ?? 'unknown error'}`);
  }
};

export const submitPlacementAssessment = async (
  supabase: SupabaseClient,
  studentId: string,
  payload: {
    assessmentId: number;
    attemptId?: number | null;
    responses?: PlacementResponseInput[];
    subject?: string | null;
    goalFocus?: string | null;
    gradeBand?: string | null;
    gradeLevel?: number | null;
    ageYears?: number | null;
    fullName?: string | null;
    optInAi?: boolean;
    avatarId?: string | null;
    tutorPersonaId?: string | null;
  },
  serviceSupabase?: SupabaseClient | null,
): Promise<{
  pathId: number;
  entries: PathEntry[];
  strandEstimates: StrandEstimate[];
  score: number;
  masteryPct: number;
  subject: string | null;
  expectedLevel: number;
  workingLevel: number;
  levelConfidence: number;
  subjectState: SubjectState | null;
}> => {
  if (!payload.assessmentId) {
    throw new Error('assessmentId is required to submit placement.');
  }

  const attemptId =
    payload.attemptId ??
    (await (async () => {
      const { data, error } = await supabase
        .from('student_assessment_attempts')
        .select('id')
        .eq('student_id', studentId)
        .eq('assessment_id', payload.assessmentId)
        .order('attempt_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        throw new Error(`Unable to resolve placement attempt: ${error.message}`);
      }
      return (data?.id as number | null | undefined) ?? null;
    })());

  if (!attemptId) {
    throw new Error('No placement attempt found to submit.');
  }

  await ensureStudentProfileProvisioned(supabase, serviceSupabase ?? null, studentId, {
    gradeBand: payload.gradeBand,
    gradeLevel: payload.gradeLevel,
    ageYears: payload.ageYears,
    fullName: payload.fullName,
    optInAi: payload.optInAi,
    avatarId: payload.avatarId ?? null,
    tutorPersonaId: payload.tutorPersonaId ?? null,
  });

  const profile = await loadStudentProfile(supabase, studentId);
  const resolvedGradeBand = deriveGradeBand(profile.grade_level, payload.gradeBand ?? profile.grade_band);
  const expectedLevel = deriveExpectedLevel({
    ageYears: payload.ageYears ?? profile.age_years,
    gradeLevel: payload.gradeLevel ?? profile.grade_level,
    gradeBand: resolvedGradeBand,
  });

  const contentClient = serviceSupabase ?? supabase;
  const { data: assessmentSnapshot } = await contentClient
    .from('assessments')
    .select('metadata')
    .eq('id', payload.assessmentId)
    .maybeSingle();
  const { data: attemptSnapshot, error: attemptSnapshotError } = await supabase
    .from('student_assessment_attempts')
    .select('metadata')
    .eq('id', attemptId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (attemptSnapshotError) {
    throw new Error(`Unable to load placement attempt metadata: ${attemptSnapshotError.message}`);
  }
  const attemptMetadata = (attemptSnapshot?.metadata as PlacementAttemptMetadata | null | undefined) ?? null;
  const subject =
    normalizeSubjectKey(payload.subject ?? null) ??
    normalizeSubjectKey((assessmentSnapshot?.metadata as Record<string, unknown> | null | undefined)?.subject_key as string | undefined) ??
    normalizeSubjectKey(payload.goalFocus ?? null);

  if (isCatPlacementAttemptMetadata(attemptMetadata)) {
    const poolAssessmentIds = readNumberList(attemptMetadata?.item_pool_assessment_ids);
    const catQuestions =
      poolAssessmentIds.length > 0
        ? await loadPlacementQuestionPool(contentClient, poolAssessmentIds)
        : subject
          ? (await findCatPlacementPool(contentClient, subject)).questions
          : [];
    const catQuestionMap = new Map<number, PlacementQuestion>();
    catQuestions.forEach((question) => catQuestionMap.set(question.bankQuestionId, question));
    const priorLevelHint =
      readPlacementLevel(attemptMetadata?.prior_level_hint) ??
      readPlacementLevel(attemptMetadata?.expected_level) ??
      expectedLevel;

    if (payload.responses?.length) {
      const submittedResponsePayload = payload.responses
        .map((response, index) => {
          const question = catQuestionMap.get(response.bankQuestionId);
          if (!question) return null;
          const option = question.options.find((opt) => opt.id === response.optionId);
          const isCorrect = option ? option.isCorrect : false;
          const timeSpentSeconds =
            typeof response.timeSpentSeconds === 'number' && Number.isFinite(response.timeSpentSeconds)
              ? Math.max(1, Math.round(response.timeSpentSeconds))
              : null;
          return {
            attempt_id: attemptId,
            question_id: response.bankQuestionId,
            selected_option_id: response.optionId,
            response_content: option ? { text: option.text } : null,
            is_correct: isCorrect,
            score: isCorrect ? question.weight : 0,
            time_spent_seconds: timeSpentSeconds,
            metadata: {
              diagnostic_version: CAT_V2_ENGINE_VERSION,
              diagnostic_type: CAT_V2_DIAGNOSTIC_TYPE,
              placement_engine_version: CAT_V2_ENGINE_VERSION,
              cat_route_index: index,
              question_difficulty: question.difficulty ?? null,
              question_strand: question.strand ?? null,
              target_standards: question.targetStandards,
            },
          };
        })
        .filter((entry): entry is Record<string, unknown> => Boolean(entry));

      if (submittedResponsePayload.length) {
        try {
          await upsertAssessmentResponses(supabase, submittedResponsePayload);
        } catch (upsertError) {
          throw new Error(`Unable to save CAT submit responses: ${(upsertError as Error).message}`);
        }
      }
    }

    let savedResponses: StoredAssessmentResponseRow[];
    try {
      savedResponses = await loadAssessmentResponsesByAttempt(supabase, attemptId);
    } catch (savedError) {
      throw new Error(`Unable to load saved CAT responses: ${(savedError as Error).message}`);
    }

    const orderedSavedResponses = sortCatResponseRows(
      savedResponses,
    );

    const catSummary = buildCatPlacementSummary({
      itemPool: catQuestions,
      priorLevelHint,
      responses: orderedSavedResponses.map(
        (row) =>
          ({
            bankQuestionId: row.question_id as number,
            isCorrect: Boolean(row.is_correct),
          }) satisfies CatPlacementResponse,
      ),
    });

    if (catSummary.lowConfidence) {
      recordOpsEvent({
        type: 'cat_low_confidence',
        label: subject ?? String(payload.assessmentId),
        reason: catSummary.coverageFallbackUsed ? 'coverage_fallback' : 'uncertain_estimate',
        metadata: {
          assessmentId: payload.assessmentId,
          attemptId,
          confidenceLow: catSummary.confidenceLow,
          confidenceHigh: catSummary.confidenceHigh,
          workingLevel: catSummary.workingLevel,
          coverageFallbackUsed: catSummary.coverageFallbackUsed,
        },
      });
    }

    const responsesForScoring = orderedSavedResponses
      .map((row) => {
        const question = catQuestionMap.get(row.question_id as number);
        if (!question) return null;
        return {
          question,
          isCorrect: (row.is_correct as boolean | null | undefined) ?? false,
        };
      })
      .filter((entry): entry is { question: PlacementQuestion; isCorrect: boolean } => Boolean(entry));

    const totalWeight = responsesForScoring.reduce((sum, entry) => sum + (entry.question.weight ?? 1), 0);
    const earnedWeight = responsesForScoring.reduce(
      (sum, entry) => sum + (entry.isCorrect ? entry.question.weight ?? 1 : 0),
      0,
    );
    const masteryPct = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
    const strandEstimateSeed = deriveWorkingLevelEstimate({
      responsesForScoring,
      expectedLevel: priorLevelHint,
    });
    const strandEstimates = strandEstimateSeed.strandEstimates;
    const preferredModuleSlugs = getPreferredModuleSlugs(responsesForScoring);

    const attemptUpdate: Record<string, unknown> = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      total_score: earnedWeight,
      mastery_pct: masteryPct,
      metadata: {
        source: 'placement',
        goal_focus: payload.goalFocus ?? null,
        ...buildCatDiagnosticTrace({
          subject,
          gradeBand: resolvedGradeBand,
          expectedLevel: priorLevelHint,
          summary: {
            ...catSummary,
            terminationReason: catSummary.terminationReason ?? 'submitted',
          },
          itemPoolAssessmentIds: poolAssessmentIds,
          phase: 'complete',
        }),
        tested_levels: catSummary.testedLevels,
        strand_estimates: strandEstimates,
      },
    };

    const { error: attemptUpdateError } = await supabase
      .from('student_assessment_attempts')
      .update(attemptUpdate)
      .eq('id', attemptId);

    if (attemptUpdateError) {
      throw new Error(`Unable to complete CAT assessment attempt: ${attemptUpdateError.message}`);
    }

    await supabase.from('student_profiles').update({ assessment_completed: true }).eq('id', studentId);

    try {
      await supabase.from('student_events').insert({
        student_id: studentId,
        event_type: 'diagnostic_completed',
        payload: {
          assessment_id: payload.assessmentId,
          attempt_id: attemptId,
          subject,
          score: masteryPct,
          diagnostic_version: CAT_V2_ENGINE_VERSION,
          expected_level: priorLevelHint,
          working_level: catSummary.workingLevel,
          level_confidence: catSummary.diagnosticConfidence,
          confidence_low: catSummary.confidenceLow,
          confidence_high: catSummary.confidenceHigh,
          strand_estimates: strandEstimates,
          termination_reason: catSummary.terminationReason ?? 'submitted',
        },
        points_awarded: 0,
      });
    } catch (eventError) {
      console.warn('[placement] Unable to record CAT diagnostic event', eventError);
    }

    const pathResult = await buildStudentPath(supabase, studentId, {
      gradeBand: subject ? String(catSummary.workingLevel) : resolvedGradeBand,
      subject,
      workingLevel: subject ? catSummary.workingLevel : null,
      preferredModuleSlugs,
      goalFocus: payload.goalFocus,
      source: 'placement',
      metadata: {
        assessment_id: payload.assessmentId,
        attempt_id: attemptId,
        strand_estimates: strandEstimates,
        expected_level: priorLevelHint,
        working_level: catSummary.workingLevel,
        level_confidence: catSummary.diagnosticConfidence,
        confidence_low: catSummary.confidenceLow,
        confidence_high: catSummary.confidenceHigh,
        prerequisite_gaps: catSummary.prerequisiteGaps,
      },
    });

    const subjectState =
      subject != null
        ? await upsertStudentSubjectState(supabase, {
            studentId,
            subject,
            expectedLevel: priorLevelHint,
            workingLevel: catSummary.workingLevel,
            levelConfidence: catSummary.diagnosticConfidence,
            diagnosticAssessmentId: payload.assessmentId,
            diagnosticAttemptId: attemptId,
            strandScores: strandEstimates,
            weakStandardCodes: catSummary.weakStandardCodes,
            diagnosticVersion: CAT_V2_ENGINE_VERSION,
            priorLevelHint,
            confidenceLow: catSummary.confidenceLow,
            confidenceHigh: catSummary.confidenceHigh,
            prerequisiteGaps: catSummary.prerequisiteGaps,
            recommendedModuleSlugs: preferredModuleSlugs,
            lastPathId: pathResult.pathId,
            lastDiagnosticType: CAT_V2_DIAGNOSTIC_TYPE,
            metadata: {
              diagnostic_version: CAT_V2_ENGINE_VERSION,
              diagnostic_type: CAT_V2_DIAGNOSTIC_TYPE,
              grade_band: resolvedGradeBand,
              tested_levels: catSummary.testedLevels,
              score: masteryPct,
              item_route: catSummary.itemRoute,
            },
          })
        : null;

    try {
      const summarizedPath = pathResult.entries.slice(0, 12).map((entry) => ({
        subject,
        moduleSlug: (entry.metadata as Record<string, unknown> | null | undefined)?.module_slug ?? null,
        status: entry.status,
        type: entry.type,
        moduleTitle: (entry.metadata as Record<string, unknown> | null | undefined)?.module_title ?? null,
        workingLevel: subject ? catSummary.workingLevel : null,
      }));
      await supabase.from('student_profiles').update({ learning_path: summarizedPath }).eq('id', studentId);
    } catch (legacyError) {
      console.warn('[placement] Unable to sync CAT legacy learning_path', legacyError);
    }

    return {
      ...pathResult,
      strandEstimates,
      score: masteryPct,
      masteryPct,
      subject,
      expectedLevel: priorLevelHint,
      workingLevel: catSummary.workingLevel,
      levelConfidence: catSummary.diagnosticConfidence,
      subjectState,
    };
  }

  const { questions } = await loadPlacementQuestions(contentClient, payload.assessmentId);
  const questionMap = new Map<number, PlacementQuestion>();
  questions.forEach((question) => questionMap.set(question.bankQuestionId, question));

  const responsePayload =
    payload.responses?.map((response) => {
      const question = questionMap.get(response.bankQuestionId);
      if (!question) return null;
      const option = question.options.find((opt) => opt.id === response.optionId);
      const isCorrect = option ? option.isCorrect : false;
      const timeSpentSeconds =
        typeof response.timeSpentSeconds === 'number' && Number.isFinite(response.timeSpentSeconds)
          ? Math.max(1, Math.round(response.timeSpentSeconds))
          : null;
      return {
        attempt_id: attemptId,
        question_id: response.bankQuestionId,
        selected_option_id: response.optionId,
        response_content: option ? { text: option.text } : null,
        is_correct: isCorrect,
        score: isCorrect ? question.weight : 0,
        time_spent_seconds: timeSpentSeconds,
        metadata: {
          diagnostic_version: LEGACY_PLACEMENT_ENGINE_VERSION,
          diagnostic_type: LEGACY_DIAGNOSTIC_TYPE,
          placement_engine_version: LEGACY_PLACEMENT_ENGINE_VERSION,
          subject,
          grade_band: resolvedGradeBand,
          expected_level: expectedLevel,
          question_difficulty: question.difficulty ?? null,
          question_strand: question.strand ?? null,
          target_standards: question.targetStandards,
        },
      };
    }) ?? [];

  if (responsePayload.length) {
    const filtered = responsePayload.filter(Boolean) as Array<Record<string, unknown>>;
    if (filtered.length) {
      try {
        await upsertAssessmentResponses(supabase, filtered);
      } catch (upsertError) {
        throw new Error(`Unable to save responses: ${(upsertError as Error).message}`);
      }
    }
  }

  const { data: savedResponses, error: savedError } = await supabase
    .from('student_assessment_responses')
    .select('question_id, selected_option_id, is_correct')
    .eq('attempt_id', attemptId);

  if (savedError) {
    throw new Error(`Unable to load saved responses: ${savedError.message}`);
  }

  const responsesForScoring = (savedResponses ?? []).map((row) => {
    const question = questionMap.get(row.question_id as number);
    if (!question) return null;
    const isCorrect = (row.is_correct as boolean | null | undefined) ?? false;
    return {
      question,
      isCorrect,
    };
  }).filter((entry): entry is { question: PlacementQuestion; isCorrect: boolean } => Boolean(entry));

  const totalWeight = responsesForScoring.reduce((sum, entry) => sum + (entry.question.weight ?? 1), 0);
  const earnedWeight = responsesForScoring.reduce(
    (sum, entry) => sum + (entry.isCorrect ? entry.question.weight ?? 1 : 0),
    0,
  );
  const masteryPct = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  const workingLevelEstimate = deriveWorkingLevelEstimate({
    responsesForScoring,
    expectedLevel,
  });
  const strandEstimates = workingLevelEstimate.strandEstimates;
  const preferredModuleSlugs = getPreferredModuleSlugs(responsesForScoring);

  const attemptUpdate: Record<string, unknown> = {
    status: 'completed',
    completed_at: new Date().toISOString(),
    total_score: earnedWeight,
    mastery_pct: masteryPct,
    metadata: {
      ...buildLegacyDiagnosticTrace({
        subject,
        gradeBand: resolvedGradeBand,
        expectedLevel,
        workingLevel: workingLevelEstimate.workingLevel,
        levelConfidence: workingLevelEstimate.levelConfidence,
        phase: 'complete',
      }),
      tested_levels: workingLevelEstimate.testedLevels,
      strand_estimates: strandEstimates,
      source: 'placement',
      goal_focus: payload.goalFocus ?? null,
    },
  };

  const { error: attemptUpdateError } = await supabase
    .from('student_assessment_attempts')
    .update(attemptUpdate)
    .eq('id', attemptId);

  if (attemptUpdateError) {
    throw new Error(`Unable to complete assessment attempt: ${attemptUpdateError.message}`);
  }

  await supabase.from('student_profiles').update({ assessment_completed: true }).eq('id', studentId);

  try {
    await supabase.from('student_events').insert({
      student_id: studentId,
      event_type: 'diagnostic_completed',
      payload: {
        assessment_id: payload.assessmentId,
        attempt_id: attemptId,
        subject,
        score: masteryPct,
        diagnostic_version: LEGACY_PLACEMENT_ENGINE_VERSION,
        expected_level: expectedLevel,
        working_level: workingLevelEstimate.workingLevel,
        level_confidence: workingLevelEstimate.levelConfidence,
        strand_estimates: strandEstimates,
      },
      points_awarded: 0,
    });
  } catch (eventError) {
    console.warn('[placement] Unable to record diagnostic event', eventError);
  }

  const pathResult = await buildStudentPath(supabase, studentId, {
    gradeBand: subject ? String(workingLevelEstimate.workingLevel) : resolvedGradeBand,
    subject,
    workingLevel: subject ? workingLevelEstimate.workingLevel : null,
    preferredModuleSlugs,
    goalFocus: payload.goalFocus,
    source: 'placement',
    metadata: {
      assessment_id: payload.assessmentId,
      attempt_id: attemptId,
      strand_estimates: strandEstimates,
      expected_level: expectedLevel,
      working_level: workingLevelEstimate.workingLevel,
      level_confidence: workingLevelEstimate.levelConfidence,
    },
  });

  const subjectState =
    subject != null
      ? await upsertStudentSubjectState(supabase, {
          studentId,
          subject,
          expectedLevel,
          workingLevel: workingLevelEstimate.workingLevel,
          levelConfidence: workingLevelEstimate.levelConfidence,
          diagnosticAssessmentId: payload.assessmentId,
          diagnosticAttemptId: attemptId,
          strandScores: strandEstimates,
          weakStandardCodes: workingLevelEstimate.weakStandardCodes,
          diagnosticVersion: LEGACY_PLACEMENT_ENGINE_VERSION,
          priorLevelHint: expectedLevel,
          recommendedModuleSlugs: preferredModuleSlugs,
          lastPathId: pathResult.pathId,
          lastDiagnosticType: LEGACY_DIAGNOSTIC_TYPE,
          metadata: {
            diagnostic_version: LEGACY_PLACEMENT_ENGINE_VERSION,
            diagnostic_type: LEGACY_DIAGNOSTIC_TYPE,
            grade_band: resolvedGradeBand,
            tested_levels: workingLevelEstimate.testedLevels,
            score: masteryPct,
          },
        })
      : null;

  // Keep legacy learning_path field roughly aligned for downstream consumers that still read it.
  try {
    const summarizedPath = pathResult.entries.slice(0, 12).map((entry) => ({
      subject,
      moduleSlug: (entry.metadata as Record<string, unknown> | null | undefined)?.module_slug ?? null,
      status: entry.status,
      type: entry.type,
      moduleTitle: (entry.metadata as Record<string, unknown> | null | undefined)?.module_title ?? null,
      workingLevel: subject ? workingLevelEstimate.workingLevel : null,
    }));
    await supabase.from('student_profiles').update({ learning_path: summarizedPath }).eq('id', studentId);
  } catch (legacyError) {
    console.warn('[placement] Unable to sync legacy learning_path', legacyError);
  }

  return {
    ...pathResult,
    strandEstimates,
    score: masteryPct,
    masteryPct,
    subject,
    expectedLevel,
    workingLevel: workingLevelEstimate.workingLevel,
    levelConfidence: workingLevelEstimate.levelConfidence,
    subjectState,
  };
};

const normalizeStandards = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim();
        if (typeof entry === 'number') return String(entry);
        return null;
      })
      .filter((entry): entry is string => Boolean(entry))
      .map((code) => code.trim())
      .filter((code) => code.length > 0);
    return Array.from(new Set(normalized)).slice(0, MAX_STANDARDS_TRACKED);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value as Record<string, unknown>).slice(0, MAX_STANDARDS_TRACKED);
  }
  return [];
};

const mapEventRowToAttempt = (row: { event_type?: string; payload?: Record<string, unknown> | null; created_at?: string | null }): AdaptiveAttempt | null => {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const eventType = (row.event_type ?? '').toLowerCase();
  const createdAt = (row.created_at as string | null | undefined) ?? new Date().toISOString();

  if (!eventType) return null;

  if (eventType === 'practice_answered') {
    const correct = Boolean(payload.correct);
    const difficulty = typeof payload.difficulty === 'number' && Number.isFinite(payload.difficulty) ? payload.difficulty : null;
    const standards = normalizeStandards(payload.standards ?? payload.standard_codes ?? []);
    return { standards, correct, difficulty, source: 'practice', createdAt, accuracy: correct ? 1 : 0 };
  }

  if (eventType === 'quiz_submitted') {
    const score = typeof payload.score === 'number' && Number.isFinite(payload.score) ? payload.score : null;
    const accuracy = score != null ? Math.max(0, Math.min(1, score / 100)) : null;
    const standards = normalizeStandards(payload.standard_breakdown ?? payload.standards ?? []);
    const difficulty = typeof payload.difficulty === 'number' && Number.isFinite(payload.difficulty) ? payload.difficulty : null;
    return {
      standards,
      correct: accuracy == null ? false : accuracy >= TARGET_ACCURACY_BAND.min,
      difficulty,
      source: 'quiz',
      createdAt,
      accuracy,
    };
  }

  if (eventType === 'lesson_completed') {
    const standards = normalizeStandards(payload.standards ?? []);
    const difficulty = typeof payload.difficulty === 'number' && Number.isFinite(payload.difficulty) ? payload.difficulty : null;
    return { standards, correct: true, difficulty, source: 'lesson', createdAt, accuracy: 1 };
  }

  return null;
};

const fetchAdaptiveAttempts = async (
  supabase: SupabaseClient,
  studentId: string,
  limit = MAX_ADAPTIVE_ATTEMPTS,
): Promise<AdaptiveAttempt[]> => {
  const { data, error } = await supabase
    .from('student_events')
    .select('event_type, payload, created_at')
    .eq('student_id', studentId)
    .in('event_type', ['practice_answered', 'quiz_submitted', 'lesson_completed'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[adaptive] Unable to load recent attempts', error);
    captureServerException(error, { stage: 'adaptive_attempts_fetch', limit });
    return [];
  }

  return ((data ?? []) as Array<{ event_type?: string; payload?: Record<string, unknown>; created_at?: string }>)
    .map(mapEventRowToAttempt)
    .filter((attempt): attempt is AdaptiveAttempt => Boolean(attempt));
};

const readAdaptiveState = (
  metadata: Record<string, unknown> | null | undefined,
): { currentDifficulty: number; difficultyStreak: number } => {
  const adaptive =
    ((metadata?.adaptive_state as Record<string, unknown> | null | undefined) ??
      (metadata?.adaptive as Record<string, unknown> | null | undefined) ??
      {}) as Record<string, unknown>;
  const currentDifficulty =
    typeof adaptive.current_difficulty === 'number' && Number.isFinite(adaptive.current_difficulty)
      ? Math.max(1, Math.min(5, Math.round(adaptive.current_difficulty)))
      : 1;
  const difficultyStreak =
    typeof adaptive.difficulty_streak === 'number' && Number.isFinite(adaptive.difficulty_streak)
      ? Math.max(0, Math.round(adaptive.difficulty_streak))
      : 0;
  return { currentDifficulty, difficultyStreak };
};

const resolveEntryFromPayload = (entries: PathEntry[], payload: Record<string, unknown>): number | null => {
  if (!entries.length) return null;
  const moduleId = typeof payload.module_id === 'number' ? payload.module_id : null;
  const lessonId = typeof payload.lesson_id === 'number' ? payload.lesson_id : null;
  const assessmentId = typeof payload.assessment_id === 'number' ? payload.assessment_id : null;

  const match = entries.find(
    (entry) =>
      entry.status !== 'completed' &&
      ((lessonId && entry.lesson_id === lessonId) ||
        (assessmentId && entry.assessment_id === assessmentId) ||
        (moduleId && entry.module_id === moduleId)),
  );

  return match ? (match.id as number) : null;
};

const mergePathEntryMetadata = async (
  supabase: SupabaseClient,
  entryId: number,
  attempt: AdaptiveAttempt | null,
  timeSpentSeconds?: number | null,
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('student_path_entries')
      .select('metadata')
      .eq('id', entryId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    const currentMetadata = ((data?.metadata as Record<string, unknown> | null | undefined) ?? {}) as Record<
      string,
      unknown
    >;
    const attempts = typeof currentMetadata.attempts === 'number' ? currentMetadata.attempts : 0;
    const nextMetadata: Record<string, unknown> = {
      ...currentMetadata,
      attempts: attempts + 1,
      last_event_at: new Date().toISOString(),
    };
    if (timeSpentSeconds && Number.isFinite(timeSpentSeconds)) {
      const existingTime =
        typeof currentMetadata.time_spent_s === 'number' && Number.isFinite(currentMetadata.time_spent_s)
          ? currentMetadata.time_spent_s
          : 0;
      nextMetadata.time_spent_s = existingTime + Math.max(0, Math.round(timeSpentSeconds));
    }
    if (attempt) {
      nextMetadata.last_difficulty = attempt.difficulty ?? nextMetadata.last_difficulty ?? null;
      nextMetadata.last_accuracy = attempt.accuracy ?? nextMetadata.last_accuracy ?? null;
      nextMetadata.last_correct = attempt.correct;
      if (attempt.standards.length) {
        nextMetadata.last_standards = attempt.standards;
      }
    }

    const { error: updateError } = await supabase
      .from('student_path_entries')
      .update({ metadata: nextMetadata })
      .eq('id', entryId);
    if (updateError) {
      throw updateError;
    }
  } catch (metadataError) {
    console.warn('[adaptive] Unable to update path entry metadata', metadataError);
    captureServerException(metadataError, { stage: 'adaptive_entry_metadata_update', entryId });
  }
};

const computeRollingAccuracy = (attempts: AdaptiveAttempt[]): number | null => {
  const recent = attempts.filter((attempt) => attempt.accuracy != null);
  if (!recent.length) return null;
  const total = recent.reduce((sum, attempt) => sum + (attempt.accuracy ?? 0), 0);
  return Math.max(0, Math.min(1, total / recent.length));
};

const detectMisconceptions = (attempts: AdaptiveAttempt[]): string[] => {
  const byStandard = new Map<string, AdaptiveAttempt[]>();
  attempts.forEach((attempt) => {
    const standards = attempt.standards.length ? attempt.standards : ['general'];
    standards.forEach((code) => {
      const list = byStandard.get(code) ?? [];
      list.push(attempt);
      byStandard.set(code, list);
    });
  });

  const remediation = new Set<string>();
  byStandard.forEach((entries, standard) => {
    const recent = entries.slice(0, 3);
    if (recent.length < 2) return;
    const misses = recent.filter((attempt) => !attempt.correct && (attempt.accuracy ?? 0) < TARGET_ACCURACY_BAND.max);
    if (misses.length >= 2) {
      remediation.add(standard);
    }
  });

  return Array.from(remediation).slice(0, MAX_STANDARDS_TRACKED);
};

const pickStretchStandard = (attempts: AdaptiveAttempt[]): string | null => {
  const coverage = new Map<string, { attempts: number; correct: number }>();
  attempts.forEach((attempt) => {
    const standards = attempt.standards.length ? attempt.standards : ['general'];
    standards.forEach((code) => {
      const entry = coverage.get(code) ?? { attempts: 0, correct: 0 };
      entry.attempts += 1;
      if (attempt.correct) {
        entry.correct += 1;
      }
      coverage.set(code, entry);
    });
  });
  if (!coverage.size) return null;

  const sorted = Array.from(coverage.entries()).sort((a, b) => {
    const coverageA = a[1].attempts;
    const coverageB = b[1].attempts;
    if (coverageA === coverageB) return (b[1].correct / Math.max(1, coverageB)) - (a[1].correct / Math.max(1, coverageA));
    return coverageA - coverageB;
  });

  return sorted[0]?.[0] ?? null;
};

const shouldInsertRemediation = (entries: PathEntry[], standard: string): boolean => {
  return !entries.some(
    (entry) =>
      entry.status !== 'completed' &&
      (entry.type === 'review' || (entry.metadata as Record<string, unknown> | null | undefined)?.reason === 'remediation') &&
      entry.target_standard_codes?.includes(standard),
  );
};

const appendAdaptiveEntry = async (
  supabase: SupabaseClient,
  pathId: number,
  entries: PathEntry[],
  type: PathEntry['type'],
  targetStandards: string[],
  metadata: Record<string, unknown>,
): Promise<PathEntry | null> => {
  const pendingOfType = entries.filter((entry) => entry.status !== 'completed' && entry.type === type).length;
  if ((type === 'review' && pendingOfType >= MAX_REMEDIATION_INSERTS) || (type === 'practice' && pendingOfType >= MAX_PENDING_PRACTICE)) {
    return null;
  }
  if (targetStandards.length) {
    const duplicate = entries.some(
      (entry) =>
        entry.status !== 'completed' &&
        entry.type === type &&
        entry.target_standard_codes.some((code) => targetStandards.includes(code)),
    );
    if (duplicate) {
      return null;
    }
  }

  const position = entries.reduce((max, entry) => Math.max(max, entry.position), 0) + 1;
  const insertPayload = {
    path_id: pathId,
    position,
    type,
    module_id: null,
    lesson_id: null,
    assessment_id: null,
    status: 'not_started',
    target_standard_codes: targetStandards,
    metadata,
  };

  const { data, error } = await supabase
    .from('student_path_entries')
    .insert(insertPayload)
    .select('id, path_id, position, type, module_id, lesson_id, assessment_id, status, score, time_spent_s, target_standard_codes, metadata, created_at, updated_at')
    .maybeSingle();

  if (error) {
    console.warn('[adaptive] Unable to append adaptive entry', error);
    captureServerException(error, { stage: 'adaptive_entry_append', pathId, type });
    return null;
  }

  return data as PathEntry;
};

const chooseAdaptiveNext = (entries: PathEntry[]): PathEntry | null => {
  const pending = entries.filter((entry) => entry.status !== 'completed');
  if (!pending.length) {
    return null;
  }

  const priority = (entry: PathEntry): number => {
    const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
    const reason = (metadata.reason as string | null | undefined) ?? '';
    if (reason === 'remediation' || entry.type === 'review') return 3;
    if (reason === 'stretch' || entry.type === 'practice') return 2;
    return 1;
  };

  return pending
    .slice()
    .sort((a, b) => {
      const priorityDelta = priority(b) - priority(a);
      if (priorityDelta !== 0) return priorityDelta;
      return a.position - b.position;
    })[0];
};

const normalizeRatio = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value > 1) return Math.max(0, Math.min(1, value / 100));
  return Math.max(0, Math.min(1, value));
};

const normalizePct = (value: number | null | undefined): number | null => {
  const ratio = normalizeRatio(value);
  return ratio == null ? null : Math.round(ratio * 1000) / 10;
};

const readProfileBlendSignal = (
  metadata: Record<string, unknown> | null | undefined,
): { lastReplannedAt: string | null } => {
  const signal = ((metadata?.[PROFILE_BLEND_SIGNAL_KEY] as Record<string, unknown> | null | undefined) ?? {}) as Record<
    string,
    unknown
  >;
  return {
    lastReplannedAt: typeof signal.last_replanned_at === 'string' ? signal.last_replanned_at : null,
  };
};

const resolveEventSubject = (
  payload: Record<string, unknown> | null | undefined,
  moduleSubjectLookup?: Map<number, string>,
): string | null => {
  const record = (payload ?? {}) as Record<string, unknown>;
  const explicitSubject = normalizeSubjectKey(record.subject as string | null | undefined);
  if (explicitSubject) return explicitSubject;
  const moduleId = typeof record.module_id === 'number' && Number.isFinite(record.module_id) ? record.module_id : null;
  if (moduleId == null) return null;
  return normalizeSubjectKey(moduleSubjectLookup?.get(moduleId) ?? null);
};

const mapEventRowToLiveSubjectEvent = (
  row: { event_type?: string; payload?: Record<string, unknown> | null; created_at?: string | null },
  moduleSubjectLookup: Map<number, string>,
): LiveSubjectEvent | null => {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const eventType = (row.event_type ?? '').toLowerCase();
  const subject = resolveEventSubject(payload, moduleSubjectLookup);
  if (!eventType || !subject) return null;

  const createdAt = (row.created_at as string | null | undefined) ?? new Date().toISOString();

  if (eventType === 'lesson_completed') {
    return {
      subject,
      eventType,
      createdAt,
      accuracy: null,
      standards: normalizeStandards(payload.standards ?? []),
      completionSignal: true,
      signalDirection: 'steady',
    };
  }

  if (eventType === 'practice_answered') {
    const accuracy = payload.correct === true ? 1 : 0;
    return {
      subject,
      eventType,
      createdAt,
      accuracy,
      standards: normalizeStandards(payload.standards ?? payload.standard_codes ?? []),
      completionSignal: false,
      signalDirection: accuracy < TARGET_ACCURACY_BAND.min ? 'support' : 'stretch',
    };
  }

  if (eventType === 'quiz_submitted') {
    const accuracy = normalizeRatio(payload.score as number | null | undefined);
    if (accuracy == null) return null;
    return {
      subject,
      eventType,
      createdAt,
      accuracy,
      standards: normalizeStandards(payload.standard_breakdown ?? payload.standards ?? []),
      completionSignal: false,
      signalDirection:
        accuracy < TARGET_ACCURACY_BAND.min
          ? 'support'
          : accuracy > TARGET_ACCURACY_BAND.max
            ? 'stretch'
            : 'steady',
    };
  }

  return null;
};

export const hasStableSignalCluster = (events: LiveSubjectEvent[]): 'support' | 'stretch' | null => {
  const directional = events
    .filter((event) => event.signalDirection !== 'steady')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, PROFILE_REPLAN_STABLE_SIGNAL_COUNT);

  if (directional.length < PROFILE_REPLAN_STABLE_SIGNAL_COUNT) return null;

  const direction = directional[0]?.signalDirection;
  if (direction !== 'support' && direction !== 'stretch') return null;
  if (directional.some((event) => event.signalDirection !== direction)) return null;

  const standardsPresent = directional.every((event) => event.standards.length > 0);
  if (!standardsPresent) return direction;

  const sharedStandards = directional.slice(1).reduce(
    (shared, event) => shared.filter((code) => event.standards.includes(code)),
    directional[0]?.standards.slice() ?? [],
  );
  return sharedStandards.length > 0 ? direction : null;
};

export const buildSubjectSignalSnapshot = (params: {
  subject: string;
  state?: SubjectState | null;
  masteryPct?: number | null;
  events?: LiveSubjectEvent[];
}): SubjectSignalSnapshot => {
  const { subject } = params;
  const state = params.state ?? null;
  const events = (params.events ?? [])
    .filter((event) => event.subject === subject)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const accuracySamples = events
    .map((event) => event.accuracy)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const recentAccuracy =
    accuracySamples.length > 0
      ? Math.round(((accuracySamples.reduce((sum, value) => sum + value, 0) / accuracySamples.length) * 1000)) / 10
      : null;
  const masteryPct = normalizePct(params.masteryPct ?? null);
  const supportSignals = events.filter((event) => event.signalDirection === 'support').length;
  const stretchSignals = events.filter((event) => event.signalDirection === 'stretch').length;
  const lessonSignals = events.filter((event) => event.completionSignal).length;
  const levelGap =
    state?.expected_level != null && state.working_level != null
      ? Math.max(0, state.expected_level - state.working_level)
      : 0;

  let supportPressure = 0;
  if (levelGap >= 2) supportPressure += 0.35;
  else if (levelGap === 1) supportPressure += 0.18;

  if (masteryPct != null) {
    if (masteryPct < 65) supportPressure += 0.35;
    else if (masteryPct < 75) supportPressure += 0.2;
    else if (masteryPct >= 85) supportPressure -= 0.08;
  }

  if (recentAccuracy != null) {
    if (recentAccuracy < 65) supportPressure += 0.35;
    else if (recentAccuracy < 75) supportPressure += 0.18;
    else if (recentAccuracy >= 85) supportPressure -= 0.1;
  }

  if (supportSignals >= 2) supportPressure += 0.2;
  if ((state?.weak_standard_codes?.length ?? 0) > 0) supportPressure += 0.08;
  if (stretchSignals >= 2) supportPressure -= 0.08;
  supportPressure = Math.max(0, Math.min(1, supportPressure));

  let stretchReadiness = 0;
  if (levelGap === 0) stretchReadiness += 0.18;

  if (masteryPct != null) {
    if (masteryPct >= 85) stretchReadiness += 0.35;
    else if (masteryPct >= 78) stretchReadiness += 0.2;
  }

  if (recentAccuracy != null) {
    if (recentAccuracy >= 85) stretchReadiness += 0.35;
    else if (recentAccuracy >= 78) stretchReadiness += 0.2;
    else if (recentAccuracy < 65) stretchReadiness -= 0.15;
  }

  if (stretchSignals >= 2) stretchReadiness += 0.18;
  if (supportSignals >= 2) stretchReadiness -= 0.18;
  stretchReadiness = Math.max(0, Math.min(1, stretchReadiness));

  const masteryTrend =
    supportPressure >= 0.65 ? 'support' : stretchReadiness >= 0.65 ? 'stretch' : 'steady';

  return {
    subject,
    recentAccuracy,
    masteryPct,
    masteryTrend,
    supportPressure: Math.round(supportPressure * 1000) / 1000,
    stretchReadiness: Math.round(stretchReadiness * 1000) / 1000,
    evidenceCount: accuracySamples.length,
    lessonSignals,
    weakStandards: state?.weak_standard_codes ?? [],
    lastReplannedAt: readProfileBlendSignal(state?.metadata).lastReplannedAt,
  };
};

const buildProfileSubjectWeight = (
  state: SubjectState | null | undefined,
  signal: SubjectSignalSnapshot | null | undefined,
): number => {
  let weight =
    state?.expected_level != null && state.working_level != null && state.expected_level - state.working_level >= 2
      ? 2
      : 1;
  if (!signal) return weight;
  if (signal.masteryTrend === 'support' || signal.supportPressure >= 0.6) {
    weight = 2;
  }
  if (signal.masteryTrend === 'stretch' && signal.supportPressure < 0.55 && signal.stretchReadiness >= 0.75) {
    weight = 1;
  }
  return Math.max(1, Math.min(2, weight));
};

const orderSubjectPathEntries = (
  entries: PathEntry[],
  signal: SubjectSignalSnapshot | null | undefined,
): PathEntry[] => {
  const supportPriority = signal?.supportPressure ?? 0;
  const stretchPriority = signal?.stretchReadiness ?? 0;

  const priorityForEntry = (entry: PathEntry): number => {
    const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
    const reason = (metadata.reason as string | null | undefined) ?? '';
    const remediation = reason === 'remediation' || entry.type === 'review';
    const stretch = reason === 'stretch' || entry.type === 'practice';
    const inProgress = entry.status === 'in_progress';

    if (supportPriority >= 0.6) {
      if (remediation) return 0;
      if (inProgress) return 1;
      return 2;
    }

    if (stretchPriority >= 0.65) {
      if (inProgress) return 0;
      if (stretch) return 1;
      if (remediation) return 3;
      return 2;
    }

    if (inProgress) return 0;
    return remediation ? 1 : 2;
  };

  return entries
    .slice()
    .sort((a, b) => priorityForEntry(a) - priorityForEntry(b) || a.position - b.position);
};

const pathEntryToProfileItem = (entry: PathEntry, subject: string): ProfileLearningPathItem => {
  const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
  const moduleSlug = typeof metadata.module_slug === 'string' ? metadata.module_slug : undefined;
  const moduleTitle =
    typeof metadata.module_title === 'string' && metadata.module_title.trim().length > 0
      ? metadata.module_title
      : entry.type === 'review'
        ? 'Targeted review'
        : 'Next lesson';
  const reason =
    (metadata.reason as string | null | undefined) ?? (entry.type === 'review' ? 'remediation' : 'personalized_path');
  const targetDifficulty =
    typeof metadata.target_difficulty === 'number' && Number.isFinite(metadata.target_difficulty)
      ? metadata.target_difficulty
      : 15;

  return {
    id: entry.lesson_id != null ? String(entry.lesson_id) : moduleSlug ?? `path-entry-${entry.id}`,
    subject,
    topic: moduleTitle,
    concept: reason,
    difficulty: targetDifficulty,
    status: entry.status === 'completed' ? 'completed' : entry.status === 'in_progress' ? 'in_progress' : 'not_started',
    xpReward: 60,
    moduleSlug,
    standardCodes: entry.target_standard_codes ?? [],
    pathSource: reason === 'remediation' || reason === 'stretch' ? 'adaptive_recommendation' : 'subject_placement',
  };
};

const buildFallbackProfileItems = async (params: {
  supabase: SupabaseClient;
  subject: string;
  state?: SubjectState | null;
  profile: { grade_level: number | null; grade_band: string | null };
  limit: number;
}): Promise<ProfileLearningPathItem[]> => {
  const { supabase, subject, state, profile, limit } = params;
  const targetGradeBand =
    state?.working_level != null
      ? String(state.working_level)
      : deriveGradeBand(profile.grade_level, profile.grade_band);
  const sequence = await fetchCanonicalSequence(
    supabase,
    targetGradeBand,
    subject,
    limit,
    state?.working_level ?? profile.grade_level,
  );

  return sequence.map((entry, index) => ({
    id: entry.module_slug ?? `${subject}-${index + 1}`,
    subject,
    topic: entry.module_title ?? 'Next lesson',
    concept: 'personalized_path',
    difficulty: 15,
    status: 'not_started',
    xpReward: 60,
    moduleSlug: entry.module_slug ?? undefined,
    standardCodes: entry.standard_codes ?? [],
    pathSource: 'subject_placement',
  }));
};

const buildContextualProfileItems = async (params: {
  supabase: SupabaseClient;
  subject: string;
  nominalGrade: number;
  accessibilityLevel: number | null;
  limit: number;
}): Promise<ProfileLearningPathItem[]> => {
  const { supabase, subject, nominalGrade, accessibilityLevel, limit } = params;
  const sequence = await fetchCanonicalSequence(supabase, String(nominalGrade), subject, limit, nominalGrade);
  return sequence.map((entry, index) => ({
    id: entry.module_slug ?? `${subject}-context-${index + 1}`,
    subject,
    topic: entry.module_title ?? 'Cross-subject support',
    concept: 'cross_subject_access',
    difficulty: 15,
    status: 'not_started',
    xpReward: 60,
    moduleSlug: entry.module_slug ?? undefined,
    standardCodes: entry.standard_codes ?? [],
    pathSource: 'cross_subject_access',
    accessibilityLevel: accessibilityLevel ?? undefined,
    themeGrade: nominalGrade,
  }));
};

const interleaveProfileLearningPath = (params: {
  coreQueues: Array<{ subject: string; weight: number; entries: ProfileLearningPathItem[] }>;
  contextualQueues: Array<{ subject: string; entries: ProfileLearningPathItem[] }>;
  limit: number;
}): ProfileLearningPathItem[] => {
  const viableCoreQueues = params.coreQueues.filter((queue) => queue.entries.length > 0);
  const viableContextualQueues = params.contextualQueues.filter((queue) => queue.entries.length > 0);
  const cursors = new Map<string, number>();

  [...viableCoreQueues, ...viableContextualQueues].forEach((queue) => {
    cursors.set(queue.subject, 0);
  });

  const result: ProfileLearningPathItem[] = [];
  while (result.length < params.limit) {
    let added = false;

    for (const queue of viableCoreQueues) {
      for (let slot = 0; slot < queue.weight && result.length < params.limit; slot += 1) {
        const cursor = cursors.get(queue.subject) ?? 0;
        const next = queue.entries[cursor];
        if (!next) break;
        result.push(next);
        cursors.set(queue.subject, cursor + 1);
        added = true;
      }
    }

    for (const queue of viableContextualQueues) {
      if (result.length >= params.limit) break;
      const cursor = cursors.get(queue.subject) ?? 0;
      const next = queue.entries[cursor];
      if (!next) continue;
      result.push(next);
      cursors.set(queue.subject, cursor + 1);
      added = true;
    }

    if (!added) break;
  }

  return result.slice(0, params.limit);
};

const summarizeProfileLearningPathMix = (items: ProfileLearningPathItem[]): SubjectMixSummary => {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const subject = normalizeSubjectKey(item.subject);
    if (!subject) return;
    counts.set(subject, (counts.get(subject) ?? 0) + 1);
  });

  const sorted = Array.from(counts.entries())
    .map(([subject, count]) => ({ subject, count }))
    .sort((left, right) => right.count - left.count || left.subject.localeCompare(right.subject));
  const primarySubject = sorted[0]?.subject ?? null;
  const primaryCoreSubject =
    sorted.find((entry) => CORE_PROFILE_SUBJECTS.includes(entry.subject as (typeof CORE_PROFILE_SUBJECTS)[number]))
      ?.subject ?? null;

  return {
    counts: sorted,
    label: sorted.length ? sorted.map((entry) => `${entry.subject}×${entry.count}`).join(', ') : 'empty',
    primarySubject,
    primaryCoreSubject,
  };
};

const compareSignalPriority = (
  left: SubjectSignalSnapshot,
  right: SubjectSignalSnapshot,
): number => {
  const leftPriority = Math.max(left.supportPressure, left.stretchReadiness);
  const rightPriority = Math.max(right.supportPressure, right.stretchReadiness);
  if (rightPriority !== leftPriority) {
    return rightPriority - leftPriority;
  }
  return left.subject.localeCompare(right.subject);
};

const replanBlendedLearningPath = async (
  supabase: SupabaseClient,
  studentId: string,
  event: { eventType: string; payload?: Record<string, unknown> | null },
): Promise<void> => {
  const [profile, states, eventRows, masteryRows] = await Promise.all([
    loadStudentProfile(supabase, studentId),
    getStudentSubjectStates(supabase, studentId).catch(() => []),
    supabase
      .from('student_events')
      .select('event_type, payload, created_at')
      .eq('student_id', studentId)
      .in('event_type', ['practice_answered', 'quiz_submitted', 'lesson_completed'])
      .order('created_at', { ascending: false })
      .limit(PROFILE_REPLAN_EVENT_SAMPLE),
    supabase
      .from('student_mastery_by_subject')
      .select('subject, mastery')
      .eq('student_id', studentId),
  ]);

  if (eventRows.error) {
    throw new Error(`Unable to load recent learning events for replanning: ${eventRows.error.message}`);
  }
  if (masteryRows.error) {
    console.warn('[adaptive] Unable to load subject mastery for replanning', masteryRows.error);
  }

  const rawEvents = (eventRows.data ?? []) as Array<{ event_type?: string; payload?: Record<string, unknown> | null; created_at?: string | null }>;
  const moduleIds = Array.from(
    new Set(
      rawEvents
        .map((row) => {
          const payload = (row.payload ?? {}) as Record<string, unknown>;
          return typeof payload.module_id === 'number' && Number.isFinite(payload.module_id) ? payload.module_id : null;
        })
        .filter((value): value is number => value != null),
    ),
  );

  const moduleSubjectLookup = new Map<number, string>();
  if (moduleIds.length > 0) {
    const { data: moduleRows, error: moduleError } = await supabase
      .from('modules')
      .select('id, subject')
      .in('id', moduleIds);
    if (moduleError) {
      console.warn('[adaptive] Unable to resolve module subjects for replanning', moduleError);
    } else {
      (moduleRows ?? []).forEach((row) => {
        if (typeof row.id === 'number' && typeof row.subject === 'string') {
          moduleSubjectLookup.set(row.id, row.subject);
        }
      });
    }
  }

  const liveEvents = rawEvents
    .map((row) => mapEventRowToLiveSubjectEvent(row, moduleSubjectLookup))
    .filter((row): row is LiveSubjectEvent => Boolean(row));
  const stateMap = new Map(states.map((state) => [state.subject, state] as const));
  const masteryMap = new Map<string, number | null>();
  ((masteryRows.data ?? []) as SubjectMasteryAggregate[]).forEach((row) => {
    const subject = normalizeSubjectKey(row.subject ?? null);
    if (subject) masteryMap.set(subject, normalizePct(row.mastery ?? null));
  });

  const trackedSubjects = new Set<string>([...CORE_PROFILE_SUBJECTS]);
  states.forEach((state) => trackedSubjects.add(state.subject));
  liveEvents.forEach((row) => trackedSubjects.add(row.subject));

  const subjectSignals = Array.from(trackedSubjects).map((subject) =>
    buildSubjectSignalSnapshot({
      subject,
      state: stateMap.get(subject) ?? null,
      masteryPct: masteryMap.get(subject) ?? null,
      events: liveEvents,
    }),
  );
  const signalMap = new Map(subjectSignals.map((signal) => [signal.subject, signal] as const));
  const previousLearningPath = parseProfileLearningPath(profile.learning_path ?? null);
  const previousMix = summarizeProfileLearningPathMix(previousLearningPath);

  const triggerSubject = resolveEventSubject(event.payload ?? {}, moduleSubjectLookup);
  const triggerSignal = triggerSubject ? signalMap.get(triggerSubject) ?? null : null;
  const stableDirection =
    triggerSubject && triggerSignal?.lastReplannedAt
      ? hasStableSignalCluster(
          liveEvents.filter(
            (row) =>
              row.subject === triggerSubject &&
              new Date(row.createdAt).getTime() > new Date(triggerSignal.lastReplannedAt as string).getTime(),
          ),
        )
      : triggerSubject
        ? hasStableSignalCluster(liveEvents.filter((row) => row.subject === triggerSubject))
        : null;

  const recentlyReplanned =
    triggerSignal?.lastReplannedAt != null &&
    Date.now() - new Date(triggerSignal.lastReplannedAt).getTime() < PROFILE_REPLAN_DEBOUNCE_MS;
  const shouldReplan =
    event.eventType === 'lesson_completed'
      ? true
      : !recentlyReplanned && stableDirection != null;

  if (!shouldReplan) {
    return;
  }

  const corePaths = await Promise.all(
    CORE_PROFILE_SUBJECTS.map(async (subject) => ({
      subject,
      path: await getStoredStudentPath(supabase, studentId, { subject }).catch(() => null),
    })),
  );

  const coreQueues = await Promise.all(
    corePaths.map(async ({ subject, path }) => {
      const subjectState = stateMap.get(subject) ?? null;
      const signal = signalMap.get(subject) ?? null;
      const pendingEntries = path?.entries.filter((entry) => entry.status !== 'completed') ?? [];
      const prioritizedEntries = orderSubjectPathEntries(pendingEntries, signal).map((entry) =>
        pathEntryToProfileItem(entry, subject),
      );
      const fallbackEntries =
        prioritizedEntries.length > 0
          ? prioritizedEntries
          : await buildFallbackProfileItems({
              supabase,
              subject,
              state: subjectState,
              profile,
              limit: PROFILE_LEARNING_PATH_LIMIT,
            });
      return {
        subject,
        weight: buildProfileSubjectWeight(subjectState, signal),
        entries: fallbackEntries,
      };
    }),
  );

  const nominalGrade = profile.grade_level ?? gradeBandToLevel(profile.grade_band);
  const englishAccessibility =
    stateMap.get('english')?.working_level ?? profile.grade_level ?? gradeBandToLevel(profile.grade_band);
  const contextualQueues =
    nominalGrade != null
      ? await Promise.all(
          CONTEXTUAL_PROFILE_SUBJECTS.map(async (subject) => ({
            subject,
            entries: await buildContextualProfileItems({
              supabase,
              subject,
              nominalGrade,
              accessibilityLevel: englishAccessibility,
              limit: 2,
            }),
          })),
        )
      : [];

  const learningPath = interleaveProfileLearningPath({
    coreQueues,
    contextualQueues,
    limit: PROFILE_LEARNING_PATH_LIMIT,
  });

  if (!learningPath.length) {
    return;
  }

  await supabase.from('student_profiles').update({ learning_path: learningPath }).eq('id', studentId);

  const replannedAt = new Date().toISOString();
  await Promise.all(
    states.map(async (state) => {
      const signal = signalMap.get(state.subject);
      if (!signal) return;
      const nextMetadata = {
        ...(state.metadata ?? {}),
        [PROFILE_BLEND_SIGNAL_KEY]: {
          recent_accuracy: signal.recentAccuracy,
          mastery_pct: signal.masteryPct,
          mastery_trend: signal.masteryTrend,
          support_pressure: signal.supportPressure,
          stretch_readiness: signal.stretchReadiness,
          evidence_count: signal.evidenceCount,
          lesson_signals: signal.lessonSignals,
          weak_standards: signal.weakStandards,
          last_replanned_at: replannedAt,
          trigger_subject: triggerSubject,
          trigger_event_type: event.eventType,
        },
      };
      await supabase.from('student_subject_state').update({ metadata: nextMetadata }).eq('id', state.id);
    }),
  );

  const nextMix = summarizeProfileLearningPathMix(learningPath);
  const rankedSignals = subjectSignals.slice().sort(compareSignalPriority);
  const supportSignal =
    rankedSignals.find((signal) => signal.masteryTrend === 'support') ?? rankedSignals[0] ?? null;
  const stretchSignal =
    rankedSignals.find((signal) => signal.masteryTrend === 'stretch') ??
    rankedSignals.find((signal) => signal.subject !== supportSignal?.subject) ??
    null;
  const timeSincePreviousReplanMs =
    triggerSignal?.lastReplannedAt != null
      ? Math.max(0, Date.now() - new Date(triggerSignal.lastReplannedAt).getTime())
      : null;
  const triggerLabel = `${event.eventType}:${triggerSubject ?? 'unknown'}`;
  const mixShiftLabel = `${previousMix.label} -> ${nextMix.label}`;
  const oscillationRisk =
    timeSincePreviousReplanMs != null &&
    timeSincePreviousReplanMs < 60 * 60 * 1000 &&
    previousMix.primaryCoreSubject != null &&
    nextMix.primaryCoreSubject != null &&
    previousMix.primaryCoreSubject !== nextMix.primaryCoreSubject;

  recordOpsEvent({
    type: 'adaptive_replan',
    label: triggerLabel,
    reason:
      event.eventType === 'lesson_completed'
        ? 'lesson_completion'
        : stableDirection != null
          ? `stable_${stableDirection}`
          : 'adaptive_signal',
    metadata: {
      studentId,
      triggerLabel,
      triggerEventType: event.eventType,
      triggerSubject,
      stableDirection,
      previousMixLabel: previousMix.label,
      nextMixLabel: nextMix.label,
      mixShiftLabel,
      timeSincePreviousReplanMs,
      primarySupportSubject: supportSignal?.subject ?? null,
      primaryStretchSubject: stretchSignal?.subject ?? null,
      supportPressure: supportSignal?.supportPressure ?? null,
      stretchReadiness: stretchSignal?.stretchReadiness ?? null,
      evidenceCount: supportSignal?.evidenceCount ?? null,
      lessonSignals: supportSignal?.lessonSignals ?? null,
      oscillationRisk,
      oscillationLabel:
        oscillationRisk && previousMix.primaryCoreSubject && nextMix.primaryCoreSubject
          ? `${previousMix.primaryCoreSubject} -> ${nextMix.primaryCoreSubject}`
          : null,
    },
  });
};

const updateAdaptiveState = (
  state: { currentDifficulty: number; difficultyStreak: number },
  latestAttempt: AdaptiveAttempt | null,
  rollingAccuracy: number | null,
): { currentDifficulty: number; difficultyStreak: number } => {
  let { currentDifficulty, difficultyStreak } = state;
  if (latestAttempt) {
    const attemptedDifficulty =
      typeof latestAttempt.difficulty === 'number' && Number.isFinite(latestAttempt.difficulty)
        ? Math.max(1, Math.min(5, Math.round(latestAttempt.difficulty)))
        : null;
    const isCorrect =
      latestAttempt.correct || (latestAttempt.accuracy != null && latestAttempt.accuracy >= TARGET_ACCURACY_BAND.min);

    if (isCorrect && (attemptedDifficulty == null || attemptedDifficulty === currentDifficulty)) {
      difficultyStreak += 1;
      if (difficultyStreak >= 2) {
        currentDifficulty = Math.min(currentDifficulty + 1, 5);
        difficultyStreak = 0;
      }
    } else if (!isCorrect) {
      difficultyStreak = 0;
      if (rollingAccuracy != null && rollingAccuracy < TARGET_ACCURACY_BAND.min) {
        currentDifficulty = Math.max(1, currentDifficulty - 1);
      }
    } else {
      difficultyStreak = 1;
    }
  }

  if (rollingAccuracy != null) {
    if (rollingAccuracy > TARGET_ACCURACY_BAND.max + 0.05 && currentDifficulty < 5) {
      currentDifficulty = Math.min(currentDifficulty + 1, 5);
      difficultyStreak = 0;
    } else if (rollingAccuracy < TARGET_ACCURACY_BAND.min - 0.05 && currentDifficulty > 1) {
      currentDifficulty = Math.max(1, currentDifficulty - 1);
      difficultyStreak = 0;
    }
  }

  return { currentDifficulty, difficultyStreak };
};

const getStoredStudentPath = async (
  supabase: SupabaseClient,
  studentId: string,
  options?: { subject?: string | null },
): Promise<{ path: PathSummary; entries: PathEntry[] } | null> => {
  const subject = normalizeSubjectKey(options?.subject ?? null);
  let pathQuery = supabase
    .from('student_paths')
    .select('id, subject, status, started_at, updated_at, metadata')
    .eq('student_id', studentId)
    .order('started_at', { ascending: false })
    .limit(1);
  if (subject) {
    pathQuery = pathQuery.eq('subject', subject);
  }

  const { data: pathRow, error: pathError } = await pathQuery.maybeSingle();

  if (pathError) {
    throw new Error(`Unable to load student path: ${pathError.message}`);
  }

  if (!pathRow?.id) {
    return null;
  }

  const { data: entries, error: entriesError } = await supabase
    .from('student_path_entries')
    .select('id, path_id, position, type, module_id, lesson_id, assessment_id, status, score, time_spent_s, target_standard_codes, metadata, created_at, updated_at')
    .eq('path_id', pathRow.id)
    .order('position', { ascending: true });

  if (entriesError) {
    throw new Error(`Unable to load path entries: ${entriesError.message}`);
  }

  return {
    path: {
      id: pathRow.id as number,
      subject: (pathRow.subject as string | null | undefined) ?? null,
      status: pathRow.status as string,
      started_at: pathRow.started_at as string,
      updated_at: pathRow.updated_at as string,
      metadata: (pathRow.metadata as Record<string, unknown> | null | undefined) ?? null,
    },
    entries: (entries as PathEntry[]) ?? [],
  };
};

export const getStudentPath = async (
  supabase: SupabaseClient,
  studentId: string,
  options?: { subject?: string | null },
): Promise<{ path: PathSummary; entries: PathEntry[] } | null> => {
  const subject = normalizeSubjectKey(options?.subject ?? null);
  if (subject) {
    return getStoredStudentPath(supabase, studentId, { subject });
  }

  const [storedPath, profileRow] = await Promise.all([
    getStoredStudentPath(supabase, studentId).catch(() => null),
    supabase.from('student_profiles').select('learning_path').eq('id', studentId).maybeSingle(),
  ]);

  if (profileRow.error) {
    throw new Error(`Unable to load student profile learning path: ${profileRow.error.message}`);
  }

  const profileItems = parseProfileLearningPath(profileRow.data?.learning_path ?? null);
  if (!profileItems.length) {
    return storedPath;
  }

  const nowIso = new Date().toISOString();
  const basePath = storedPath?.path ?? {
    id: 0,
    subject: null,
    status: 'active',
    started_at: nowIso,
    updated_at: nowIso,
    metadata: null,
  };

  return {
    path: {
      ...basePath,
      subject: null,
      metadata: {
        ...(basePath.metadata ?? {}),
        path_mode: 'blended_profile',
        source: 'student_profile_learning_path',
      },
    },
    entries: projectProfileLearningPathEntries(profileItems, {
      pathId: basePath.id,
      createdAt: basePath.started_at,
      updatedAt: basePath.updated_at,
    }) as PathEntry[],
  };
};

export const getStudentSubjectStates = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<SubjectState[]> => {
  const { data, error } = await supabase
    .from('student_subject_state')
    .select('*')
    .eq('student_id', studentId)
    .order('subject', { ascending: true });

  if (error) {
    throw new Error(`Unable to load student subject state: ${error.message}`);
  }

  return ((data ?? []) as SubjectState[]).map((row) => ({
    ...row,
    subject: normalizeSubjectKey(row.subject) ?? row.subject,
    weak_standard_codes: Array.isArray(row.weak_standard_codes) ? row.weak_standard_codes : [],
    recommended_module_slugs: Array.isArray(row.recommended_module_slugs) ? row.recommended_module_slugs : [],
    strand_scores: (row.strand_scores as Record<string, unknown> | null | undefined) ?? {},
    metadata: (row.metadata as Record<string, unknown> | null | undefined) ?? {},
  }));
};

export const getStudentPaths = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<Array<{ subject: string | null; state: SubjectState | null; path: { path: PathSummary; entries: PathEntry[] } | null }>> => {
  const [states, pathRows] = await Promise.all([
    getStudentSubjectStates(supabase, studentId).catch(() => []),
    supabase
      .from('student_paths')
      .select('id, subject')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false }),
  ]);

  if (pathRows.error) {
    throw new Error(`Unable to load student paths: ${pathRows.error.message}`);
  }

  const subjectSet = new Set<string>();
  states.forEach((state) => subjectSet.add(state.subject));
  (pathRows.data ?? []).forEach((row) => {
    const subject = normalizeSubjectKey((row.subject as string | null | undefined) ?? null);
    if (subject) subjectSet.add(subject);
  });

  const subjects = Array.from(subjectSet).sort();
  const stateMap = new Map(states.map((state) => [state.subject, state] as const));

  if (!subjects.length) {
    return [
      {
        subject: null,
        state: null,
        path: await getStudentPath(supabase, studentId).catch(() => null),
      },
    ].filter((entry) => entry.path != null);
  }

  return Promise.all(
    subjects.map(async (subject) => ({
      subject,
      state: stateMap.get(subject) ?? null,
      path: await getStudentPath(supabase, studentId, { subject }).catch(() => null),
    })),
  );
};

export const selectNextEntry = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<PathEntry | null> => {
  const currentPath = await getStudentPath(supabase, studentId);
  if (!currentPath) return null;

  const pending = chooseAdaptiveNext(currentPath.entries);
  if (pending) {
    return pending;
  }

  const { data: suggestions, error: suggestionError } = await supabase
    .rpc('suggest_next_lessons', { p_student_id: studentId, limit_count: 1 });

  if (suggestionError) {
    throw new Error(`Unable to compute next activity: ${suggestionError.message}`);
  }

  if (Array.isArray(suggestions) && suggestions.length > 0) {
    const suggestion = suggestions[0] as Record<string, unknown>;
    return {
      id: 0,
      path_id: currentPath.path.id,
      position: currentPath.entries.length + 1,
      type: 'lesson',
      module_id: null,
      lesson_id: suggestion.lesson_id as number,
      assessment_id: null,
      status: 'not_started',
      score: null,
      time_spent_s: null,
      target_standard_codes: [],
      metadata: { reason: suggestion.reason ?? 'adaptive_suggestion' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return null;
};

export const getAdaptiveContext = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<{ targetDifficulty: number; misconceptions: string[]; recentAttempts: AdaptiveAttempt[] }> => {
  await syncAdaptiveConfig(supabase);
  const path = await getStoredStudentPath(supabase, studentId);
  const attempts = await fetchAdaptiveAttempts(supabase, studentId, 12);
  const state = readAdaptiveState(path?.path.metadata ?? {});
  const misconceptions = detectMisconceptions(attempts);

  return {
    targetDifficulty: state.currentDifficulty,
    misconceptions,
    recentAttempts: attempts.slice(0, 8),
  };
};

export const applyAdaptiveEvent = async (
  supabase: SupabaseClient,
  studentId: string,
  event: {
    eventType: string;
    pathEntryId?: number | null;
    status?: 'not_started' | 'in_progress' | 'completed' | null;
    score?: number | null;
    timeSpentSeconds?: number | null;
    payload?: Record<string, unknown> | null;
  },
): Promise<{ path: { path: PathSummary; entries: PathEntry[] } | null; next: PathEntry | null; adaptive: { targetDifficulty: number; misconceptions: string[]; recentAttempts: AdaptiveAttempt[] } }> => {
  await syncAdaptiveConfig(supabase);
  const currentPath = await getStoredStudentPath(supabase, studentId);
  if (!currentPath) {
    return { path: null, next: null, adaptive: { targetDifficulty: 1, misconceptions: [], recentAttempts: [] } };
  }

  const payload = event.payload ?? {};
  const inferredEntryId = resolveEntryFromPayload(currentPath.entries, payload);
  const resolvedEntryId = event.pathEntryId ?? inferredEntryId;
  const attemptSnapshot = mapEventRowToAttempt({
    event_type: event.eventType,
    payload,
    created_at: new Date().toISOString(),
  });

  if (resolvedEntryId) {
    await updatePathEntryProgress(supabase, resolvedEntryId, {
      status: event.status as 'not_started' | 'in_progress' | 'completed' | undefined,
      score: event.score ?? null,
      timeSpentSeconds: event.timeSpentSeconds ?? null,
    });
    await mergePathEntryMetadata(supabase, resolvedEntryId, attemptSnapshot, event.timeSpentSeconds ?? null);
    recordOpsEvent({
      type: 'path_progress',
      label: event.eventType,
      durationMs: event.timeSpentSeconds != null ? event.timeSpentSeconds * 1000 : null,
    });
  }

  const attempts = await fetchAdaptiveAttempts(supabase, studentId, MAX_ADAPTIVE_ATTEMPTS);
  const attemptsWithCurrent =
    attemptSnapshot && !attempts.some((entry) => entry.createdAt === attemptSnapshot.createdAt && entry.source === attemptSnapshot.source)
      ? [attemptSnapshot, ...attempts].slice(0, MAX_ADAPTIVE_ATTEMPTS)
      : attempts;

  const rollingAccuracy = computeRollingAccuracy(attemptsWithCurrent);
  const misconceptions = detectMisconceptions(attemptsWithCurrent);
  const adaptiveState = readAdaptiveState(currentPath.path.metadata ?? {});
  const updatedState = updateAdaptiveState(adaptiveState, attemptsWithCurrent[0] ?? null, rollingAccuracy);
  const previousMisconceptions = Array.isArray(
    (currentPath.path.metadata as Record<string, unknown> | null | undefined)?.adaptive_state?.misconceptions,
  )
    ? (((currentPath.path.metadata as Record<string, unknown> | null | undefined)?.adaptive_state as Record<string, unknown>)?.misconceptions as string[]).filter(
      (code): code is string => typeof code === 'string',
    )
    : [];
  const newlyTagged = misconceptions.filter((code) => !previousMisconceptions.includes(code)).slice(0, MAX_STANDARDS_TRACKED);

  const nextMetadata = {
    ...(currentPath.path.metadata ?? {}),
    adaptive_state: {
      current_difficulty: updatedState.currentDifficulty,
      difficulty_streak: updatedState.difficultyStreak,
      target_accuracy_min: TARGET_ACCURACY_BAND.min,
      target_accuracy_max: TARGET_ACCURACY_BAND.max,
      misconceptions,
      updated_at: new Date().toISOString(),
    },
  };

  try {
    await supabase.from('student_paths').update({ metadata: nextMetadata }).eq('id', currentPath.path.id);
  } catch (metaError) {
    console.warn('[adaptive] Unable to persist adaptive state on path', metaError);
    captureServerException(metaError, { stage: 'adaptive_state_persist', pathId: currentPath.path.id });
  }

  if (newlyTagged.length) {
    try {
      const payloads = newlyTagged.map((code) => ({
        student_id: studentId,
        event_type: 'misconception_tagged',
        payload: { standard_code: code, source: 'adaptive_detector' },
        points_awarded: 0,
      }));
      await supabase.from('student_events').insert(payloads);
    } catch (misError) {
      console.warn('[adaptive] Unable to persist misconception events', misError);
      captureServerException(misError, { stage: 'adaptive_misconception_events', count: newlyTagged.length });
    }
  }

  const workingEntries = [...currentPath.entries];

  for (const standard of misconceptions) {
    if (!shouldInsertRemediation(workingEntries, standard)) continue;
    const label = standard.includes(':') ? standard.split(':').slice(1).join(':') : standard;
    const inserted = await appendAdaptiveEntry(
      supabase,
      currentPath.path.id,
      workingEntries,
      'review',
      [standard],
      {
        reason: 'remediation',
        module_title: `Review ${label || standard}`,
        standard_code: standard,
        source: 'adaptive_selector',
      },
    );
    if (inserted) {
      workingEntries.push(inserted);
    }
  }

  if (rollingAccuracy != null && rollingAccuracy > TARGET_ACCURACY_BAND.max) {
    const stretchStandard = pickStretchStandard(attemptsWithCurrent);
    const stretchLabel = stretchStandard ? (stretchStandard.includes(':') ? stretchStandard.split(':').slice(1).join(':') : stretchStandard) : 'Stretch practice';
    const inserted = await appendAdaptiveEntry(
      supabase,
      currentPath.path.id,
      workingEntries,
      'practice',
      stretchStandard ? [stretchStandard] : [],
      {
        reason: 'stretch',
        module_title: stretchLabel,
        target_difficulty: Math.min(updatedState.currentDifficulty + 1, 5),
        source: 'adaptive_selector',
      },
    );
    if (inserted) {
      workingEntries.push(inserted);
    }
  }

  try {
    await replanBlendedLearningPath(supabase, studentId, {
      eventType: event.eventType,
      payload,
    });
  } catch (replanError) {
    console.warn('[adaptive] Unable to replan blended profile path', replanError);
    captureServerException(replanError, { stage: 'adaptive_profile_replan', studentId, eventType: event.eventType });
  }

  const refreshedStoredPath = await getStoredStudentPath(supabase, studentId);
  const refreshedPath = await getStudentPath(supabase, studentId);
  const resolvedPath = refreshedPath ?? refreshedStoredPath ?? { ...currentPath, entries: workingEntries };
  const next = chooseAdaptiveNext(resolvedPath.entries);

  return {
    path: resolvedPath,
    next,
    adaptive: {
      targetDifficulty: updatedState.currentDifficulty,
      misconceptions,
      recentAttempts: attemptsWithCurrent.slice(0, 8),
    },
  };
};

export const savePlacementResponse = async (
  supabase: SupabaseClient,
  studentId: string,
  payload: {
    assessmentId: number;
    attemptId: number;
    bankQuestionId: number;
    optionId: number | null;
    timeSpentSeconds?: number | null;
  },
  serviceSupabase?: SupabaseClient | null,
): Promise<PlacementSaveResult> => {
  const contentClient = serviceSupabase ?? supabase;
  const { data: attemptRow, error: attemptLoadError } = await supabase
    .from('student_assessment_attempts')
    .select('id, assessment_id, metadata')
    .eq('id', payload.attemptId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (attemptLoadError) {
    throw new Error(`Unable to load placement attempt: ${attemptLoadError.message}`);
  }

  const attemptMetadata = (attemptRow?.metadata as PlacementAttemptMetadata | null | undefined) ?? null;
  const isCatAttempt = isCatPlacementAttemptMetadata(attemptMetadata);

  if (isCatAttempt) {
    const { data: assessmentSnapshot } = await contentClient
      .from('assessments')
      .select('metadata')
      .eq('id', payload.assessmentId)
      .maybeSingle();
    const subject = normalizeSubjectKey((assessmentSnapshot?.metadata as Record<string, unknown> | null | undefined)?.subject_key as string | undefined);
    const assessmentIds = readNumberList(attemptMetadata?.item_pool_assessment_ids);
    const catQuestions =
      assessmentIds.length > 0
        ? await loadPlacementQuestionPool(contentClient, assessmentIds)
        : subject
          ? (await findCatPlacementPool(contentClient, subject)).questions
          : [];
    const questionMap = new Map<number, PlacementQuestion>();
    catQuestions.forEach((question) => questionMap.set(question.bankQuestionId, question));
    const question = questionMap.get(payload.bankQuestionId);
    if (!question) {
      throw new Error('Question not found for CAT placement pool.');
    }

    const option = question.options.find((opt) => opt.id === payload.optionId);
    const isCorrect = option ? option.isCorrect : false;
    const timeSpentSeconds =
      typeof payload.timeSpentSeconds === 'number' && Number.isFinite(payload.timeSpentSeconds)
        ? Math.max(1, Math.round(payload.timeSpentSeconds))
        : null;

    let savedRows: StoredAssessmentResponseRow[];
    try {
      savedRows = await loadAssessmentResponsesByAttempt(supabase, payload.attemptId);
    } catch (savedRowsError) {
      throw new Error(`Unable to read CAT responses: ${(savedRowsError as Error).message}`);
    }

    const priorResponses = sortCatResponseRows(
      savedRows.filter((row) => (row.question_id as number) !== payload.bankQuestionId),
    ).map(
      (row) =>
        ({
          bankQuestionId: row.question_id as number,
          isCorrect: Boolean(row.is_correct),
        }) satisfies CatPlacementResponse,
    );

    const priorLevelHint =
      readPlacementLevel(attemptMetadata?.prior_level_hint) ??
      readPlacementLevel(attemptMetadata?.expected_level) ??
      6;
    const updatedSummary = buildCatPlacementSummary({
      itemPool: catQuestions,
      priorLevelHint,
      responses: [...priorResponses, { bankQuestionId: payload.bankQuestionId, isCorrect }],
    });
    const routeIndex = updatedSummary.itemRoute.length - 1;
    const currentRoute = updatedSummary.itemRoute[routeIndex] ?? null;

    if (currentRoute?.coverageFallbackUsed) {
      recordOpsEvent({
        type: 'cat_content_gap_detected',
        label: subject ?? String(payload.assessmentId),
        reason: 'coverage_fallback',
        metadata: {
          assessmentId: payload.assessmentId,
          attemptId: payload.attemptId,
          bankQuestionId: payload.bankQuestionId,
          targetLevel: currentRoute.targetLevel,
          servedLevel: currentRoute.servedLevel,
          fallbackDistance: currentRoute.fallbackDistance,
          phase: currentRoute.phase,
        },
      });

      if (currentRoute.fallbackDistance > 1) {
        raiseAlert('cat_content_gap_detected', {
          assessmentId: payload.assessmentId,
          attemptId: payload.attemptId,
          subject,
          bankQuestionId: payload.bankQuestionId,
          targetLevel: currentRoute.targetLevel,
          servedLevel: currentRoute.servedLevel,
          fallbackDistance: currentRoute.fallbackDistance,
          phase: currentRoute.phase,
        });
      }
    }

    try {
      await upsertAssessmentResponses(supabase, {
        attempt_id: payload.attemptId,
        question_id: payload.bankQuestionId,
        selected_option_id: payload.optionId,
        response_content: option ? { text: option.text } : null,
        is_correct: isCorrect,
        score: isCorrect ? question.weight : 0,
        time_spent_seconds: timeSpentSeconds,
        metadata: {
          diagnostic_version: CAT_V2_ENGINE_VERSION,
          diagnostic_type: CAT_V2_DIAGNOSTIC_TYPE,
          placement_engine_version: CAT_V2_ENGINE_VERSION,
          cat_route_index: routeIndex,
          served_level: currentRoute?.servedLevel ?? null,
          target_level: currentRoute?.targetLevel ?? null,
          phase_served: currentRoute?.phase ?? null,
          adaptation_reason: currentRoute?.adaptationReason ?? null,
          coverage_fallback_used: currentRoute?.coverageFallbackUsed ?? false,
          fallback_distance: currentRoute?.fallbackDistance ?? 0,
          question_difficulty: question.difficulty ?? null,
          question_strand: question.strand ?? null,
          target_standards: question.targetStandards,
        },
      });
    } catch (error) {
      throw new Error(`Unable to save CAT placement response: ${(error as Error).message}`);
    }

    try {
      await supabase
        .from('student_assessment_attempts')
        .update({
          status: updatedSummary.terminationReason ? 'completed' : 'in_progress',
          metadata: {
            source: 'placement',
            ...buildCatDiagnosticTrace({
              subject,
              gradeBand: typeof attemptMetadata?.grade_band === 'string' ? attemptMetadata.grade_band : null,
              expectedLevel: priorLevelHint,
              summary: updatedSummary,
              itemPoolAssessmentIds: assessmentIds,
              phase: updatedSummary.terminationReason ? 'complete' : 'in_progress',
            }),
            last_question_id: payload.bankQuestionId,
          },
        })
        .eq('id', payload.attemptId)
        .eq('student_id', studentId);
    } catch (attemptError) {
      console.warn('[placement] Unable to update CAT attempt progress', attemptError);
    }

    return {
      isCorrect,
      engineVersion: CAT_V2_ENGINE_VERSION,
      nextItem:
        updatedSummary.terminationReason || !updatedSummary.nextItem
          ? null
          : questionMap.get(updatedSummary.nextItem.bankQuestionId) ?? null,
      isComplete: Boolean(updatedSummary.terminationReason),
    };
  }

  const { questions } = await loadPlacementQuestions(contentClient, payload.assessmentId);
  const question = questions.find((q) => q.bankQuestionId === payload.bankQuestionId);
  if (!question) {
    throw new Error('Question not found for placement assessment.');
  }

  const option = question.options.find((opt) => opt.id === payload.optionId);
  const isCorrect = option ? option.isCorrect : false;
  const timeSpentSeconds =
    typeof payload.timeSpentSeconds === 'number' && Number.isFinite(payload.timeSpentSeconds)
      ? Math.max(1, Math.round(payload.timeSpentSeconds))
      : null;

  const { error } = await supabase.from('student_assessment_responses').upsert(
    {
      attempt_id: payload.attemptId,
      question_id: payload.bankQuestionId,
      selected_option_id: payload.optionId,
      response_content: option ? { text: option.text } : null,
      is_correct: isCorrect,
      score: isCorrect ? question.weight : 0,
      time_spent_seconds: timeSpentSeconds,
    },
    { onConflict: 'attempt_id,question_id' },
  );

  if (error) {
    throw new Error(`Unable to save placement response: ${error.message}`);
  }

  try {
    await supabase
      .from('student_assessment_attempts')
      .update({
        status: 'in_progress',
        metadata: {
          ...(attemptMetadata ?? {}),
          last_question_id: payload.bankQuestionId,
        },
      })
      .eq('id', payload.attemptId)
      .eq('student_id', studentId);
  } catch (attemptError) {
    console.warn('[placement] Unable to update attempt progress', attemptError);
  }

  return { isCorrect, engineVersion: LEGACY_PLACEMENT_ENGINE_VERSION };
};

export const updatePathEntryProgress = async (
  supabase: SupabaseClient,
  entryId: number,
  updates: { status?: 'not_started' | 'in_progress' | 'completed'; score?: number | null; timeSpentSeconds?: number | null },
): Promise<void> => {
  const now = new Date();
  let metadataUpdate: Record<string, unknown> = {};
  try {
    const { data: existingRow } = await supabase
      .from('student_path_entries')
      .select('status, metadata, time_spent_s')
      .eq('id', entryId)
      .maybeSingle();
    const meta = ((existingRow?.metadata as Record<string, unknown> | null | undefined) ?? {}) as Record<string, unknown>;
    const previousStatus = (existingRow?.status as string | null | undefined) ?? null;

    if (updates.status === 'in_progress' && previousStatus === 'not_started') {
      meta.first_started_at = meta.first_started_at ?? now.toISOString();
      meta.last_started_at = now.toISOString();
    }
    if (updates.status === 'completed') {
      meta.completed_at = now.toISOString();
      const lastStarted = typeof meta.last_started_at === 'string' ? new Date(meta.last_started_at) : null;
      const elapsed = updates.timeSpentSeconds
        ? updates.timeSpentSeconds
        : lastStarted
          ? Math.max(1, Math.round((now.getTime() - lastStarted.getTime()) / 1000))
          : null;
      if (elapsed != null) {
        const existing = typeof meta.time_spent_s === 'number' ? meta.time_spent_s : 0;
        meta.time_spent_s = existing + elapsed;
      }
    }
    metadataUpdate = meta;
  } catch (error) {
    console.warn('[path] unable to read metadata for update', error);
  }

  const payload: Record<string, unknown> = {};
  if (updates.status) payload.status = updates.status;
  if (updates.score !== undefined) payload.score = updates.score;
  if (updates.timeSpentSeconds !== undefined) {
    const existingTime = typeof metadataUpdate.time_spent_s === 'number'
      ? (metadataUpdate.time_spent_s as number)
      : undefined;
    payload.time_spent_s = existingTime != null ? existingTime : updates.timeSpentSeconds;
  }
  if (Object.keys(metadataUpdate).length > 0) payload.metadata = metadataUpdate;

  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase
    .from('student_path_entries')
    .update(payload)
    .eq('id', entryId);

  if (error) {
    throw new Error(`Unable to update path entry: ${error.message}`);
  }
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const safeNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : null;
  if (parsed == null || Number.isNaN(parsed) || !Number.isFinite(parsed)) return null;
  return parsed;
};

const MODULE_MASTERY_THRESHOLD = 85;
const WEEKLY_LOOKBACK_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MAX_EVENT_SAMPLE = 200;

export type StudentInsightSnapshot = {
  avgAccuracy: number | null;
  avgAccuracyPriorWeek: number | null;
  avgAccuracyDelta: number | null;
  weeklyTimeMinutes: number;
  weeklyTimeMinutesPriorWeek: number;
  weeklyTimeMinutesDelta: number | null;
  lessonsCompleted: number;
  modulesMastered: Array<{ moduleId: number; title: string | null; mastery: number }>;
  focusStandards: Array<{ code: string; accuracy: number; samples: number }>;
  latestQuizScore: number | null;
  latestQuizAt: string | null;
  struggle: boolean;
};

export const computeStudentInsights = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<StudentInsightSnapshot> => {
  const runtimeConfig = await getRuntimeConfig(supabase);
  TARGET_ACCURACY_BAND = {
    min: runtimeConfig.adaptive.targetAccuracyMin,
    max: runtimeConfig.adaptive.targetAccuracyMax,
  };
  const now = new Date();
  const weekStart = new Date(now.getTime() - WEEKLY_LOOKBACK_DAYS * MS_PER_DAY);
  const priorWeekStart = new Date(now.getTime() - WEEKLY_LOOKBACK_DAYS * 2 * MS_PER_DAY);
  const priorWeekStartDate = priorWeekStart.toISOString().slice(0, 10);

  const [eventResult, activityResult, progressResult] = await Promise.all([
    supabase
      .from('student_events')
      .select('event_type, payload, created_at')
      .eq('student_id', studentId)
      .in('event_type', ['practice_answered', 'quiz_submitted', 'lesson_completed'])
      .order('created_at', { ascending: false })
      .limit(MAX_EVENT_SAMPLE),
    supabase
      .from('student_daily_activity')
      .select('activity_date, practice_minutes')
      .eq('student_id', studentId)
      .gte('activity_date', priorWeekStartDate),
    supabase
      .from('student_progress')
      .select('mastery_pct, lessons ( module_id, modules ( id, title ) )')
      .eq('student_id', studentId)
      .order('last_activity_at', { ascending: false })
      .limit(400),
  ]);

  if (eventResult.error) {
    throw new Error(`Unable to read student events: ${eventResult.error.message}`);
  }
  if (activityResult.error) {
    console.warn('[insights] Unable to read weekly activity', activityResult.error);
  }
  if (progressResult.error) {
    console.warn('[insights] Unable to read module progress', progressResult.error);
  }

  const accuracySamplesCurrent: number[] = [];
  const accuracySamplesPrior: number[] = [];
  const standardAccuracy = new Map<string, { correct: number; total: number }>();
  const recordStandardAccuracy = (code: string, accuracy: number) => {
    const entry = standardAccuracy.get(code) ?? { correct: 0, total: 0 };
    entry.correct += clamp(accuracy, 0, 1);
    entry.total += 1;
    standardAccuracy.set(code, entry);
  };

  let lessonsCompleted = 0;
  let latestQuizScore: number | null = null;
  let latestQuizAt: string | null = null;
  let eventTimeSecondsCurrent = 0;
  let eventTimeSecondsPrior = 0;
  let consecutiveMisses = 0;
  const struggleThreshold = runtimeConfig.adaptive.struggleConsecutiveMisses;

  for (const row of (eventResult.data ?? []) as Array<{ event_type?: string; payload?: Record<string, unknown> | null; created_at?: string | null }>) {
    const eventType = (row.event_type ?? '').toLowerCase();
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const createdAt = typeof row.created_at === 'string' ? new Date(row.created_at) : now;

    const timeSpent = safeNumber(
      payload.time_spent_s ?? payload.time_spent ?? payload.timeSpentSeconds ?? payload.duration_seconds ?? payload.duration,
    );
    if (timeSpent != null && createdAt >= priorWeekStart) {
      if (createdAt >= weekStart) {
        eventTimeSecondsCurrent += Math.max(0, timeSpent);
      } else {
        eventTimeSecondsPrior += Math.max(0, timeSpent);
      }
    }

    if (eventType === 'lesson_completed') {
      lessonsCompleted += 1;
      continue;
    }

    if (eventType === 'practice_answered') {
      const correct = Boolean(payload.correct);
      if (createdAt >= priorWeekStart) {
        if (createdAt >= weekStart) {
          accuracySamplesCurrent.push(correct ? 1 : 0);
        } else {
          accuracySamplesPrior.push(correct ? 1 : 0);
        }
      }
      consecutiveMisses = correct ? 0 : consecutiveMisses + 1;
      const standards = normalizeStandards(payload.standards ?? payload.standard_codes ?? []);
      standards.forEach((code) => recordStandardAccuracy(code, correct ? 1 : 0));
      continue;
    }

    if (eventType === 'quiz_submitted') {
      const score = safeNumber(payload.score ?? payload.percentage ?? payload.result);
      const normalizedScore = score != null ? (score > 1 ? score / 100 : score) : null;
      if (normalizedScore != null) {
        const boundedScore = clamp(normalizedScore, 0, 1);
        if (createdAt >= priorWeekStart) {
          if (createdAt >= weekStart) {
            accuracySamplesCurrent.push(boundedScore);
          } else {
            accuracySamplesPrior.push(boundedScore);
          }
        }
        if (normalizedScore < TARGET_ACCURACY_BAND.min) {
          consecutiveMisses += 1;
        } else {
          consecutiveMisses = 0;
        }
        if (latestQuizScore == null) {
          latestQuizScore = Math.round(clamp(normalizedScore, 0, 1) * 1000) / 10;
          latestQuizAt = createdAt.toISOString();
        }
      }

      const breakdown = payload.standard_breakdown as Record<string, unknown> | null | undefined;
      if (breakdown && typeof breakdown === 'object') {
        Object.entries(breakdown).forEach(([code, value]) => {
          const pct = safeNumber(value);
          if (pct == null) return;
          const accuracy = pct > 1 ? pct / 100 : pct;
          recordStandardAccuracy(code, accuracy);
        });
      }
    }
  }

  let activityMinutesCurrent = 0;
  let activityMinutesPrior = 0;
  for (const row of (activityResult.data ?? []) as Array<{ activity_date?: string | null; practice_minutes?: number | null }>) {
    if (!row.activity_date) continue;
    const activityDate = new Date(row.activity_date);
    if (activityDate < priorWeekStart) continue;
    const minutes = safeNumber(row.practice_minutes) ?? 0;
    if (activityDate >= weekStart) {
      activityMinutesCurrent += Math.max(0, minutes);
    } else {
      activityMinutesPrior += Math.max(0, minutes);
    }
  }

  const weeklyTimeMinutesCurrent =
    activityMinutesCurrent > 0 ? activityMinutesCurrent : Math.round(eventTimeSecondsCurrent / 60);
  const weeklyTimeMinutesPrior =
    activityMinutesPrior > 0 ? activityMinutesPrior : Math.round(eventTimeSecondsPrior / 60);
  const hasPriorTimeSamples = activityMinutesPrior > 0 || eventTimeSecondsPrior > 0;
  const weeklyTimeMinutesDelta = hasPriorTimeSamples ? weeklyTimeMinutesCurrent - weeklyTimeMinutesPrior : null;

  const progressRows = (progressResult.data ?? []) as Array<{
    mastery_pct?: number | null;
    lessons?: { module_id?: number | null; modules?: { id?: number | null; title?: string | null } | null } | null;
  }>;

  const moduleAgg = new Map<number, { total: number; count: number; title: string | null }>();
  for (const row of progressRows) {
    const mastery = safeNumber(row.mastery_pct);
    const moduleId =
      (row.lessons?.modules?.id as number | null | undefined) ??
      (row.lessons?.module_id as number | null | undefined) ??
      null;
    if (moduleId == null || mastery == null) continue;
    const entry = moduleAgg.get(moduleId) ?? { total: 0, count: 0, title: (row.lessons?.modules?.title as string | null | undefined) ?? null };
    entry.total += mastery;
    entry.count += 1;
    if (!entry.title && row.lessons?.modules?.title) {
      entry.title = row.lessons.modules.title as string;
    }
    moduleAgg.set(moduleId, entry);
  }

  const modulesMastered = Array.from(moduleAgg.entries())
    .map(([moduleId, value]) => ({
      moduleId,
      title: value.title ?? null,
      mastery: value.count > 0 ? Math.round((value.total / value.count) * 100) / 100 : 0,
    }))
    .filter((entry) => entry.mastery >= MODULE_MASTERY_THRESHOLD);

  const averageAccuracy = (samples: number[]) =>
    samples.length > 0
      ? Math.round(((samples.reduce((sum, value) => sum + value, 0) / samples.length) * 1000)) / 10
      : null;

  const avgAccuracyCurrentWeek = averageAccuracy(accuracySamplesCurrent);
  const avgAccuracyPriorWeek = averageAccuracy(accuracySamplesPrior);
  const avgAccuracyDelta =
    avgAccuracyCurrentWeek != null && avgAccuracyPriorWeek != null
      ? Math.round((avgAccuracyCurrentWeek - avgAccuracyPriorWeek) * 10) / 10
      : null;
  const accuracySamplesAll = [...accuracySamplesCurrent, ...accuracySamplesPrior];
  const avgAccuracy = avgAccuracyCurrentWeek ?? averageAccuracy(accuracySamplesAll);

  const focusStandards = Array.from(standardAccuracy.entries())
    .map(([code, stats]) => ({
      code,
      accuracy: stats.total > 0 ? Math.round(((stats.correct / stats.total) * 1000)) / 10 : 0,
      samples: stats.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  const struggle =
    consecutiveMisses >= struggleThreshold ||
    (avgAccuracy != null && avgAccuracy < 60) ||
    (focusStandards.length > 0 && focusStandards[0].accuracy < 60);

  return {
    avgAccuracy,
    avgAccuracyPriorWeek,
    avgAccuracyDelta,
    weeklyTimeMinutes: Math.max(0, weeklyTimeMinutesCurrent),
    weeklyTimeMinutesPriorWeek: Math.max(0, weeklyTimeMinutesPrior),
    weeklyTimeMinutesDelta,
    lessonsCompleted,
    modulesMastered,
    focusStandards,
    latestQuizScore,
    latestQuizAt,
    struggle,
  };
};

export const getStudentStats = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<{
  xpTotal: number;
  streakDays: number;
  badges: number;
  badgeDetails: Array<{ id: number; slug: string | null; name: string | null; earnedAt: string | null; icon: string | null; rarity: string | null }>;
  recentEvents: Array<{ event_type: string; points_awarded: number; created_at: string }>;
  masteryAvg: number | null;
  pathProgress: { completed: number; remaining: number; percent: number | null };
  avgAccuracy: number | null;
  avgAccuracyPriorWeek: number | null;
  avgAccuracyDelta: number | null;
  weeklyTimeMinutes: number;
  weeklyTimeMinutesPriorWeek: number;
  weeklyTimeMinutesDelta: number | null;
  modulesMastered: { count: number; items: Array<{ moduleId: number; title: string | null; mastery: number }> };
  focusStandards: Array<{ code: string; accuracy: number; samples: number }>;
  latestQuizScore: number | null;
  struggle: boolean;
}> => {
  const [xpRow, events, mastery, path, insights, badges] = await Promise.all([
    supabase.from('xp_ledger').select('xp_total, streak_days, badge_ids').eq('student_id', studentId).maybeSingle(),
    supabase
      .from('student_events')
      .select('event_type, points_awarded, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('student_mastery')
      .select('mastery_pct')
      .eq('student_id', studentId)
      .limit(100),
    getStudentPath(supabase, studentId),
    computeStudentInsights(supabase, studentId),
    supabase
      .from('student_badges')
      .select('badge_id, earned_at, badge_definitions ( id, slug, name, icon, rarity )')
      .eq('student_id', studentId)
      .order('earned_at', { ascending: false }),
  ]);

  if (xpRow.error) {
    throw new Error(`Unable to read XP: ${xpRow.error.message}`);
  }
  if (events.error) {
    throw new Error(`Unable to read recent events: ${events.error.message}`);
  }
  if (mastery.error) {
    throw new Error(`Unable to read mastery: ${mastery.error.message}`);
  }
  if (badges.error) {
    throw new Error(`Unable to read earned badges: ${badges.error.message}`);
  }

  const masteryValues = ((mastery.data ?? []) as Array<{ mastery_pct?: number | null }>).map((row) =>
    row.mastery_pct ?? 0,
  );
  const masteryAvg =
    masteryValues.length > 0
      ? Math.round((masteryValues.reduce((sum, value) => sum + value, 0) / masteryValues.length) * 100) / 100
      : null;

  const completed = path?.entries.filter((entry) => entry.status === 'completed').length ?? 0;
  const remaining = (path?.entries.length ?? 0) - completed;
  const pathPercent = (path?.entries.length ?? 0) > 0
    ? Math.round(((completed / (path?.entries.length ?? 0)) * 1000)) / 10
    : null;

  const badgeDetails =
    (badges.data as Array<{ badge_id?: number | null; earned_at?: string | null; badge_definitions?: Record<string, unknown> | null }> | null)?.map((row) => ({
      id: (row.badge_id as number | null | undefined) ?? 0,
      slug: (row.badge_definitions?.slug as string | null | undefined) ?? null,
      name: (row.badge_definitions?.name as string | null | undefined) ?? null,
      earnedAt: (row.earned_at as string | null | undefined) ?? null,
      icon: (row.badge_definitions?.icon as string | null | undefined) ?? null,
      rarity: (row.badge_definitions?.rarity as string | null | undefined) ?? null,
    })) ?? [];

  return {
    xpTotal: (xpRow.data?.xp_total as number | null | undefined) ?? 0,
    streakDays: (xpRow.data?.streak_days as number | null | undefined) ?? 0,
    badges: Array.isArray(xpRow.data?.badge_ids)
      ? (xpRow.data?.badge_ids as unknown[]).length
      : badgeDetails.length,
    badgeDetails,
    recentEvents: (events.data as Array<{ event_type: string; points_awarded: number; created_at: string }> | null) ?? [],
    masteryAvg,
    pathProgress: { completed, remaining: Math.max(remaining, 0), percent: pathPercent },
    avgAccuracy: insights.avgAccuracy,
    weeklyTimeMinutes: insights.weeklyTimeMinutes,
    avgAccuracyPriorWeek: insights.avgAccuracyPriorWeek,
    avgAccuracyDelta: insights.avgAccuracyDelta,
    weeklyTimeMinutesPriorWeek: insights.weeklyTimeMinutesPriorWeek,
    weeklyTimeMinutesDelta: insights.weeklyTimeMinutesDelta,
    modulesMastered: { count: insights.modulesMastered.length, items: insights.modulesMastered },
    focusStandards: insights.focusStandards,
    latestQuizScore: insights.latestQuizScore,
    struggle: insights.struggle,
  };
};

export const getParentOverview = async (
  supabase: SupabaseClient,
  parentId: string,
): Promise<{
  children: Array<{
    id: string;
    name: string;
    grade_band: string | null;
    xp_total: number;
    streak_days: number;
    recent_events: Array<{ event_type: string; created_at: string }>;
    progress_pct: number | null;
    latest_quiz_score: number | null;
    weekly_time_minutes: number;
    alerts: string[];
    struggle: boolean;
    subject_placements: Array<{
      subject: string;
      expected_level: number;
      working_level: number | null;
      level_confidence: number;
      diagnostic_completed_at: string | null;
    }>;
  }>;
}> => {
  const { data: directChildren, error: directError } = await supabase
    .from('student_profiles')
    .select('id, first_name, last_name, grade_band')
    .eq('parent_id', parentId);

  if (directError) {
    throw new Error(`Unable to read linked students: ${directError.message}`);
  }

  const { data: guardianLinks, error: guardianError } = await supabase
    .from('guardian_child_links')
    .select('student_id')
    .eq('parent_id', parentId)
    .eq('status', 'active');

  if (guardianError) {
    throw new Error(`Unable to read guardian links: ${guardianError.message}`);
  }

  const studentIds = Array.from(
    new Set([
      ...(directChildren ?? []).map((row) => row.id as string),
      ...(guardianLinks ?? []).map((row) => row.student_id as string),
    ]),
  );

  if (studentIds.length === 0) {
    return { children: [] };
  }

  const [xpRows, recentEvents, insights, subjectStates] = await Promise.all([
    supabase.from('xp_ledger').select('student_id, xp_total, streak_days').in('student_id', studentIds),
    supabase
      .from('student_events')
      .select('student_id, event_type, created_at')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })
      .limit(studentIds.length * 3),
    Promise.all(
      studentIds.map(async (id) => {
        const [insight, path] = await Promise.all([
          computeStudentInsights(supabase, id).catch((error) => {
            console.warn('[parent overview] failed to compute insights for child', { id, error });
            return null;
          }),
          getStudentPath(supabase, id).catch((error) => {
            console.warn('[parent overview] failed to load path for child', { id, error });
            return null;
          }),
        ]);
        return {
          studentId: id,
          insight,
          path,
        };
      }),
    ),
    supabase
      .from('student_subject_state')
      .select('student_id, subject, expected_level, working_level, level_confidence, diagnostic_completed_at')
      .in('student_id', studentIds),
  ]);

  if (xpRows.error) {
    throw new Error(`Unable to read child XP: ${xpRows.error.message}`);
  }
  if (recentEvents.error) {
    throw new Error(`Unable to read child events: ${recentEvents.error.message}`);
  }
  if (subjectStates.error) {
    throw new Error(`Unable to read child subject state: ${subjectStates.error.message}`);
  }

  const xpMap = new Map<string, { xp_total: number; streak_days: number }>();
  for (const row of xpRows.data ?? []) {
    xpMap.set(row.student_id as string, {
      xp_total: (row.xp_total as number | null | undefined) ?? 0,
      streak_days: (row.streak_days as number | null | undefined) ?? 0,
    });
  }

  const eventMap = new Map<string, Array<{ event_type: string; created_at: string }>>();
  for (const row of recentEvents.data ?? []) {
    const studentId = row.student_id as string;
    if (!eventMap.has(studentId)) {
      eventMap.set(studentId, []);
    }
    if ((eventMap.get(studentId) ?? []).length < 3) {
      eventMap.get(studentId)?.push({
        event_type: row.event_type as string,
        created_at: row.created_at as string,
      });
    }
  }

  const insightMap = new Map<
    string,
    {
      insight: StudentInsightSnapshot | null;
      path: { path: PathSummary; entries: PathEntry[] } | null;
    }
  >();
  insights.forEach((entry) => {
    insightMap.set(entry.studentId, { insight: entry.insight, path: entry.path });
  });

  const subjectStateMap = new Map<
    string,
    Array<{
      subject: string;
      expected_level: number;
      working_level: number | null;
      level_confidence: number;
      diagnostic_completed_at: string | null;
    }>
  >();
  for (const row of subjectStates.data ?? []) {
    const studentId = row.student_id as string;
    const list = subjectStateMap.get(studentId) ?? [];
    list.push({
      subject: normalizeSubjectKey((row.subject as string | null | undefined) ?? null) ?? String(row.subject),
      expected_level: (row.expected_level as number | null | undefined) ?? 0,
      working_level: (row.working_level as number | null | undefined) ?? null,
      level_confidence: (row.level_confidence as number | null | undefined) ?? 0,
      diagnostic_completed_at: (row.diagnostic_completed_at as string | null | undefined) ?? null,
    });
    subjectStateMap.set(studentId, list);
  }

  const children = studentIds.map((id) => {
    const profile = (directChildren ?? []).find((row) => row.id === id);
    const xp = xpMap.get(id) ?? { xp_total: 0, streak_days: 0 };
    const insight = insightMap.get(id);
    const pathEntries = insight?.path?.entries ?? [];
    const completedEntries = pathEntries.filter((entry) => entry.status === 'completed').length;
    const progressPct = pathEntries.length > 0 ? Math.round(((completedEntries / pathEntries.length) * 1000)) / 10 : null;
    const alerts: string[] = [];
    if (insight?.insight.struggle) {
      alerts.push('Struggle flag: consecutive misses detected. Encourage a guided review.');
    }
    return {
      id,
      name: `${profile?.first_name ?? 'Learner'}${profile?.last_name ? ` ${profile.last_name}` : ''}`.trim(),
      grade_band: (profile?.grade_band as string | null | undefined) ?? null,
      xp_total: xp.xp_total,
      streak_days: xp.streak_days,
      recent_events: eventMap.get(id) ?? [],
      progress_pct: progressPct,
      latest_quiz_score: insight?.insight.latestQuizScore ?? null,
      weekly_time_minutes: insight?.insight.weeklyTimeMinutes ?? 0,
      alerts,
      struggle: insight?.insight.struggle ?? false,
      subject_placements: (subjectStateMap.get(id) ?? []).sort((a, b) => a.subject.localeCompare(b.subject)),
    };
  });

  return { children };
};
