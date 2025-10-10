import supabase from '../lib/supabaseClient';

export type LessonProgressStatus = 'not_started' | 'in_progress' | 'completed';

type StudentProgressRow = {
  id: number;
  status: LessonProgressStatus;
  mastery_pct: number | null;
  attempts: number | null;
  last_activity_at: string;
};

type PracticeSessionRow = {
  id: number;
  started_at: string;
  ended_at: string | null;
  metadata: Record<string, unknown> | null;
};

export type LessonSessionMetadata = {
  completed_items?: string[];
  module_id?: number | null;
  module_title?: string | null;
  lesson_title?: string | null;
  subject?: string | null;
  last_progress_pct?: number;
  updated_at?: string;
};

export type LessonProgressSnapshot = {
  status: LessonProgressStatus;
  masteryPct: number;
  attempts: number;
  lastActivityAt: string | null;
  completedItems: string[];
  session: {
    id: number;
    startedAt: string;
    endedAt: string | null;
    metadata: LessonSessionMetadata;
  } | null;
};

export type LessonContext = {
  studentId: string;
  lessonId: number;
  moduleId?: number | null;
  moduleTitle?: string | null;
  lessonTitle?: string | null;
  subject?: string | null;
};

const normalizeCompletedItems = (metadata: LessonSessionMetadata | null | undefined): string[] => {
  if (!metadata) return [];
  const raw = metadata.completed_items;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.length > 0);
};

export const fetchLessonProgress = async (
  context: LessonContext,
): Promise<LessonProgressSnapshot> => {
  const { studentId, lessonId } = context;

  const [progressResult, sessionResult] = await Promise.all([
    supabase
      .from('student_progress')
      .select('id, status, mastery_pct, attempts, last_activity_at')
      .eq('student_id', studentId)
      .eq('lesson_id', lessonId)
      .maybeSingle(),
    supabase
      .from('practice_sessions')
      .select('id, started_at, ended_at, metadata')
      .eq('student_id', studentId)
      .eq('lesson_id', lessonId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (progressResult.error) {
    console.warn('[progress] failed to load student_progress', progressResult.error);
  }
  if (sessionResult.error) {
    console.warn('[progress] failed to load latest practice session', sessionResult.error);
  }

  const progressRow = (progressResult.data ?? null) as StudentProgressRow | null;
  const sessionRow = (sessionResult.data ?? null) as PracticeSessionRow | null;

  const metadata = (sessionRow?.metadata ?? null) as LessonSessionMetadata | null;

  return {
    status: progressRow?.status ?? 'not_started',
    masteryPct: progressRow?.mastery_pct != null ? Number(progressRow.mastery_pct) : 0,
    attempts: progressRow?.attempts ?? 0,
    lastActivityAt: progressRow?.last_activity_at ?? null,
    completedItems: normalizeCompletedItems(metadata),
    session: sessionRow
      ? {
          id: sessionRow.id,
          startedAt: sessionRow.started_at,
          endedAt: sessionRow.ended_at,
          metadata: metadata ?? {},
        }
      : null,
  };
};

type StartSessionOptions = LessonContext & {
  initialCompletedItems?: string[];
  baselineAttempts?: number;
};

export const startLessonSession = async (
  options: StartSessionOptions,
): Promise<{ sessionId: number; startedAt: string; attempts: number }> => {
  const {
    studentId,
    lessonId,
    moduleId,
    moduleTitle,
    lessonTitle,
    subject,
    initialCompletedItems = [],
    baselineAttempts = 0,
  } = options;

  const metadata: LessonSessionMetadata = {
    module_id: moduleId ?? null,
    module_title: moduleTitle ?? null,
    lesson_title: lessonTitle ?? null,
    subject: subject ?? null,
    completed_items: initialCompletedItems,
    last_progress_pct: 0,
    updated_at: new Date().toISOString(),
  };

  const { data: insertRow, error: insertError } = await supabase
    .from('practice_sessions')
    .insert({
      student_id: studentId,
      lesson_id: lessonId,
      metadata,
    })
    .select('id, started_at')
    .single();

  if (insertError) {
    console.error('[progress] failed to start practice_session', insertError);
    throw insertError;
  }

  const attempts = baselineAttempts + 1;

  const { error: upsertError } = await supabase
    .from('student_progress')
    .upsert(
      {
        student_id: studentId,
        lesson_id: lessonId,
        status: 'in_progress',
        attempts,
        last_activity_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,lesson_id' },
    );

  if (upsertError) {
    console.warn('[progress] failed to upsert student_progress on session start', upsertError);
  }

  try {
    await supabase.from('practice_events').insert({
      session_id: insertRow.id,
      event_order: 1,
      event_type: 'lesson_view',
      lesson_id: lessonId,
      payload: {
        phase: 'start',
        module_id: moduleId ?? null,
        module_title: moduleTitle ?? null,
        lesson_title: lessonTitle ?? null,
        subject: subject ?? null,
      },
    });
  } catch (eventError) {
    console.warn('[progress] failed to log start practice_event', eventError);
  }

  return {
    sessionId: insertRow.id,
    startedAt: insertRow.started_at,
    attempts,
  };
};

type UpdateProgressOptions = LessonContext & {
  sessionId: number;
  completedItems: string[];
  progressPct: number;
  status: LessonProgressStatus;
  attempts: number;
};

export const updateLessonProgress = async (options: UpdateProgressOptions): Promise<void> => {
  const {
    studentId,
    lessonId,
    moduleId,
    moduleTitle,
    lessonTitle,
    subject,
    sessionId,
    completedItems,
    progressPct,
    status,
    attempts,
  } = options;

  const metadataUpdate: LessonSessionMetadata = {
    module_id: moduleId ?? null,
    module_title: moduleTitle ?? null,
    lesson_title: lessonTitle ?? null,
    subject: subject ?? null,
    completed_items: completedItems,
    last_progress_pct: progressPct,
    updated_at: new Date().toISOString(),
  };

  const { error: sessionError } = await supabase
    .from('practice_sessions')
    .update({ metadata: metadataUpdate })
    .eq('id', sessionId)
    .eq('student_id', studentId);

  if (sessionError) {
    console.warn('[progress] failed to update practice_session metadata', sessionError);
  }

  const { error: upsertError } = await supabase
    .from('student_progress')
    .upsert(
      {
        student_id: studentId,
        lesson_id: lessonId,
        status,
        mastery_pct: progressPct,
        attempts,
        last_activity_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,lesson_id' },
    );

  if (upsertError) {
    console.warn('[progress] failed to update student_progress', upsertError);
  }
};

type CompleteSessionOptions = LessonContext & {
  sessionId: number;
  startedAt: string;
  completedItems: string[];
  progressPct: number;
  attempts: number;
};

export const completeLessonSession = async (
  options: CompleteSessionOptions,
): Promise<void> => {
  const {
    studentId,
    lessonId,
    moduleId,
    moduleTitle,
    lessonTitle,
    subject,
    sessionId,
    startedAt,
    completedItems,
    progressPct,
    attempts,
  } = options;

  const endTime = new Date();
  const durationSeconds = Math.max(
    0,
    Math.round((endTime.getTime() - new Date(startedAt).getTime()) / 1000),
  );

  const metadataUpdate: LessonSessionMetadata = {
    module_id: moduleId ?? null,
    module_title: moduleTitle ?? null,
    lesson_title: lessonTitle ?? null,
    subject: subject ?? null,
    completed_items: completedItems,
    last_progress_pct: progressPct,
    updated_at: endTime.toISOString(),
  };

  const { error: sessionError } = await supabase
    .from('practice_sessions')
    .update({
      ended_at: endTime.toISOString(),
      duration_seconds: durationSeconds,
      metadata: metadataUpdate,
    })
    .eq('id', sessionId)
    .eq('student_id', studentId);

  if (sessionError) {
    console.warn('[progress] failed to finalize practice_session', sessionError);
  }

  const { error: progressError } = await supabase
    .from('student_progress')
    .upsert(
      {
        student_id: studentId,
        lesson_id: lessonId,
        status: 'completed',
        mastery_pct: progressPct,
        attempts,
        last_activity_at: endTime.toISOString(),
      },
      { onConflict: 'student_id,lesson_id' },
    );

  if (progressError) {
    console.warn('[progress] failed to finalize student_progress', progressError);
  }

  try {
    await supabase.from('practice_events').insert({
      session_id: sessionId,
      event_order: 2,
      event_type: 'lesson_view',
      lesson_id: lessonId,
      payload: {
        phase: 'complete',
        duration_seconds: durationSeconds,
        completed_items: completedItems.length,
        module_id: moduleId ?? null,
        subject: subject ?? null,
      },
    });
  } catch (eventError) {
    console.warn('[progress] failed to log completion practice_event', eventError);
  }
};
