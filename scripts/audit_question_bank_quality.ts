import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  assessPracticeQuestionQuality,
  incrementQuestionQualityReasonCounts,
} from '../shared/questionQuality.js';
import { createServiceRoleClient, fetchAllPaginated } from './utils/supabase.js';

type CliOptions = {
  includeDraftLessons: boolean;
  limit: number | null;
  maxBlocked: number | null;
  maxFlagged: number | null;
  maxFlaggedRate: number | null;
  maxGeneric: number | null;
  outputBase: string;
  previewCount: number;
};

type QuestionRow = {
  id: number;
  prompt: string | null;
  question_type: string | null;
  subject_id: number | null;
  topic_id: number | null;
  question_options?: Array<{
    content: string | null;
    is_correct: boolean | null;
  }> | null;
  question_skills?: Array<{
    skill_id: number | null;
  }> | null;
};

type SubjectRow = {
  id: number;
  name: string;
};

type TopicRow = {
  id: number;
  name: string;
};

type LessonSkillRow = {
  lesson_id: number;
  skill_id: number;
};

type LessonRow = {
  id: number;
  title: string | null;
  module_id: number | null;
  visibility: string | null;
};

type ModuleRow = {
  id: number;
  slug: string;
  title: string | null;
  subject: string | null;
  grade_band: string | null;
};

type FlaggedQuestionRecord = {
  questionId: number;
  prompt: string;
  questionType: string | null;
  subject: string | null;
  topic: string | null;
  shouldBlock: boolean;
  isGeneric: boolean;
  severity: 'high' | 'medium' | 'low';
  rankScore: number;
  reasons: string[];
  impactedLessonCount: number;
  impactedModuleCount: number;
  impactedLessonIds: number[];
  impactedLessonTitles: string[];
  impactedModuleSlugs: string[];
};

type LessonImpactRecord = {
  lessonId: number;
  lessonTitle: string;
  moduleSlug: string | null;
  moduleTitle: string | null;
  subject: string | null;
  gradeBand: string | null;
  totalLinkedQuestions: number;
  flaggedLinkedQuestions: number;
  blockedLinkedQuestions: number;
  genericLinkedQuestions: number;
  flaggedQuestionIds: number[];
  reasonCounts: Record<string, number>;
};

type ModuleImpactRecord = {
  moduleId: number;
  moduleSlug: string;
  moduleTitle: string | null;
  subject: string | null;
  gradeBand: string | null;
  lessonCount: number;
  totalLinkedQuestions: number;
  flaggedLinkedQuestions: number;
  blockedLinkedQuestions: number;
  genericLinkedQuestions: number;
  flaggedQuestionIds: number[];
  reasonCounts: Record<string, number>;
};

type AuditReport = {
  generatedAt: string;
  options: CliOptions;
  totals: {
    questionsAnalyzed: number;
    flaggedQuestions: number;
    blockedQuestions: number;
    genericQuestions: number;
    lessonsImpacted: number;
    modulesImpacted: number;
  };
  reasonCounts: Array<{ reason: string; count: number }>;
  flaggedBySubject: Array<{ subject: string; count: number }>;
  flaggedByGrade: Array<{ gradeBand: string; count: number }>;
  topFlaggedQuestions: FlaggedQuestionRecord[];
  topImpactedLessons: Array<
    LessonImpactRecord & {
      blockedRate: number;
      flaggedRate: number;
      allLinkedQuestionsBlocked: boolean;
    }
  >;
  topImpactedModules: Array<
    ModuleImpactRecord & {
      blockedRate: number;
      flaggedRate: number;
    }
  >;
  outputs: {
    json: string;
    flaggedQuestionsCsv: string;
    impactedLessonsCsv: string;
  };
};

const DEFAULT_OUTPUT_BASE = 'data/audits/question_bank_quality_audit';
const DEFAULT_PREVIEW_COUNT = 40;

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    includeDraftLessons: false,
    limit: null,
    maxBlocked: null,
    maxFlagged: null,
    maxFlaggedRate: null,
    maxGeneric: null,
    outputBase: DEFAULT_OUTPUT_BASE,
    previewCount: DEFAULT_PREVIEW_COUNT,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--include-draft-lessons') {
      options.includeDraftLessons = true;
      continue;
    }
    if (arg === '--limit') {
      const value = Number.parseInt(args[index + 1] ?? '', 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Expected a positive integer after --limit');
      }
      options.limit = value;
      index += 1;
      continue;
    }
    if (arg === '--max-flagged') {
      const value = Number.parseInt(args[index + 1] ?? '', 10);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('Expected a non-negative integer after --max-flagged');
      }
      options.maxFlagged = value;
      index += 1;
      continue;
    }
    if (arg === '--max-blocked') {
      const value = Number.parseInt(args[index + 1] ?? '', 10);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('Expected a non-negative integer after --max-blocked');
      }
      options.maxBlocked = value;
      index += 1;
      continue;
    }
    if (arg === '--max-generic') {
      const value = Number.parseInt(args[index + 1] ?? '', 10);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('Expected a non-negative integer after --max-generic');
      }
      options.maxGeneric = value;
      index += 1;
      continue;
    }
    if (arg === '--max-flagged-rate') {
      const value = Number.parseFloat(args[index + 1] ?? '');
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('Expected a non-negative number after --max-flagged-rate');
      }
      options.maxFlaggedRate = value;
      index += 1;
      continue;
    }
    if (arg === '--out' || arg === '--output-base') {
      const value = (args[index + 1] ?? '').trim();
      if (!value) {
        throw new Error(`Expected a file path after ${arg}`);
      }
      options.outputBase = value;
      index += 1;
      continue;
    }
    if (arg === '--preview' || arg === '--top') {
      const value = Number.parseInt(args[index + 1] ?? '', 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Expected a positive integer after ${arg}`);
      }
      options.previewCount = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const uniqueNumbers = (values: Array<number | null | undefined>): number[] =>
  Array.from(new Set(values.filter((value): value is number => typeof value === 'number')));

const summarizePrompt = (prompt: string, maxLength = 88): string => {
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
};

const normalizeVisibility = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase();

const shouldIncludeLesson = (lesson: LessonRow, includeDraftLessons: boolean): boolean => {
  if (includeDraftLessons) {
    return true;
  }
  const visibility = normalizeVisibility(lesson.visibility);
  return visibility.length === 0 || visibility === 'public';
};

const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

const ratioPercent = (numerator: number, denominator: number): number => {
  if (denominator <= 0) {
    return 0;
  }
  return roundToTenth((numerator / denominator) * 100);
};

const hasQualityGate = (options: CliOptions): boolean =>
  options.maxFlagged != null ||
  options.maxBlocked != null ||
  options.maxGeneric != null ||
  options.maxFlaggedRate != null;

const computeSeverity = (reasons: string[]): 'high' | 'medium' | 'low' => {
  if (
    reasons.some((reason) =>
      ['empty_prompt', 'placeholder_prompt', 'insufficient_options', 'missing_correct_option'].includes(reason),
    )
  ) {
    return 'high';
  }
  if (reasons.some((reason) => reason.startsWith('generic_'))) {
    return 'medium';
  }
  return 'low';
};

const computeRankScore = (
  reasons: string[],
  shouldBlock: boolean,
  impactedLessonCount: number,
  impactedModuleCount: number,
): number => {
  let score = shouldBlock ? 60 : 25;

  for (const reason of reasons) {
    if (reason === 'empty_prompt' || reason === 'placeholder_prompt') {
      score += 20;
    } else if (reason === 'insufficient_options' || reason === 'missing_correct_option') {
      score += 16;
    } else if (reason === 'generic_distractors') {
      score += 10;
    } else if (reason.startsWith('generic_')) {
      score += 8;
    } else {
      score += 4;
    }
  }

  score += Math.min(impactedLessonCount, 30);
  score += Math.min(impactedModuleCount * 3, 18);

  return score;
};

const csvEscape = (value: unknown): string => {
  const stringValue = String(value ?? '');
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const writeCsv = (outputPath: string, headers: string[], rows: Array<Record<string, unknown>>): void => {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
};

const sortReasonCounts = (counts: Record<string, number>): Array<{ reason: string; count: number }> =>
  Object.entries(counts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));

const fetchQuestions = async (
  limit: number | null,
): Promise<QuestionRow[]> => {
  const supabase = createServiceRoleClient();
  const rows = await fetchAllPaginated<QuestionRow>(
    (from, to) =>
      supabase
        .from('question_bank')
        .select(
          'id, prompt, question_type, subject_id, topic_id, question_options(content, is_correct), question_skills(skill_id)',
        )
        .order('id', { ascending: true })
        .range(from, to),
    { logLabel: 'question_bank_quality.questions' },
  );
  return limit == null ? rows : rows.slice(0, limit);
};

const fetchSubjects = async (): Promise<SubjectRow[]> => {
  const supabase = createServiceRoleClient();
  return fetchAllPaginated<SubjectRow>(
    (from, to) =>
      supabase.from('subjects').select('id, name').order('id', { ascending: true }).range(from, to),
    { logLabel: 'question_bank_quality.subjects' },
  );
};

const fetchTopics = async (): Promise<TopicRow[]> => {
  const supabase = createServiceRoleClient();
  return fetchAllPaginated<TopicRow>(
    (from, to) =>
      supabase.from('topics').select('id, name').order('id', { ascending: true }).range(from, to),
    { logLabel: 'question_bank_quality.topics' },
  );
};

const fetchLessonSkills = async (): Promise<LessonSkillRow[]> => {
  const supabase = createServiceRoleClient();
  return fetchAllPaginated<LessonSkillRow>(
    (from, to) =>
      supabase
        .from('lesson_skills')
        .select('lesson_id, skill_id')
        .order('lesson_id', { ascending: true })
        .range(from, to),
    { logLabel: 'question_bank_quality.lesson_skills' },
  );
};

const fetchLessons = async (): Promise<LessonRow[]> => {
  const supabase = createServiceRoleClient();
  return fetchAllPaginated<LessonRow>(
    (from, to) =>
      supabase
        .from('lessons')
        .select('id, title, module_id, visibility')
        .order('id', { ascending: true })
        .range(from, to),
    { logLabel: 'question_bank_quality.lessons' },
  );
};

const fetchModulesByIds = async (moduleIds: number[]): Promise<ModuleRow[]> => {
  const supabase = createServiceRoleClient();
  const rows: ModuleRow[] = [];

  for (const group of chunk(uniqueNumbers(moduleIds), 250)) {
    if (!group.length) {
      continue;
    }
    const { data, error } = await supabase
      .from('modules')
      .select('id, slug, title, subject, grade_band')
      .in('id', group);

    if (error) {
      throw new Error(`Failed to load modules: ${error.message}`);
    }

    rows.push(...((data ?? []) as ModuleRow[]));
  }

  return rows;
};

const buildSkillToLessonIds = (
  lessonSkills: LessonSkillRow[],
  lessonMap: Map<number, LessonRow>,
): Map<number, number[]> => {
  const skillToLessonIds = new Map<number, number[]>();

  for (const row of lessonSkills) {
    if (!lessonMap.has(row.lesson_id)) {
      continue;
    }
    const current = skillToLessonIds.get(row.skill_id) ?? [];
    current.push(row.lesson_id);
    skillToLessonIds.set(row.skill_id, current);
  }

  return new Map(
    Array.from(skillToLessonIds.entries()).map(([skillId, lessonIds]) => [skillId, uniqueNumbers(lessonIds)]),
  );
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  const [questions, subjects, topics, lessonSkills, lessons] = await Promise.all([
    fetchQuestions(options.limit),
    fetchSubjects(),
    fetchTopics(),
    fetchLessonSkills(),
    fetchLessons(),
  ]);

  const lessonMap = new Map(
    lessons
      .filter((lesson) => shouldIncludeLesson(lesson, options.includeDraftLessons))
      .map((lesson) => [lesson.id, lesson] as const),
  );
  const moduleRows = await fetchModulesByIds(
    Array.from(new Set(Array.from(lessonMap.values()).map((lesson) => lesson.module_id ?? null))),
  );
  const moduleMap = new Map(moduleRows.map((module) => [module.id, module] as const));
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject.name] as const));
  const topicMap = new Map(topics.map((topic) => [topic.id, topic.name] as const));
  const skillToLessonIds = buildSkillToLessonIds(lessonSkills, lessonMap);

  const reasonCounts: Record<string, number> = {};
  const flaggedQuestions: FlaggedQuestionRecord[] = [];
  const flaggedBySubjectCounts: Record<string, number> = {};
  const flaggedByGradeCounts: Record<string, number> = {};
  const lessonImpacts = new Map<number, LessonImpactRecord>();
  const moduleImpacts = new Map<number, ModuleImpactRecord>();

  let blockedQuestions = 0;
  let genericQuestions = 0;

  for (const question of questions) {
    const questionSkillIds = uniqueNumbers((question.question_skills ?? []).map((row) => row.skill_id));
    const impactedLessonIds = uniqueNumbers(
      questionSkillIds.flatMap((skillId) => skillToLessonIds.get(skillId) ?? []),
    );
    const impactedLessons = impactedLessonIds
      .map((lessonId) => lessonMap.get(lessonId))
      .filter((lesson): lesson is LessonRow => Boolean(lesson));
    const impactedModuleIds = uniqueNumbers(
      impactedLessons.map((lesson) => lesson.module_id).filter((moduleId): moduleId is number => typeof moduleId === 'number'),
    );
    const impactedModules = impactedModuleIds
      .map((moduleId) => moduleMap.get(moduleId))
      .filter((module): module is ModuleRow => Boolean(module));

    for (const lesson of impactedLessons) {
      const current = lessonImpacts.get(lesson.id) ?? {
        lessonId: lesson.id,
        lessonTitle: lesson.title?.trim() || `Lesson ${lesson.id}`,
        moduleSlug: lesson.module_id != null ? moduleMap.get(lesson.module_id)?.slug ?? null : null,
        moduleTitle: lesson.module_id != null ? moduleMap.get(lesson.module_id)?.title ?? null : null,
        subject: lesson.module_id != null ? moduleMap.get(lesson.module_id)?.subject ?? null : null,
        gradeBand: lesson.module_id != null ? moduleMap.get(lesson.module_id)?.grade_band ?? null : null,
        totalLinkedQuestions: 0,
        flaggedLinkedQuestions: 0,
        blockedLinkedQuestions: 0,
        genericLinkedQuestions: 0,
        flaggedQuestionIds: [],
        reasonCounts: {},
      };

      current.totalLinkedQuestions += 1;
      lessonImpacts.set(lesson.id, current);
    }

    for (const module of impactedModules) {
      const current = moduleImpacts.get(module.id) ?? {
        moduleId: module.id,
        moduleSlug: module.slug,
        moduleTitle: module.title ?? null,
        subject: module.subject ?? null,
        gradeBand: module.grade_band ?? null,
        lessonCount: 0,
        totalLinkedQuestions: 0,
        flaggedLinkedQuestions: 0,
        blockedLinkedQuestions: 0,
        genericLinkedQuestions: 0,
        flaggedQuestionIds: [],
        reasonCounts: {},
      };

      current.totalLinkedQuestions += 1;
      moduleImpacts.set(module.id, current);
    }

    const quality = assessPracticeQuestionQuality({
      prompt: question.prompt,
      type: question.question_type,
      options: (question.question_options ?? []).map((option) => ({
        text: option.content,
        isCorrect: option.is_correct,
      })),
    });

    if (!quality.reasons.length) {
      continue;
    }

    incrementQuestionQualityReasonCounts(reasonCounts, quality.reasons);

    if (quality.shouldBlock) {
      blockedQuestions += 1;
    }
    if (quality.isGeneric) {
      genericQuestions += 1;
    }

    const severity = computeSeverity(quality.reasons);
    const rankScore = computeRankScore(
      quality.reasons,
      quality.shouldBlock,
      impactedLessonIds.length,
      impactedModuleIds.length,
    );
    const subjectName =
      (typeof question.subject_id === 'number' ? subjectMap.get(question.subject_id) : null) ?? null;
    const topicName = (typeof question.topic_id === 'number' ? topicMap.get(question.topic_id) : null) ?? null;

    flaggedQuestions.push({
      questionId: question.id,
      prompt: (question.prompt ?? '').trim(),
      questionType: question.question_type,
      subject: subjectName,
      topic: topicName,
      shouldBlock: quality.shouldBlock,
      isGeneric: quality.isGeneric,
      severity,
      rankScore,
      reasons: quality.reasons,
      impactedLessonCount: impactedLessonIds.length,
      impactedModuleCount: impactedModuleIds.length,
      impactedLessonIds,
      impactedLessonTitles: impactedLessons.map((lesson) => lesson.title?.trim() || `Lesson ${lesson.id}`),
      impactedModuleSlugs: impactedModules.map((module) => module.slug),
    });

    const subjectKey = subjectName ?? 'Unknown';
    flaggedBySubjectCounts[subjectKey] = (flaggedBySubjectCounts[subjectKey] ?? 0) + 1;

    for (const module of impactedModules) {
      const gradeKey = module.grade_band?.trim() || 'Unknown';
      flaggedByGradeCounts[gradeKey] = (flaggedByGradeCounts[gradeKey] ?? 0) + 1;
    }

    for (const lesson of impactedLessons) {
      const current = lessonImpacts.get(lesson.id);
      if (!current) {
        continue;
      }
      current.flaggedLinkedQuestions += 1;
      if (quality.shouldBlock) {
        current.blockedLinkedQuestions += 1;
      }
      if (quality.isGeneric) {
        current.genericLinkedQuestions += 1;
      }
      current.flaggedQuestionIds.push(question.id);
      incrementQuestionQualityReasonCounts(current.reasonCounts, quality.reasons);
      lessonImpacts.set(lesson.id, current);
    }

    for (const module of impactedModules) {
      const current = moduleImpacts.get(module.id);
      if (!current) {
        continue;
      }
      current.flaggedLinkedQuestions += 1;
      if (quality.shouldBlock) {
        current.blockedLinkedQuestions += 1;
      }
      if (quality.isGeneric) {
        current.genericLinkedQuestions += 1;
      }
      current.flaggedQuestionIds.push(question.id);
      incrementQuestionQualityReasonCounts(current.reasonCounts, quality.reasons);
      moduleImpacts.set(module.id, current);
    }
  }

  for (const moduleImpact of moduleImpacts.values()) {
    const lessonIdsInModule = new Set<number>();
    for (const lessonImpact of lessonImpacts.values()) {
      if (lessonImpact.moduleSlug === moduleImpact.moduleSlug) {
        lessonIdsInModule.add(lessonImpact.lessonId);
      }
    }
    moduleImpact.lessonCount = lessonIdsInModule.size;
  }

  const sortedFlaggedQuestions = flaggedQuestions.sort(
    (left, right) =>
      right.rankScore - left.rankScore ||
      right.impactedLessonCount - left.impactedLessonCount ||
      left.questionId - right.questionId,
  );

  const sortedLessonImpacts = Array.from(lessonImpacts.values())
    .map((lesson) => ({
      ...lesson,
      flaggedQuestionIds: uniqueNumbers(lesson.flaggedQuestionIds),
      blockedRate: ratioPercent(lesson.blockedLinkedQuestions, lesson.totalLinkedQuestions),
      flaggedRate: ratioPercent(lesson.flaggedLinkedQuestions, lesson.totalLinkedQuestions),
      allLinkedQuestionsBlocked:
        lesson.totalLinkedQuestions > 0 && lesson.blockedLinkedQuestions === lesson.totalLinkedQuestions,
    }))
    .sort(
      (left, right) =>
        Number(right.allLinkedQuestionsBlocked) - Number(left.allLinkedQuestionsBlocked) ||
        right.blockedRate - left.blockedRate ||
        right.flaggedLinkedQuestions - left.flaggedLinkedQuestions ||
        left.lessonId - right.lessonId,
    );

  const sortedModuleImpacts = Array.from(moduleImpacts.values())
    .map((module) => ({
      ...module,
      flaggedQuestionIds: uniqueNumbers(module.flaggedQuestionIds),
      blockedRate: ratioPercent(module.blockedLinkedQuestions, module.totalLinkedQuestions),
      flaggedRate: ratioPercent(module.flaggedLinkedQuestions, module.totalLinkedQuestions),
    }))
    .sort(
      (left, right) =>
        right.blockedRate - left.blockedRate ||
        right.flaggedLinkedQuestions - left.flaggedLinkedQuestions ||
        left.moduleId - right.moduleId,
    );

  const resolvedOutputBase = path.resolve(process.cwd(), options.outputBase);
  const reportPath = `${resolvedOutputBase}.json`;
  const flaggedCsvPath = `${resolvedOutputBase}_questions.csv`;
  const lessonsCsvPath = `${resolvedOutputBase}_lessons.csv`;

  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    options,
    totals: {
      questionsAnalyzed: questions.length,
      flaggedQuestions: sortedFlaggedQuestions.length,
      blockedQuestions,
      genericQuestions,
      lessonsImpacted: sortedLessonImpacts.length,
      modulesImpacted: sortedModuleImpacts.length,
    },
    reasonCounts: sortReasonCounts(reasonCounts),
    flaggedBySubject: Object.entries(flaggedBySubjectCounts)
      .map(([subject, count]) => ({ subject, count }))
      .sort((left, right) => right.count - left.count || left.subject.localeCompare(right.subject)),
    flaggedByGrade: Object.entries(flaggedByGradeCounts)
      .map(([gradeBand, count]) => ({ gradeBand, count }))
      .sort((left, right) => right.count - left.count || left.gradeBand.localeCompare(right.gradeBand)),
    topFlaggedQuestions: sortedFlaggedQuestions.slice(0, options.previewCount),
    topImpactedLessons: sortedLessonImpacts.slice(0, options.previewCount),
    topImpactedModules: sortedModuleImpacts.slice(0, options.previewCount),
    outputs: {
      json: reportPath,
      flaggedQuestionsCsv: flaggedCsvPath,
      impactedLessonsCsv: lessonsCsvPath,
    },
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  writeCsv(
    flaggedCsvPath,
    [
      'rank_score',
      'severity',
      'question_id',
      'should_block',
      'is_generic',
      'subject',
      'topic',
      'question_type',
      'reason_codes',
      'impacted_lesson_count',
      'impacted_module_count',
      'impacted_module_slugs',
      'impacted_lessons',
      'prompt',
    ],
    sortedFlaggedQuestions.map((record) => ({
      rank_score: record.rankScore,
      severity: record.severity,
      question_id: record.questionId,
      should_block: record.shouldBlock,
      is_generic: record.isGeneric,
      subject: record.subject ?? '',
      topic: record.topic ?? '',
      question_type: record.questionType ?? '',
      reason_codes: record.reasons.join('|'),
      impacted_lesson_count: record.impactedLessonCount,
      impacted_module_count: record.impactedModuleCount,
      impacted_module_slugs: record.impactedModuleSlugs.join('|'),
      impacted_lessons: record.impactedLessonTitles.join(' | '),
      prompt: record.prompt,
    })),
  );

  writeCsv(
    lessonsCsvPath,
    [
      'lesson_id',
      'module_slug',
      'subject',
      'grade_band',
      'total_linked_questions',
      'flagged_linked_questions',
      'blocked_linked_questions',
      'generic_linked_questions',
      'blocked_rate',
      'all_linked_questions_blocked',
      'reason_codes',
      'flagged_question_ids',
      'lesson_title',
    ],
    sortedLessonImpacts.map((record) => ({
      lesson_id: record.lessonId,
      module_slug: record.moduleSlug ?? '',
      subject: record.subject ?? '',
      grade_band: record.gradeBand ?? '',
      total_linked_questions: record.totalLinkedQuestions,
      flagged_linked_questions: record.flaggedLinkedQuestions,
      blocked_linked_questions: record.blockedLinkedQuestions,
      generic_linked_questions: record.genericLinkedQuestions,
      blocked_rate: record.blockedRate,
      all_linked_questions_blocked: record.allLinkedQuestionsBlocked,
      reason_codes: sortReasonCounts(record.reasonCounts)
        .map((entry) => `${entry.reason}:${entry.count}`)
        .join('|'),
      flagged_question_ids: record.flaggedQuestionIds.join('|'),
      lesson_title: record.lessonTitle,
    })),
  );

  console.log(
    [
      `Analyzed ${questions.length} question_bank rows.`,
      `Flagged ${sortedFlaggedQuestions.length} questions (${ratioPercent(sortedFlaggedQuestions.length, questions.length)}%).`,
      `Blocked ${blockedQuestions} questions; generic score hit ${genericQuestions}.`,
      `Impacted ${sortedLessonImpacts.length} lessons across ${sortedModuleImpacts.length} modules.`,
    ].join(' '),
  );

  console.log('\nTop reasons:');
  for (const entry of report.reasonCounts.slice(0, 12)) {
    console.log(`  ${entry.reason}: ${entry.count}`);
  }

  console.log('\nCleanup batch preview:');
  for (const record of sortedFlaggedQuestions.slice(0, Math.min(options.previewCount, 15))) {
    console.log(
      `  Q${record.questionId} [${record.severity}] score=${record.rankScore} lessons=${record.impactedLessonCount} modules=${record.impactedModuleCount} reasons=${record.reasons.join('|')} prompt="${summarizePrompt(record.prompt)}"`,
    );
  }

  console.log('\nOutputs:');
  console.log(`  JSON: ${reportPath}`);
  console.log(`  Flagged questions CSV: ${flaggedCsvPath}`);
  console.log(`  Impacted lessons CSV: ${lessonsCsvPath}`);

  if (hasQualityGate(options)) {
    const flaggedRate = ratioPercent(sortedFlaggedQuestions.length, questions.length);
    const failures: string[] = [];

    if (options.maxFlagged != null && sortedFlaggedQuestions.length > options.maxFlagged) {
      failures.push(`flagged ${sortedFlaggedQuestions.length} > max_flagged ${options.maxFlagged}`);
    }
    if (options.maxBlocked != null && blockedQuestions > options.maxBlocked) {
      failures.push(`blocked ${blockedQuestions} > max_blocked ${options.maxBlocked}`);
    }
    if (options.maxGeneric != null && genericQuestions > options.maxGeneric) {
      failures.push(`generic ${genericQuestions} > max_generic ${options.maxGeneric}`);
    }
    if (options.maxFlaggedRate != null && flaggedRate > options.maxFlaggedRate) {
      failures.push(`flagged_rate ${flaggedRate}% > max_flagged_rate ${options.maxFlaggedRate}%`);
    }

    console.log(`\nQuality gate: ${failures.length ? 'FAIL' : 'PASS'}`);
    if (failures.length) {
      failures.forEach((failure) => console.log(`  - ${failure}`));
      process.exitCode = 1;
    }
  }
};

const invokedFromCli =
  process.argv[1]?.includes('audit_question_bank_quality.ts') ||
  process.argv[1]?.includes('audit_question_bank_quality.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
