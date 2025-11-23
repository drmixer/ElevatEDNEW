import supabase from '../lib/supabaseClient';
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
  subject: Subject;
  estimatedDuration: number | null;
  status?: DashboardLesson['status'];
};

type SuggestionBuildResult = {
  lessons: Array<DashboardLesson & { suggestionReason?: string | null; suggestionConfidence?: number | null }>;
  learningPath: LearningPathItem[];
  messages: string[];
};

const SUBJECT_LABELS: Record<Subject, string> = {
  math: 'Math',
  english: 'English',
  science: 'Science',
  social_studies: 'Social Studies',
};

const normalizeSubject = (value: unknown): Subject => {
  if (typeof value !== 'string') return 'math';
  const normalized = value.toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'socialstudies') return 'social_studies';
  if (['math', 'english', 'science', 'social_studies'].includes(normalized)) {
    return normalized as Subject;
  }
  return 'math';
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
  const subjectLabel = subject ? SUBJECT_LABELS[subject] : 'this subject';
  const confidenceText = confidence != null ? ` (${Math.round(confidence * 100)}% confidence)` : '';

  switch (reason) {
    case 'reinforcement':
      return `Review "${base}" to reinforce ${subjectLabel}${confidenceText}.`;
    case 'complete_topic':
      return `Finish "${base}" to complete your current ${subjectLabel} topic${confidenceText}.`;
    case 'advance_next_topic':
      return `Advance with "${base}" to explore the next ${subjectLabel} concept${confidenceText}.`;
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
    });

    messages.push(reasonText);
  }

  return { lessons, learningPath, messages };
};

export const refreshLearningPathFromSuggestions = async (
  studentId: string,
  limit = 4,
): Promise<SuggestionBuildResult> => {
  const { data: suggestions, error } = await supabase.rpc('suggest_next_lessons', {
    p_student_id: studentId,
    limit_count: limit,
  });

  if (error) {
    console.warn('[adaptive] Failed to load suggestions', error);
    return { lessons: [], learningPath: [], messages: [] };
  }

  const suggestionRows = (suggestions ?? []) as SuggestionRow[];
  const lessonIds = suggestionRows
    .map((row) => row.lesson_id)
    .filter((id): id is number => typeof id === 'number');

  if (!lessonIds.length) {
    return { lessons: [], learningPath: [], messages: [] };
  }

  const { data: lessonRows, error: lessonError } = await supabase
    .from('lessons')
    .select('id, title, estimated_duration_minutes, open_track, module_id, modules ( title, subject )')
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
