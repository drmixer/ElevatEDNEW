import fs from 'node:fs';
import path from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildElaDailyPlan,
  buildElaModuleMap,
  chooseElaAssignment,
  ELA_MASTERY_SCORE_THRESHOLD,
  ELA_WEAK_SCORE_THRESHOLD,
  type ElaEvidence,
  type ElaModuleEntry,
  type ElaModuleMap,
  type ElaSkeletonModule,
  type ElaStrand,
  type ElaSubjectState,
} from '../shared/elaHomeschool.js';
import type { DailyHomeschoolPlan } from '../shared/homeschoolDailyPlan.js';
import type {
  ElaSubjectStateSummary,
  ElaWeeklyRecordModuleSummary,
  ElaWeeklyRecordSummary,
} from '../shared/elaSubjectStateSummary.js';
import {
  fetchElaWorkSampleRows,
  workSampleRowsToEvidence,
} from './elaWorkSamples.js';

type StudentSubjectStateRow = {
  subject: string;
  placement_status?: string | null;
  working_level: number | null;
  level_confidence: number | null;
  strand_scores: Record<string, unknown> | null;
  weak_standard_codes: string[] | null;
  recommended_module_slugs: string[] | null;
  metadata: Record<string, unknown> | null;
};

type StudentProgressElaRow = {
  status: string | null;
  mastery_pct: number | string | null;
  last_activity_at: string | null;
  lessons:
    | {
        title?: string | null;
        estimated_duration_minutes?: number | string | null;
        modules:
          | {
              title?: string | null;
              slug: string | null;
              subject?: string | null;
            }
          | null;
      }
    | null;
};

const DEFAULT_CURRICULUM_PATH = path.resolve(
  process.cwd(),
  'data/curriculum/ElevatED_K12_Curriculum_Skeleton.json',
);

let cachedElaMap: ElaModuleMap | null = null;

export const loadElaModuleMap = (curriculumPath = DEFAULT_CURRICULUM_PATH): ElaModuleMap => {
  if (curriculumPath === DEFAULT_CURRICULUM_PATH && cachedElaMap) return cachedElaMap;
  const rows = JSON.parse(fs.readFileSync(curriculumPath, 'utf8')) as ElaSkeletonModule[];
  const map = buildElaModuleMap(rows);
  if (map.modules.length === 0) {
    throw new Error(`ELA module map at ${curriculumPath} has no grade 3-8 modules.`);
  }
  if (curriculumPath === DEFAULT_CURRICULUM_PATH) cachedElaMap = map;
  return map;
};

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const readNumber = (value: unknown): number | undefined => {
  const numberValue = typeof value === 'string' ? Number(value) : value;
  return typeof numberValue === 'number' && Number.isFinite(numberValue) ? numberValue : undefined;
};

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];

const readRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const readBooleanRecord = (value: unknown): Record<string, boolean> | undefined => {
  const record = readRecord(value);
  const entries = Object.entries(record).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const ELA_STRANDS = new Set<ElaStrand>([
  'reading_literature',
  'reading_informational',
  'vocabulary',
  'writing_grammar',
  'speaking_listening',
]);

const readElaStrand = (value: unknown): ElaStrand | null => {
  const text = readString(value);
  return text && ELA_STRANDS.has(text as ElaStrand) ? (text as ElaStrand) : null;
};

const moduleBySlug = (map: ElaModuleMap, slug: string | undefined | null): ElaModuleEntry | undefined =>
  slug ? map.modules.find((entry) => entry.slug === slug) : undefined;

const moduleTitle = (map: ElaModuleMap, slug: string | undefined | null): string | undefined =>
  moduleBySlug(map, slug)?.title;

const mapSubjectState = (row: StudentSubjectStateRow | null): ElaSubjectState | null => {
  if (!row) return null;
  const metadata = readRecord(row.metadata);
  const strandScores = readRecord(row.strand_scores);
  const currentStrand =
    readElaStrand(metadata.current_strand ?? metadata.currentStrand ?? metadata.target_strand) ??
    readElaStrand(readRecord(strandScores.reading_informational).adaptive_strand) ??
    'reading_informational';
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
      row.working_level ??
      readNumber(metadata.working_grade ?? metadata.workingGrade),
    confidence:
      readNumber(strandState.confidence) ??
      row.level_confidence ??
      readNumber(metadata.confidence),
    masteredModuleSlugs: [
      ...readStringArray(strandState.mastered_module_slugs ?? strandState.masteredModuleSlugs),
      ...readStringArray(metadata.mastered_module_slugs ?? metadata.masteredModuleSlugs),
    ],
    weakModuleSlugs: [
      ...readStringArray(strandState.weak_module_slugs ?? strandState.weakModuleSlugs),
      ...readStringArray(metadata.weak_module_slugs ?? metadata.weakModuleSlugs),
      ...readStringArray(row.weak_standard_codes),
    ],
  };
};

const mapStateEvidence = (row: StudentSubjectStateRow | null): ElaEvidence[] => {
  const evidence = Array.isArray(readRecord(row?.metadata).recent_ela_evidence)
    ? readRecord(row?.metadata).recent_ela_evidence
    : [];
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
        estimatedMinutes: readNumber(record.estimatedMinutes ?? record.estimated_minutes),
        outcome: (readString(record.outcome) as ElaEvidence['outcome']) ?? undefined,
        reasonCode: (readString(record.reasonCode ?? record.reason_code) as ElaEvidence['reasonCode']) ?? undefined,
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
  });
};

const progressToEvidence = (rows: StudentProgressElaRow[], elaMap: ElaModuleMap): ElaEvidence[] => {
  const elaSlugs = new Set(elaMap.modules.map((module) => module.slug));
  return rows
    .flatMap((row) => {
      const moduleSlug = row.lessons?.modules?.slug ?? null;
      const scorePct = readNumber(row.mastery_pct);
      if (!moduleSlug || !elaSlugs.has(moduleSlug) || scorePct == null) return [];
      return [
        {
          moduleSlug,
          scorePct,
          completedAt: row.last_activity_at ?? undefined,
          estimatedMinutes: readNumber(row.lessons?.estimated_duration_minutes),
        } satisfies ElaEvidence,
      ];
    })
    .sort((a, b) => Date.parse(a.completedAt ?? '') - Date.parse(b.completedAt ?? ''));
};

const fetchElaProgressRows = async (
  supabase: SupabaseClient,
  studentId: string,
  limit = 40,
): Promise<StudentProgressElaRow[]> => {
  const result = await supabase
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
    .limit(limit);

  if (result.error) {
    throw new Error(`Failed to load ELA progress evidence: ${result.error.message}`);
  }

  return (result.data ?? []) as StudentProgressElaRow[];
};

const fetchElaStateRow = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<StudentSubjectStateRow | null> => {
  const result = await supabase
    .from('student_subject_state')
    .select('subject, placement_status, working_level, level_confidence, strand_scores, weak_standard_codes, recommended_module_slugs, metadata')
    .eq('student_id', studentId)
    .eq('subject', 'ela')
    .maybeSingle();

  if (result.error) {
    throw new Error(`Failed to load ELA subject state: ${result.error.message}`);
  }

  return (result.data ?? null) as StudentSubjectStateRow | null;
};

const evidenceKey = (item: ElaEvidence): string =>
  [item.moduleSlug, item.completedAt ?? ''].join('|');

const dedupeEvidence = (items: ElaEvidence[]): ElaEvidence[] => {
  const seen = new Set<string>();
  const result: ElaEvidence[] = [];
  for (const item of items) {
    const key = evidenceKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
};

const evidenceModuleTitle = (map: ElaModuleMap, item: ElaEvidence): string | undefined =>
  (item as { moduleTitle?: string }).moduleTitle ?? moduleTitle(map, item.moduleSlug);

const evidenceNextModuleTitle = (map: ElaModuleMap, item: ElaEvidence): string | undefined =>
  (item as { nextModuleTitle?: string }).nextModuleTitle ?? moduleTitle(map, item.nextModuleSlug);

const evidenceStrand = (map: ElaModuleMap, item: ElaEvidence): ElaStrand | undefined =>
  (item as { strand?: ElaStrand }).strand ?? moduleBySlug(map, item.moduleSlug)?.strand;

const combinedEvidence = (
  stateRow: StudentSubjectStateRow | null,
  progressRows: StudentProgressElaRow[],
  workSampleRows: Awaited<ReturnType<typeof fetchElaWorkSampleRows>>,
  map: ElaModuleMap,
): ElaEvidence[] =>
  dedupeEvidence([
    ...(workSampleRowsToEvidence(workSampleRows) as ElaEvidence[]),
    ...progressToEvidence(progressRows, map),
    ...mapStateEvidence(stateRow),
  ]).sort((a, b) => {
    const aTime = Date.parse(a.completedAt ?? '');
    const bTime = Date.parse(b.completedAt ?? '');
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
    return 0;
  });

export const fetchStudentElaDailyPlan = async (
  supabase: SupabaseClient,
  studentId: string,
  options: { date?: string; elaMap?: ElaModuleMap } = {},
): Promise<DailyHomeschoolPlan> => {
  const elaMap = options.elaMap ?? loadElaModuleMap();
  const [stateRow, progressRows, workSampleRows] = await Promise.all([
    fetchElaStateRow(supabase, studentId),
    fetchElaProgressRows(supabase, studentId, 30),
    fetchElaWorkSampleRows(supabase, studentId, { limit: 30 }),
  ]);

  return buildElaDailyPlan({
    date: options.date,
    studentId,
    elaMap,
    state: mapSubjectState(stateRow),
    recentEvidence: combinedEvidence(stateRow, progressRows, workSampleRows, elaMap),
  });
};

export const fetchStudentElaSubjectState = async (
  supabase: SupabaseClient,
  studentId: string,
  options: { elaMap?: ElaModuleMap } = {},
): Promise<ElaSubjectStateSummary | null> => {
  const elaMap = options.elaMap ?? loadElaModuleMap();
  const [stateRow, progressRows, workSampleRows] = await Promise.all([
    fetchElaStateRow(supabase, studentId),
    fetchElaProgressRows(supabase, studentId, 30),
    fetchElaWorkSampleRows(supabase, studentId, { limit: 30 }),
  ]);
  const state = mapSubjectState(stateRow);
  if (!stateRow && !state) return null;

  const evidence = combinedEvidence(stateRow, progressRows, workSampleRows, elaMap);
  const recentEvidence = evidence
    .map((item) => ({
      ...item,
      moduleTitle: evidenceModuleTitle(elaMap, item),
      strand: evidenceStrand(elaMap, item),
    }))
    .sort((a, b) => Date.parse(b.completedAt ?? '') - Date.parse(a.completedAt ?? ''));
  const decision = chooseElaAssignment({ elaMap, state, recentEvidence: evidence });
  const currentModuleSlug = state?.currentModuleSlug ?? decision.recommendedModuleSlug;
  const currentModule = moduleBySlug(elaMap, currentModuleSlug);

  return {
    subject: 'ela',
    placementStatus: stateRow?.placement_status ?? 'unknown',
    currentStrand: state?.currentStrand ?? currentModule?.strand ?? decision.targetStrand,
    currentModuleSlug,
    currentModuleTitle: moduleTitle(elaMap, currentModuleSlug),
    workingGrade: state?.workingGrade ?? currentModule?.grade,
    confidence: state?.confidence ?? stateRow?.level_confidence ?? undefined,
    masteredModuleSlugs: Array.from(new Set(state?.masteredModuleSlugs ?? [])),
    weakModuleSlugs: Array.from(new Set(state?.weakModuleSlugs ?? [])),
    recommendedModuleSlugs: stateRow?.recommended_module_slugs ?? [decision.recommendedModuleSlug],
    recentEvidence,
    reasonCode: decision.reasonCode,
    parentSummary: decision.parentSummary,
  };
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
  return time >= Date.parse(`${weekStart}T00:00:00.000Z`) && time < Date.parse(`${weekEnd}T00:00:00.000Z`);
};

const outcomeForScore = (score: number | undefined): 'mastered' | 'practice' | 'weak' | undefined => {
  if (score == null) return undefined;
  if (score >= ELA_MASTERY_SCORE_THRESHOLD) return 'mastered';
  if (score < ELA_WEAK_SCORE_THRESHOLD) return 'weak';
  return 'practice';
};

export const fetchStudentElaWeeklyRecord = async (
  supabase: SupabaseClient,
  studentId: string,
  options: { weekStart?: string; elaMap?: ElaModuleMap } = {},
): Promise<ElaWeeklyRecordSummary> => {
  const elaMap = options.elaMap ?? loadElaModuleMap();
  const weekStart = options.weekStart && isIsoDate(options.weekStart) ? options.weekStart : currentWeekStartIso();
  const weekEnd = addDaysIso(weekStart, 7);
  const [stateRow, progressRows, workSampleRows] = await Promise.all([
    fetchElaStateRow(supabase, studentId),
    fetchElaProgressRows(supabase, studentId, 100),
    fetchElaWorkSampleRows(supabase, studentId, { limit: 100 }),
  ]);
  const state = mapSubjectState(stateRow);
  const evidence = combinedEvidence(stateRow, progressRows, workSampleRows, elaMap).filter((item) =>
    isWithinIsoWeek(item.completedAt, weekStart, weekEnd),
  );
  const completedModules: ElaWeeklyRecordModuleSummary[] = evidence
    .map((item) => ({
      moduleSlug: item.moduleSlug,
      moduleTitle: evidenceModuleTitle(elaMap, item),
      strand: evidenceStrand(elaMap, item),
      completedAt: item.completedAt,
      scorePct: item.scorePct,
      estimatedMinutes: item.estimatedMinutes,
      outcome: item.outcome ?? outcomeForScore(item.scorePct),
      reasonCode: item.reasonCode,
      nextModuleSlug: item.nextModuleSlug,
      nextModuleTitle: evidenceNextModuleTitle(elaMap, item),
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
    }))
    .sort((a, b) => Date.parse(b.completedAt ?? '') - Date.parse(a.completedAt ?? ''));
  const masteredModuleSlugs = Array.from(
    new Set(completedModules.filter((item) => item.outcome === 'mastered').map((item) => item.moduleSlug)),
  );
  const weakModuleSlugs = Array.from(
    new Set(completedModules.filter((item) => item.outcome === 'weak').map((item) => item.moduleSlug)),
  );
  const estimatedMinutes = completedModules.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
  const latest = completedModules[0];
  const currentModuleSlug = state?.currentModuleSlug ?? latest?.moduleSlug;
  const currentModule = moduleBySlug(elaMap, currentModuleSlug);

  return {
    subject: 'ela',
    studentId,
    weekStart,
    weekEnd,
    estimatedMinutes,
    completedModuleCount: completedModules.length,
    completedModules,
    masteredModuleSlugs,
    weakModuleSlugs,
    currentModuleSlug,
    currentModuleTitle: moduleTitle(elaMap, currentModuleSlug),
    currentStrand: state?.currentStrand ?? currentModule?.strand ?? 'reading_informational',
    latestChangeSummary: latest
      ? latest.parentSummary ?? `ELA changed because ${latest.moduleTitle ?? latest.moduleSlug} scored ${latest.scorePct ?? 'unscored'}%.`
      : undefined,
    parentNotes: [
      completedModules.length > 0
        ? `${completedModules.length} ELA check${completedModules.length === 1 ? '' : 's'} or lesson${completedModules.length === 1 ? '' : 's'} recorded this week.`
        : 'No completed ELA checks or lessons are recorded for this week yet.',
      estimatedMinutes > 0
        ? `Completed ELA lessons account for about ${estimatedMinutes} estimated minutes.`
        : 'Minute totals will appear when completed ELA lessons include duration estimates.',
      masteredModuleSlugs.length > 0
        ? `${masteredModuleSlugs.length} ELA module${masteredModuleSlugs.length === 1 ? '' : 's'} showed mastery-level evidence.`
        : 'No mastery-level ELA evidence is recorded for this week yet.',
      weakModuleSlugs.length > 0
        ? `${weakModuleSlugs.length} ELA module${weakModuleSlugs.length === 1 ? '' : 's'} need repair attention.`
        : 'No new weak ELA modules were recorded this week.',
    ],
  };
};
