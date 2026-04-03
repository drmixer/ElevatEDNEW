import supabase from '../lib/supabaseClient';
import { formatSubjectLabel, normalizeSubject } from '../lib/subjects';
import { buildBlendedLearningPath, buildCanonicalLearningPath, type SubjectPlacementSnapshot } from '../lib/learningPaths';
import { applyLearningPreferencesToPlan, maxLessonsForSession } from '../lib/learningPlan';
import { castLearningPreferences } from './profileService';
import type { DashboardLesson, LearningPathItem, LearningPreferences, Subject } from '../types';
import { defaultLearningPreferences } from '../types';
import recordReliabilityCheckpoint from '../lib/reliability';

type SuggestionRow = {
  lesson_id: number | null;
  topic_id: number | null;
  reason: string | null;
  confidence: number | null;
};

type LessonMetadata = {
  id: number;
  title: string;
  moduleTitle: string | null;
  moduleSlug?: string | null;
  subject: Subject;
  estimatedDuration: number | null;
  status?: DashboardLesson['status'];
};

type SuggestionBuildResult = {
  lessons: Array<DashboardLesson & { suggestionReason?: string | null; suggestionConfidence?: number | null }>;
  learningPath: LearningPathItem[];
  messages: string[];
};

const loadSubjectPlacementSnapshots = async (studentId: string): Promise<SubjectPlacementSnapshot[]> => {
  const { data, error } = await supabase
    .from('student_subject_state')
    .select('subject, expected_level, working_level, recommended_module_slugs')
    .eq('student_id', studentId);

  if (error) {
    throw new Error(`Unable to load subject placements: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => {
      const subject = normalizeSubject((row.subject as string | null | undefined) ?? null);
      if (!subject) return null;
      return {
        subject,
        expectedLevel: (row.expected_level as number | null | undefined) ?? null,
        workingLevel: (row.working_level as number | null | undefined) ?? null,
        preferredModules: Array.isArray(row.recommended_module_slugs)
          ? row.recommended_module_slugs.filter((value): value is string => typeof value === 'string')
          : [],
      } satisfies SubjectPlacementSnapshot;
    })
    .filter((value): value is SubjectPlacementSnapshot => Boolean(value));
};

export const buildFallbackLearningPath = async (
  studentId: string,
  options?: {
    grade?: number | string | null;
    subject?: Subject | null;
    preferredModules?: string[];
    limit?: number;
  },
): Promise<LearningPathItem[]> => {
  const placements = await loadSubjectPlacementSnapshots(studentId).catch((error) => {
    console.warn('[adaptive] Unable to load subject placement snapshots', error);
    return [] as SubjectPlacementSnapshot[];
  });

  const limitCount = options?.limit && options.limit > 0 ? options.limit : 4;
  const mergedPlacements = placements.slice();

  const numericGrade =
    typeof options?.grade === 'number'
      ? options.grade
      : typeof options?.grade === 'string' && options.grade.trim().length
        ? Number.parseInt(options.grade, 10)
        : null;

  if (options?.subject) {
    const existing = mergedPlacements.find((entry) => entry.subject === options.subject);
    if (existing) {
      const preferred = new Set([...(existing.preferredModules ?? []), ...(options.preferredModules ?? [])]);
      existing.preferredModules = Array.from(preferred);
    } else {
      mergedPlacements.push({
        subject: options.subject,
        workingLevel: Number.isFinite(numericGrade) ? numericGrade : null,
        preferredModules: options.preferredModules ?? [],
      });
    }
  }

  const blendedPath = buildBlendedLearningPath({
    nominalGrade: options?.grade ?? null,
    placements: mergedPlacements,
    limit: limitCount,
  });
  if (blendedPath.length) return blendedPath;

  if (options?.subject) {
    return buildCanonicalLearningPath({
      grade: options.grade ?? null,
      subject: options.subject,
      preferredModules: options.preferredModules,
      limit: limitCount,
    }).slice(0, limitCount);
  }

  return [];
};

const difficultyFromDuration = (durationMinutes?: number | null): DashboardLesson['difficulty'] => {
  if (durationMinutes == null) return 'medium';
  if (durationMinutes <= 12) return 'easy';
  if (durationMinutes >= 35) return 'hard';
  return 'medium';
};

export const describeSuggestionReason = (
  reason: string | null,
  lessonTitle?: string | null,
  subject?: Subject | null,
  confidence?: number | null,
): string => {
  const base = lessonTitle ?? 'this lesson';
  const subjectLabel = subject ? formatSubjectLabel(subject) : 'this subject';
  const confidenceText = confidence != null ? ` (${Math.round(confidence * 100)}% confidence)` : '';

  switch (reason) {
    case 'reinforcement':
      return `Review "${base}" to reinforce ${subjectLabel}${confidenceText}.`;
    case 'complete_topic':
      return `Finish "${base}" to complete your current ${subjectLabel} topic${confidenceText}.`;
    case 'advance_next_topic':
      return `Advance with "${base}" to explore the next ${subjectLabel} concept${confidenceText}.`;
    case 'advance_canonical_module':
      return `Follow your grade-level path with "${base}"${confidenceText}.`;
    default:
      return `Start "${base}" to keep your ${subjectLabel} momentum going${confidenceText}.`;
  }
};

const mapLessonMetadata = (rows: unknown[]): Map<number, LessonMetadata> => {
  const map = new Map<number, LessonMetadata>();

  for (const row of rows) {
    const lessonId = (row as { id?: number })?.id;
    if (!lessonId) continue;
    const moduleTitle = (row as { modules?: { title?: string | null } | null })?.modules?.title ?? null;
    const moduleSlug = (row as { modules?: { slug?: string | null } | null })?.modules?.slug ?? null;
    const subject = normalizeSubject(
      (row as { modules?: { subject?: string | null } | null })?.modules?.subject ??
        (row as { subject?: string | null })?.subject ??
        null,
    );

    map.set(lessonId, {
      id: lessonId,
      title: ((row as { title?: string })?.title ?? 'Lesson') as string,
      moduleTitle,
      subject,
      estimatedDuration: (row as { estimated_duration_minutes?: number | null })?.estimated_duration_minutes ?? null,
      moduleSlug,
      status: 'not_started',
    });
  }

  return map;
};

const buildPlanFromSuggestions = (
  suggestions: SuggestionRow[],
  metadata: Map<number, LessonMetadata>,
): SuggestionBuildResult => {
  const lessons: SuggestionBuildResult['lessons'] = [];
  const learningPath: LearningPathItem[] = [];
  const messages: string[] = [];

  for (const suggestion of suggestions) {
    if (!suggestion.lesson_id) continue;
    const lessonMeta = metadata.get(suggestion.lesson_id);
    if (!lessonMeta) continue;

    const reasonText = describeSuggestionReason(
      suggestion.reason,
      lessonMeta.title,
      lessonMeta.subject,
      suggestion.confidence,
    );

    lessons.push({
      id: suggestion.lesson_id.toString(),
      subject: lessonMeta.subject,
      title: lessonMeta.title,
      status: lessonMeta.status ?? 'not_started',
      difficulty: difficultyFromDuration(lessonMeta.estimatedDuration),
      xpReward: Math.max(30, (lessonMeta.estimatedDuration ?? 12) * 3),
      launchUrl: `/lesson/${suggestion.lesson_id}`,
      suggestionReason: reasonText,
      suggestionConfidence: suggestion.confidence,
    });

    learningPath.push({
      id: suggestion.lesson_id.toString(),
      subject: lessonMeta.subject,
      topic: lessonMeta.moduleTitle ?? lessonMeta.title,
      concept: suggestion.reason ?? 'adaptive_recommendation',
      difficulty: lessonMeta.estimatedDuration ?? 15,
      status: 'not_started',
      xpReward: Math.max(30, (lessonMeta.estimatedDuration ?? 12) * 3),
      moduleSlug: lessonMeta.moduleSlug ?? undefined,
    });

    messages.push(reasonText);
  }

  return { lessons, learningPath, messages };
};

export const refreshLearningPathFromSuggestions = async (
  studentId: string,
  limit = 4,
  options?: { grade?: number | string | null; subject?: Subject | null },
): Promise<SuggestionBuildResult> => {
  let grade = options?.grade ?? null;
  let preferences: LearningPreferences = { ...defaultLearningPreferences };
  const subject = options?.subject ?? null;

  try {
    const { data: profileRow } = await supabase
      .from('student_profiles')
      .select('grade, learning_style')
      .eq('id', studentId)
      .single();
    grade = grade ?? (profileRow?.grade as number | null) ?? null;
    if (profileRow?.learning_style) {
      preferences = castLearningPreferences(profileRow.learning_style);
    }
  } catch (profileError) {
    console.warn('[adaptive] Unable to load student profile for suggestions', profileError);
    recordReliabilityCheckpoint('adaptive_path', 'error', {
      phase: 'profile_load',
      error: profileError instanceof Error ? profileError.message : 'profile_load_failed',
      studentId,
    });
  }

  const limitCount = Math.max(
    1,
    Math.min(limit ?? 4, maxLessonsForSession[preferences.sessionLength] ?? 4),
  );

  const { data: suggestions, error } = await supabase.rpc('suggest_next_lessons', {
    p_student_id: studentId,
    limit_count: limitCount,
  });

  if (error) {
    console.warn('[adaptive] Failed to load suggestions', error);
    recordReliabilityCheckpoint('adaptive_path', 'error', {
      phase: 'suggestions_rpc',
      error: error.message,
      studentId,
    });
  }

  const suggestionRows = (suggestions ?? []) as SuggestionRow[];
  const lessonIds = suggestionRows
    .map((row) => row.lesson_id)
    .filter((id): id is number => typeof id === 'number');

  if (!lessonIds.length) {
    // Fallback to canonical path if no database suggestions yet.
    const canonicalLimit = maxLessonsForSession[preferences.sessionLength] ?? limitCount ?? 4;
    const canonicalPath = await buildFallbackLearningPath(studentId, {
      grade,
      subject: subject ?? 'math',
      limit: canonicalLimit,
    });
    if (canonicalPath.length) {
      try {
        await supabase.from('student_profiles').update({ learning_path: canonicalPath }).eq('id', studentId);
      } catch (persistError) {
        console.warn('[adaptive] Failed to persist canonical learning path', persistError);
      }
      recordReliabilityCheckpoint('adaptive_path', 'success', {
        fallback: 'canonical',
        lessonCount: canonicalPath.length,
        studentId,
      });
      const subjectCount = new Set(canonicalPath.map((item) => item.subject)).size;
      return {
        lessons: [],
        learningPath: canonicalPath,
        messages: [subjectCount > 1 ? 'Starting with a blended path tuned from your diagnostic.' : 'Starting your grade-level path.'],
      };
    }

    return { lessons: [], learningPath: [], messages: [] };
  }

  const { data: lessonRows, error: lessonError } = await supabase
    .from('lessons')
    .select('id, title, estimated_duration_minutes, open_track, module_id, modules ( title, subject, slug )')
    .in('id', lessonIds);

  if (lessonError) {
    console.warn('[adaptive] Failed to hydrate lesson metadata for suggestions', lessonError);
    recordReliabilityCheckpoint('adaptive_path', 'error', {
      phase: 'lesson_metadata',
      error: lessonError.message,
      studentId,
    });
    return { lessons: [], learningPath: [], messages: [] };
  }

  const metadata = mapLessonMetadata(lessonRows ?? []);
  const plan = buildPlanFromSuggestions(suggestionRows, metadata);
  const cappedLessons = applyLearningPreferencesToPlan(plan.lessons, preferences);
  const cappedCount =
    cappedLessons.length || (maxLessonsForSession[preferences.sessionLength] ?? limitCount);
  const trimmedLearningPath = plan.learningPath.slice(0, cappedCount);

  try {
    await supabase
      .from('student_profiles')
      .update({ learning_path: trimmedLearningPath })
      .eq('id', studentId);
  } catch (updateError) {
    console.warn('[adaptive] Failed to persist learning path suggestions', updateError);
  }

  recordReliabilityCheckpoint('adaptive_path', 'success', {
    lessonCount: cappedLessons.length,
    suggestions: suggestionRows.length,
    studentId,
  });

  return {
    ...plan,
    lessons: cappedLessons,
    learningPath: trimmedLearningPath,
    messages: plan.messages.slice(0, cappedCount),
  };
};

export type { SuggestionRow, SuggestionBuildResult };
