import type { SupabaseClient } from '@supabase/supabase-js';

import type { ElaAssignmentReason, ElaModuleMap, ElaStrand } from '../shared/elaHomeschool.js';
import type { ElaSubjectEvidenceSummary } from '../shared/elaSubjectStateSummary.js';
import { loadElaModuleMap } from './elaHomeschoolPlans.js';

type ElaSubjectStateUpdateLike = {
  metadata?: Record<string, unknown> | null;
};

export type StudentWorkSampleElaRow = {
  module_slug: string;
  module_title: string | null;
  strand: string | null;
  work_kind: string | null;
  block_id: string | null;
  block_kind: string | null;
  score_pct: number | string | null;
  outcome: string | null;
  reason_code: string | null;
  next_module_slug: string | null;
  next_module_title: string | null;
  parent_summary: string | null;
  prompt_id: string | null;
  prompt_text: string | null;
  prompt_checklist: unknown;
  content_id: string | null;
  content_title: string | null;
  content_kind: string | null;
  content_source_type: string | null;
  content_focus: string | null;
  content_source: string | null;
  content_text: string | null;
  content_excerpt: string | null;
  response_kind: string | null;
  response_text: string | null;
  response_excerpt: string | null;
  response_word_count: number | string | null;
  rubric_checks: unknown;
  estimated_minutes: number | string | null;
  completed_at: string | null;
};

const readRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const readNumber = (value: unknown): number | undefined => {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : undefined;
};

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];

const readBooleanRecord = (value: unknown): Record<string, boolean> | undefined => {
  const record = readRecord(value);
  const entries = Object.entries(record).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const isMissingWorkSamplesTable = (error: unknown): boolean => {
  const record = readRecord(error);
  const code = readString(record.code);
  const message = readString(record.message) ?? '';
  return code === '42P01' || code === 'PGRST205' || /student_work_samples/i.test(message) && /does not exist|schema cache/i.test(message);
};

const moduleTitle = (elaMap: ElaModuleMap, slug: string | null): string | null =>
  slug ? elaMap.modules.find((module) => module.slug === slug)?.title ?? null : null;

const moduleStrand = (elaMap: ElaModuleMap, slug: string | null): ElaStrand | null =>
  slug ? elaMap.modules.find((module) => module.slug === slug)?.strand ?? null : null;

export const recordElaWorkSampleFromSubjectStateUpdate = async (
  supabase: SupabaseClient,
  studentId: string,
  update: ElaSubjectStateUpdateLike | null,
  options: {
    eventType: string;
    eventCreatedAt?: string | null;
    payload?: Record<string, unknown> | null;
    elaMap?: ElaModuleMap;
  },
): Promise<boolean> => {
  const lastCompletion = readRecord(update?.metadata?.last_ela_completion);
  const moduleSlug = readString(lastCompletion.module_slug);
  if (!moduleSlug) return false;

  const elaMap = options.elaMap ?? loadElaModuleMap();
  const nextModuleSlug = readString(lastCompletion.next_module_slug);
  const payload = readRecord(options.payload);
  const completedAt = readString(lastCompletion.completed_at) ?? options.eventCreatedAt ?? new Date().toISOString();
  const insertPayload = {
    student_id: studentId,
    subject: 'ela',
    module_slug: moduleSlug,
    module_title: readString(lastCompletion.module_title) ?? moduleTitle(elaMap, moduleSlug),
    strand: readString(lastCompletion.strand) ?? moduleStrand(elaMap, moduleSlug),
    work_kind: readString(lastCompletion.response_kind),
    block_id: readString(payload.block_id ?? payload.blockId),
    block_kind: readString(payload.block_kind ?? payload.blockKind),
    score_pct: readNumber(lastCompletion.score) ?? null,
    outcome: readString(lastCompletion.outcome),
    reason_code: readString(lastCompletion.reason_code),
    next_module_slug: nextModuleSlug,
    next_module_title: moduleTitle(elaMap, nextModuleSlug),
    parent_summary: readString(lastCompletion.parent_summary),
    prompt_id: readString(lastCompletion.prompt_id),
    prompt_text: readString(lastCompletion.prompt_text),
    prompt_checklist: readStringArray(lastCompletion.prompt_checklist),
    content_id: readString(lastCompletion.content_id),
    content_title: readString(lastCompletion.content_title),
    content_kind: readString(lastCompletion.content_kind),
    content_source_type: readString(lastCompletion.content_source_type),
    content_focus: readString(lastCompletion.content_focus),
    content_source: readString(lastCompletion.content_source),
    content_text: readString(lastCompletion.content_text),
    content_excerpt: readString(lastCompletion.content_excerpt),
    response_kind: readString(lastCompletion.response_kind),
    response_text: readString(lastCompletion.response_text),
    response_excerpt: readString(lastCompletion.response_excerpt),
    response_word_count: readNumber(lastCompletion.response_word_count) ?? null,
    rubric_checks: readBooleanRecord(lastCompletion.rubric_checks) ?? {},
    estimated_minutes: readNumber(lastCompletion.estimated_minutes) ?? null,
    source_event_type: options.eventType,
    source_event_created_at: options.eventCreatedAt ?? null,
    metadata: {
      source: 'ela_subject_state_update',
      accuracy: readNumber(lastCompletion.accuracy) ?? null,
    },
    completed_at: completedAt,
  };

  const { error } = await supabase.from('student_work_samples').insert(insertPayload);
  if (error) {
    if (isMissingWorkSamplesTable(error)) {
      console.warn('[ela-work-samples] student_work_samples table is not available; skipping durable work sample write.');
      return false;
    }
    throw new Error(`Unable to record ELA work sample: ${error.message}`);
  }

  return true;
};

export const fetchElaWorkSampleRows = async (
  supabase: SupabaseClient,
  studentId: string,
  options: { limit?: number } = {},
): Promise<StudentWorkSampleElaRow[]> => {
  const result = await supabase
    .from('student_work_samples')
    .select(
      `module_slug, module_title, strand, work_kind, block_id, block_kind, score_pct, outcome, reason_code,
       next_module_slug, next_module_title, parent_summary, prompt_id, prompt_text, prompt_checklist,
       content_id, content_title, content_kind, content_source_type, content_focus, content_source,
       content_text, content_excerpt, response_kind, response_text, response_excerpt, response_word_count,
       rubric_checks, estimated_minutes, completed_at`,
    )
    .eq('student_id', studentId)
    .eq('subject', 'ela')
    .order('completed_at', { ascending: false })
    .limit(options.limit ?? 100);

  if (result.error) {
    if (isMissingWorkSamplesTable(result.error)) {
      console.warn('[ela-work-samples] student_work_samples table is not available; falling back to ELA metadata.');
      return [];
    }
    throw new Error(`Failed to load ELA work samples: ${result.error.message}`);
  }

  return (result.data ?? []) as StudentWorkSampleElaRow[];
};

export const workSampleRowsToEvidence = (
  rows: StudentWorkSampleElaRow[],
): ElaSubjectEvidenceSummary[] =>
  rows.flatMap((row) => {
    const moduleSlug = readString(row.module_slug);
    const scorePct = readNumber(row.score_pct);
    if (!moduleSlug || scorePct == null) return [];
    return [
      {
        moduleSlug,
        moduleTitle: readString(row.module_title) ?? undefined,
        strand: (readString(row.strand) as ElaStrand | null) ?? undefined,
        scorePct,
        completedAt: readString(row.completed_at) ?? undefined,
        estimatedMinutes: readNumber(row.estimated_minutes),
        outcome: (readString(row.outcome) as ElaSubjectEvidenceSummary['outcome']) ?? undefined,
        reasonCode: (readString(row.reason_code) as ElaAssignmentReason | null) ?? undefined,
        nextModuleSlug: readString(row.next_module_slug) ?? undefined,
        nextModuleTitle: readString(row.next_module_title) ?? undefined,
        parentSummary: readString(row.parent_summary) ?? undefined,
        responseKind: readString(row.response_kind ?? row.work_kind) ?? undefined,
        promptId: readString(row.prompt_id) ?? undefined,
        promptText: readString(row.prompt_text) ?? undefined,
        promptChecklist: readStringArray(row.prompt_checklist),
        contentId: readString(row.content_id) ?? undefined,
        contentTitle: readString(row.content_title) ?? undefined,
        contentKind: readString(row.content_kind) ?? undefined,
        contentSourceType: readString(row.content_source_type) ?? undefined,
        contentFocus: readString(row.content_focus) ?? undefined,
        contentSource: readString(row.content_source) ?? undefined,
        contentText: readString(row.content_text) ?? undefined,
        contentExcerpt: readString(row.content_excerpt) ?? undefined,
        responseText: readString(row.response_text) ?? undefined,
        responseExcerpt: readString(row.response_excerpt) ?? undefined,
        responseWordCount: readNumber(row.response_word_count),
        rubricChecks: readBooleanRecord(row.rubric_checks),
      },
    ];
  });
