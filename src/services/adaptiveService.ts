import supabase from '../lib/supabaseClient';
import { formatSubjectLabel, normalizeSubject } from '../lib/subjects';
import { buildCanonicalLearningPath } from '../lib/learningPaths';
import type { DashboardLesson, LearningPathItem, Subject } from '../types';

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
  const { data: suggestions, error } = await supabase.rpc('suggest_next_lessons', {
    p_student_id: studentId,
    limit_count: limit,
  });

  if (error) {
    console.warn('[adaptive] Failed to load suggestions', error);
  }

  const suggestionRows = (suggestions ?? []) as SuggestionRow[];
  const lessonIds = suggestionRows
    .map((row) => row.lesson_id)
    .filter((id): id is number => typeof id === 'number');

  if (!lessonIds.length) {
    // Fallback to canonical path if no database suggestions yet.
    let grade = options?.grade ?? null;
    const subject = options?.subject ?? null;
    try {
      const { data: profileRow } = await supabase
        .from('student_profiles')
        .select('grade')
        .eq('id', studentId)
        .single();
      grade = grade ?? (profileRow?.grade as number | null) ?? null;
    } catch (profileError) {
      console.warn('[adaptive] Unable to load student profile for canonical path fallback', profileError);
    }

    const fallbackSubject = subject ?? 'math';
    const canonicalPath = buildCanonicalLearningPath({ grade, subject: fallbackSubject, limit });
    if (canonicalPath.length) {
      try {
        await supabase.from('student_profiles').update({ learning_path: canonicalPath }).eq('id', studentId);
      } catch (persistError) {
        console.warn('[adaptive] Failed to persist canonical learning path', persistError);
      }
      return { lessons: [], learningPath: canonicalPath, messages: ['Starting your grade-level path.'] };
    }

    return { lessons: [], learningPath: [], messages: [] };
  }

  const { data: lessonRows, error: lessonError } = await supabase
    .from('lessons')
    .select('id, title, estimated_duration_minutes, open_track, module_id, modules ( title, subject, slug )')
    .in('id', lessonIds);

  if (lessonError) {
    console.warn('[adaptive] Failed to hydrate lesson metadata for suggestions', lessonError);
    return { lessons: [], learningPath: [], messages: [] };
  }

  const metadata = mapLessonMetadata(lessonRows ?? []);
  const plan = buildPlanFromSuggestions(suggestionRows, metadata);

  try {
    await supabase
      .from('student_profiles')
      .update({ learning_path: plan.learningPath })
      .eq('id', studentId);
  } catch (updateError) {
    console.warn('[adaptive] Failed to persist learning path suggestions', updateError);
  }

  return plan;
};

export type { SuggestionRow, SuggestionBuildResult };
