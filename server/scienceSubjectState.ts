import type { SupabaseClient } from '@supabase/supabase-js';

import {
  chooseScienceAssignment,
  SCIENCE_MASTERY_SCORE_THRESHOLD,
  SCIENCE_WEAK_SCORE_THRESHOLD,
  type ScienceEvidence,
  type ScienceModuleMap,
  type ScienceStrand,
  type ScienceSubjectState,
} from '../shared/scienceHomeschool.js';
import { loadScienceModuleMap } from './scienceHomeschoolPlans.js';

type StudentSubjectStateRow = {
  subject?: string | null;
  expected_level?: number | string | null;
  working_level?: number | string | null;
  level_confidence?: number | string | null;
  placement_status?: string | null;
  strand_scores?: Record<string, unknown> | null;
  weak_standard_codes?: string[] | null;
  recommended_module_slugs?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type ScienceCompletionEventInput = {
  moduleSlug: string;
  score: number;
  accuracy?: number | null;
  completedAt?: string;
  estimatedMinutes?: number | null;
  payload?: Record<string, unknown> | null;
};

type ScienceSubjectStateBuildInput = ScienceCompletionEventInput & {
  studentId: string;
  currentState?: StudentSubjectStateRow | null;
  scienceMap: ScienceModuleMap;
};

type ScienceSubjectStateUpsert = {
  student_id: string;
  subject: 'science';
  expected_level: number;
  working_level: number;
  level_confidence: number;
  placement_status: 'completed';
  strand_scores: Record<string, unknown>;
  weak_standard_codes: string[];
  recommended_module_slugs: string[];
  metadata: Record<string, unknown>;
};

const SCIENCE_STRANDS = new Set<ScienceStrand>([
  'earth_space',
  'life_science',
  'physical_science',
  'engineering_practices',
]);

const SCIENCE_SUBJECT_KEYS = [
  'subject',
  'module_subject',
  'moduleSubject',
  'subject_area',
  'subjectArea',
  'course_subject',
  'courseSubject',
];

const SCIENCE_MODULE_SLUG_KEYS = [
  'module_slug',
  'moduleSlug',
  'current_module_slug',
  'currentModuleSlug',
];

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

const readScienceStrand = (value: unknown): ScienceStrand | null => {
  const text = readString(value);
  return text && SCIENCE_STRANDS.has(text as ScienceStrand) ? (text as ScienceStrand) : null;
};

const unique = (values: string[]): string[] => Array.from(new Set(values.filter((value) => value.length > 0)));

const without = (values: string[], removed: string): string[] => values.filter((value) => value !== removed);

const isScienceSubjectValue = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return normalized === 'science' || tokens.includes('science');
};

const readScienceModuleSlug = (payload: Record<string, unknown>): string | null => {
  for (const key of SCIENCE_MODULE_SLUG_KEYS) {
    const slug = readString(payload[key]);
    if (slug) return slug;
  }

  const module = readRecord(payload.module);
  for (const key of ['slug', ...SCIENCE_MODULE_SLUG_KEYS]) {
    const slug = readString(module[key]);
    if (slug) return slug;
  }

  return null;
};

export const extractScienceCompletionEvent = (
  payload: Record<string, unknown>,
  score: number | null | undefined,
  options: { accuracy?: number | null; completedAt?: string | null; timeSpentSeconds?: number | null } = {},
): ScienceCompletionEventInput | null => {
  if (score == null || !Number.isFinite(score)) return null;

  const moduleSlug = readScienceModuleSlug(payload);
  if (!moduleSlug) return null;

  const module = readRecord(payload.module);
  const subjectLooksScience = SCIENCE_SUBJECT_KEYS.some((key) => isScienceSubjectValue(payload[key]) || isScienceSubjectValue(module[key]));
  const slugLooksScience = isScienceSubjectValue(moduleSlug);
  if (!subjectLooksScience && !slugLooksScience) return null;

  const estimatedMinutes =
    readNumber(payload.estimated_minutes ?? payload.estimatedMinutes) ??
    (options.timeSpentSeconds ? Math.max(1, Math.round(options.timeSpentSeconds / 60)) : undefined);

  return {
    moduleSlug,
    score,
    accuracy: options.accuracy ?? readNumber(payload.accuracy) ?? null,
    completedAt: options.completedAt ?? readString(payload.completed_at ?? payload.completedAt) ?? undefined,
    estimatedMinutes,
    payload,
  };
};

const readRecentEvidence = (metadata: Record<string, unknown>): ScienceEvidence[] =>
  Array.isArray(metadata.recent_science_evidence)
    ? metadata.recent_science_evidence.flatMap((item) => {
        const record = readRecord(item);
        const moduleSlug = readString(record.moduleSlug ?? record.module_slug);
        const scorePct = readNumber(record.scorePct ?? record.score_pct);
        if (!moduleSlug || scorePct == null) return [];
        return [
          {
            moduleSlug,
            scorePct,
            completedAt: readString(record.completedAt ?? record.completed_at) ?? undefined,
            estimatedMinutes: readNumber(record.estimatedMinutes ?? record.estimated_minutes),
            outcome: (readString(record.outcome) as ScienceEvidence['outcome']) ?? undefined,
            reasonCode: (readString(record.reasonCode ?? record.reason_code) as ScienceEvidence['reasonCode']) ?? undefined,
            nextModuleSlug: readString(record.nextModuleSlug ?? record.next_module_slug) ?? undefined,
            parentSummary: readString(record.parentSummary ?? record.parent_summary) ?? undefined,
            responseKind: readString(record.responseKind ?? record.response_kind) ?? undefined,
            promptId: readString(record.promptId ?? record.prompt_id) ?? undefined,
            promptText: readString(record.promptText ?? record.prompt_text) ?? undefined,
            promptChecklist: readStringArray(record.promptChecklist ?? record.prompt_checklist),
            contentId: readString(record.contentId ?? record.content_id) ?? undefined,
            contentTitle: readString(record.contentTitle ?? record.content_title) ?? undefined,
            contentKind: readString(record.contentKind ?? record.content_kind) ?? undefined,
            contentSourceType: readString(record.contentSourceType ?? record.content_source_type) ?? undefined,
            contentFocus: readString(record.contentFocus ?? record.content_focus) ?? undefined,
            contentSource: readString(record.contentSource ?? record.content_source) ?? undefined,
            contentText: readString(record.contentText ?? record.content_text) ?? undefined,
            contentExcerpt: readString(record.contentExcerpt ?? record.content_excerpt) ?? undefined,
            responseText: readString(record.responseText ?? record.response_text) ?? undefined,
            responseExcerpt: readString(record.responseExcerpt ?? record.response_excerpt) ?? undefined,
            responseWordCount: readNumber(record.responseWordCount ?? record.response_word_count),
            rubricChecks: readBooleanRecord(record.rubricChecks ?? record.rubric_checks),
          },
        ];
      })
    : [];

const mapExistingState = (row: StudentSubjectStateRow | null | undefined): ScienceSubjectState | null => {
  if (!row) return null;
  const metadata = readRecord(row.metadata);
  const strandScores = readRecord(row.strand_scores);
  const currentStrand =
    readScienceStrand(metadata.current_strand ?? metadata.currentStrand ?? metadata.target_strand) ??
    'earth_space';
  const strandState = readRecord(strandScores[currentStrand]);

  return {
    currentModuleSlug:
      readString(strandState.current_module_slug ?? strandState.currentModuleSlug) ??
      readString(metadata.current_module_slug ?? metadata.currentModuleSlug) ??
      row.recommended_module_slugs?.[0] ??
      undefined,
    currentStrand,
    workingGrade:
      readNumber(strandState.working_grade ?? strandState.workingGrade) ??
      readNumber(row.working_level) ??
      readNumber(metadata.working_grade ?? metadata.workingGrade),
    confidence:
      readNumber(strandState.confidence) ??
      readNumber(row.level_confidence) ??
      readNumber(metadata.confidence),
    masteredModuleSlugs: unique([
      ...readStringArray(strandState.mastered_module_slugs ?? strandState.masteredModuleSlugs),
      ...readStringArray(metadata.mastered_module_slugs ?? metadata.masteredModuleSlugs),
    ]),
    weakModuleSlugs: unique([
      ...readStringArray(strandState.weak_module_slugs ?? strandState.weakModuleSlugs),
      ...readStringArray(metadata.weak_module_slugs ?? metadata.weakModuleSlugs),
      ...readStringArray(row.weak_standard_codes),
    ]),
  };
};

const updateConfidence = (current: number | undefined, score: number): number => {
  const base = current ?? 0.5;
  if (score >= SCIENCE_MASTERY_SCORE_THRESHOLD) {
    return clampConfidence(Math.max(base, 0.66) + 0.06);
  }
  if (score < SCIENCE_WEAK_SCORE_THRESHOLD) {
    return clampConfidence(Math.min(base, 0.64) - 0.12);
  }
  return clampConfidence(Math.max(base, 0.5) + 0.02);
};

const parentSummaryForOutcome = (title: string, score: number, outcome: 'mastered' | 'practice' | 'weak'): string => {
  if (outcome === 'mastered') {
    return `Science marked ${title} mastered because the latest score was ${score}%.`;
  }
  if (outcome === 'weak') {
    return `Science marked ${title} for repair because the latest score was ${score}%.`;
  }
  return `Science kept ${title} in practice because the latest score was ${score}%.`;
};

const responseExcerpt = (value: unknown): string | undefined => {
  const text = readString(value);
  if (!text) return undefined;
  return text.length > 420 ? `${text.slice(0, 417).trimEnd()}...` : text;
};

const workSampleText = (value: unknown): string | undefined => {
  const text = readString(value);
  if (!text) return undefined;
  return text.length > 2400 ? `${text.slice(0, 2397).trimEnd()}...` : text;
};

const readBooleanRecord = (value: unknown): Record<string, boolean> | undefined => {
  const record = readRecord(value);
  const entries = Object.entries(record).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

export const buildScienceSubjectStateUpdate = ({
  studentId,
  currentState = null,
  scienceMap,
  moduleSlug,
  score,
  accuracy,
  completedAt = new Date().toISOString(),
  estimatedMinutes,
  payload,
}: ScienceSubjectStateBuildInput): ScienceSubjectStateUpsert | null => {
  const moduleEntry = scienceMap.modules.find((entry) => entry.slug === moduleSlug);
  if (!moduleEntry) return null;

  const normalizedScore = clampScore(score);
  const metadata = readRecord(currentState?.metadata);
  const strandScores = readRecord(currentState?.strand_scores);
  const existingState = mapExistingState(currentState);
  const existingEvidence = readRecentEvidence(metadata);
  const completedEvidence: ScienceEvidence = {
    moduleSlug,
    scorePct: normalizedScore,
    completedAt,
    estimatedMinutes: estimatedMinutes ?? undefined,
    responseKind: readString(payload?.response_kind ?? payload?.responseKind) ?? undefined,
    promptId: readString(payload?.prompt_id ?? payload?.promptId) ?? undefined,
    promptText: readString(payload?.prompt_text ?? payload?.promptText) ?? undefined,
    promptChecklist: readStringArray(payload?.prompt_checklist ?? payload?.promptChecklist),
    contentId: readString(payload?.content_id ?? payload?.contentId) ?? undefined,
    contentTitle: readString(payload?.content_title ?? payload?.contentTitle) ?? undefined,
    contentKind: readString(payload?.content_kind ?? payload?.contentKind) ?? undefined,
    contentSourceType: readString(payload?.content_source_type ?? payload?.contentSourceType) ?? undefined,
    contentFocus: readString(payload?.content_focus ?? payload?.contentFocus) ?? undefined,
    contentSource: readString(payload?.content_source ?? payload?.contentSource) ?? undefined,
    contentText: workSampleText(payload?.content_text ?? payload?.contentText ?? payload?.content_excerpt ?? payload?.contentExcerpt),
    contentExcerpt: responseExcerpt(payload?.content_excerpt ?? payload?.contentExcerpt),
    responseText: workSampleText(payload?.response),
    responseExcerpt: responseExcerpt(payload?.response),
    responseWordCount: readNumber(payload?.response_word_count ?? payload?.responseWordCount),
    rubricChecks: readBooleanRecord(payload?.rubric_checks ?? payload?.rubricChecks),
  };
  const recentEvidenceForDecision = [...existingEvidence, completedEvidence].slice(-8);

  const outcome = normalizedScore >= SCIENCE_MASTERY_SCORE_THRESHOLD
    ? 'mastered'
    : normalizedScore < SCIENCE_WEAK_SCORE_THRESHOLD
      ? 'weak'
      : 'practice';
  const existingMasteredSlugs = existingState?.masteredModuleSlugs ?? [];
  const existingWeakSlugs = existingState?.weakModuleSlugs ?? [];
  const masteredModuleSlugs = outcome === 'mastered'
    ? unique([...existingMasteredSlugs, moduleSlug])
    : outcome === 'weak'
      ? without(existingMasteredSlugs, moduleSlug)
      : existingMasteredSlugs;
  const weakModuleSlugs = outcome === 'weak'
    ? unique([...existingWeakSlugs, moduleSlug])
    : without(existingWeakSlugs, moduleSlug);
  const confidence = updateConfidence(existingState?.confidence ?? readNumber(currentState?.level_confidence), normalizedScore);

  const provisionalState: ScienceSubjectState = {
    currentModuleSlug: moduleSlug,
    currentStrand: moduleEntry.strand,
    workingGrade: moduleEntry.grade,
    confidence,
    masteredModuleSlugs,
    weakModuleSlugs,
  };
  const decision = chooseScienceAssignment({
    scienceMap,
    state: provisionalState,
    recentEvidence: recentEvidenceForDecision,
    targetStrand: moduleEntry.strand,
  });
  const recommendedModule = scienceMap.modules.find((entry) => entry.slug === decision.recommendedModuleSlug) ?? moduleEntry;
  const nextState: ScienceSubjectState = {
    ...provisionalState,
    currentModuleSlug: decision.recommendedModuleSlug,
    currentStrand: decision.targetStrand,
    workingGrade: recommendedModule.grade,
  };
  const parentSummary = parentSummaryForOutcome(moduleEntry.title, normalizedScore, outcome);
  const completionParentSummary = `${parentSummary} ${decision.parentSummary}`;
  const recentEvidence = recentEvidenceForDecision.map((item, index) =>
    index === recentEvidenceForDecision.length - 1
      ? {
          ...item,
          outcome,
          reasonCode: decision.reasonCode,
          nextModuleSlug: decision.recommendedModuleSlug,
          parentSummary: completionParentSummary,
        }
      : item,
  );
  const lastCompletion = {
    module_slug: moduleSlug,
    module_title: moduleEntry.title,
    strand: moduleEntry.strand,
    score: normalizedScore,
    accuracy: accuracy ?? normalizedScore,
    completed_at: completedAt,
    estimated_minutes: estimatedMinutes ?? null,
    prompt_id: completedEvidence.promptId ?? null,
    prompt_text: completedEvidence.promptText ?? null,
    prompt_checklist: completedEvidence.promptChecklist ?? null,
    content_id: completedEvidence.contentId ?? null,
    content_title: completedEvidence.contentTitle ?? null,
    content_kind: completedEvidence.contentKind ?? null,
    content_source_type: completedEvidence.contentSourceType ?? null,
    content_focus: completedEvidence.contentFocus ?? null,
    content_source: completedEvidence.contentSource ?? null,
    content_text: completedEvidence.contentText ?? null,
    content_excerpt: completedEvidence.contentExcerpt ?? null,
    response_text: completedEvidence.responseText ?? null,
    response_excerpt: completedEvidence.responseExcerpt ?? null,
    response_word_count: completedEvidence.responseWordCount ?? null,
    rubric_checks: completedEvidence.rubricChecks ?? null,
    outcome,
    next_module_slug: decision.recommendedModuleSlug,
    reason_code: decision.reasonCode,
    parent_summary: completionParentSummary,
    response_kind: readString(payload?.response_kind ?? payload?.responseKind) ?? null,
  };
  const nextStrandScores = {
    ...strandScores,
    [moduleEntry.strand]: {
      adaptive_strand: moduleEntry.strand,
      current_module_slug: nextState.currentModuleSlug,
      working_grade: nextState.workingGrade,
      confidence,
      mastered_module_slugs: masteredModuleSlugs,
      weak_module_slugs: weakModuleSlugs,
      last_score: normalizedScore,
      last_updated_at: completedAt,
    },
  };
  const nextMetadata = {
    ...metadata,
    science_subject_state_version: 1,
    current_strand: nextState.currentStrand,
    target_strand: nextState.currentStrand,
    current_module_slug: nextState.currentModuleSlug,
    working_grade: nextState.workingGrade,
    confidence,
    mastered_module_slugs: masteredModuleSlugs,
    weak_module_slugs: weakModuleSlugs,
    recent_science_evidence: recentEvidence.map((item) => ({
      moduleSlug: item.moduleSlug,
      scorePct: item.scorePct,
      completedAt: item.completedAt,
      estimatedMinutes: item.estimatedMinutes,
      outcome: item.outcome,
      reasonCode: item.reasonCode,
      nextModuleSlug: item.nextModuleSlug,
      parentSummary: item.parentSummary,
      responseKind: item.responseKind,
      promptId: item.promptId,
      promptText: item.promptText,
      promptChecklist: item.promptChecklist,
      contentId: item.contentId,
      contentTitle: item.contentTitle,
      contentKind: item.contentKind,
      contentSourceType: item.contentSourceType,
      contentFocus: item.contentFocus,
      contentSource: item.contentSource,
      contentText: item.contentText,
      contentExcerpt: item.contentExcerpt,
      responseText: item.responseText,
      responseExcerpt: item.responseExcerpt,
      responseWordCount: item.responseWordCount,
      rubricChecks: item.rubricChecks,
    })),
    last_science_completion: lastCompletion,
    latest_change_summary: lastCompletion.parent_summary,
  };
  const expectedLevel = readNumber(currentState?.expected_level) ?? moduleEntry.grade;

  return {
    student_id: studentId,
    subject: 'science',
    expected_level: expectedLevel,
    working_level: nextState.workingGrade ?? moduleEntry.grade,
    level_confidence: confidence,
    placement_status: 'completed',
    strand_scores: nextStrandScores,
    weak_standard_codes: weakModuleSlugs,
    recommended_module_slugs: unique([decision.recommendedModuleSlug, ...decision.supportingModuleSlugs]),
    metadata: nextMetadata,
  };
};

export const updateScienceSubjectStateFromCompletionEvent = async (
  supabase: SupabaseClient,
  studentId: string,
  event: ScienceCompletionEventInput,
  options: { scienceMap?: ScienceModuleMap } = {},
): Promise<ScienceSubjectStateUpsert | null> => {
  const scienceMap = options.scienceMap ?? loadScienceModuleMap();
  const { data, error } = await supabase
    .from('student_subject_state')
    .select('subject, expected_level, working_level, level_confidence, placement_status, strand_scores, weak_standard_codes, recommended_module_slugs, metadata')
    .eq('student_id', studentId)
    .eq('subject', 'science')
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load science subject state: ${error.message}`);
  }

  const update = buildScienceSubjectStateUpdate({
    studentId,
    currentState: (data ?? null) as StudentSubjectStateRow | null,
    scienceMap,
    ...event,
  });
  if (!update) return null;

  const result = await supabase
    .from('student_subject_state')
    .upsert(update, { onConflict: 'student_id,subject' });

  if (result.error) {
    throw new Error(`Unable to update science subject state: ${result.error.message}`);
  }

  return update;
};
