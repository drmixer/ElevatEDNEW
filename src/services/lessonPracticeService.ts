import supabase from '../lib/supabaseClient';
import type { LessonPracticeQuestion, Subject } from '../types';
import recordReliabilityCheckpoint from '../lib/reliability';

type LessonSkillRow = { skill_id: number };
type QuestionSkillRow = { question_id: number; skill_id: number };
type QuestionRow = {
  id: number;
  prompt: string;
  question_type: LessonPracticeQuestion['type'];
  solution_explanation?: string | null;
  question_options?: Array<{
    id: number;
    option_order: number;
    content: string;
    is_correct: boolean;
    feedback?: string | null;
  }> | null;
  question_skills?: Array<{ skill_id: number | null }> | null;
};

const normalizeSubjectName = (subject: Subject | string | null | undefined): string | null => {
  if (!subject) return null;
  return subject.toString().replace(/_/g, ' ').toLowerCase();
};

export const calculateMasteryPct = (correct: number, total: number): number => {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const ratio = Math.max(0, Math.min(correct, total)) / total;
  return Math.round(ratio * 100);
};

export const fetchLessonCheckQuestions = async (
  lessonId: number,
  subject?: Subject | null,
  limit = 4,
): Promise<LessonPracticeQuestion[]> => {
  const [{ data: lessonSkills, error: skillError }] = await Promise.all([
    supabase.from('lesson_skills').select('skill_id').eq('lesson_id', lessonId),
  ]);

  if (skillError) {
    console.warn('[lesson-quiz] Unable to load lesson skills', skillError);
    recordReliabilityCheckpoint('lesson_playback', 'error', {
      phase: 'lesson_skills',
      lessonId,
      error: skillError.message,
    });
  }

  const skillIds = ((lessonSkills ?? []) as LessonSkillRow[])
    .map((row) => row.skill_id)
    .filter((value): value is number => typeof value === 'number');

  let candidateQuestionIds: number[] = [];

  if (skillIds.length) {
    const { data: questionSkillRows, error: questionSkillError } = await supabase
      .from('question_skills')
      .select('question_id, skill_id')
      .in('skill_id', skillIds)
      .limit(limit * 4);

    if (questionSkillError) {
      console.warn('[lesson-quiz] Failed to load skill-aligned questions', questionSkillError);
      recordReliabilityCheckpoint('lesson_playback', 'error', {
        phase: 'question_skills',
        lessonId,
        error: questionSkillError.message,
      });
    } else {
      candidateQuestionIds = Array.from(
        new Set(
          ((questionSkillRows ?? []) as QuestionSkillRow[]).map(
            (row) => row.question_id,
          ),
        ),
      );
    }
  }

  if (!candidateQuestionIds.length && subject) {
    const subjectName = normalizeSubjectName(subject);
    const { data: subjectRow, error: subjectError } = await supabase
      .from('subjects')
      .select('id, name')
      .ilike('name', `%${subjectName ?? ''}%`)
      .maybeSingle();

    if (subjectError) {
      console.warn('[lesson-quiz] Unable to resolve subject for practice questions', subjectError);
      recordReliabilityCheckpoint('lesson_playback', 'error', {
        phase: 'subject_lookup',
        lessonId,
        error: subjectError.message,
      });
    }

    if (subjectRow?.id) {
      const { data: subjectQuestions, error: subjectQuestionsError } = await supabase
        .from('question_bank')
        .select('id')
        .eq('subject_id', subjectRow.id)
        .limit(limit * 4);

      if (subjectQuestionsError) {
        console.warn('[lesson-quiz] Failed to load subject practice questions', subjectQuestionsError);
        recordReliabilityCheckpoint('lesson_playback', 'error', {
          phase: 'subject_questions',
          lessonId,
          error: subjectQuestionsError.message,
        });
      } else {
        candidateQuestionIds = ((subjectQuestions ?? []) as Array<{ id: number }>)
          .map((row) => row.id)
          .filter((id): id is number => typeof id === 'number');
      }
    }
  }

  if (!candidateQuestionIds.length) {
    return [];
  }

  const { data: questionRows, error: questionError } = await supabase
    .from('question_bank')
    .select(
      'id, prompt, question_type, solution_explanation, question_options ( id, option_order, content, is_correct, feedback ), question_skills ( skill_id )',
    )
    .in('id', candidateQuestionIds.slice(0, limit * 2));

  if (questionError) {
    console.error('[lesson-quiz] Failed to load practice question details', questionError);
    recordReliabilityCheckpoint('lesson_playback', 'error', {
      phase: 'question_detail',
      lessonId,
      error: questionError.message,
    });
    return [];
  }

  const mappedQuestions: LessonPracticeQuestion[] = ((questionRows ?? []) as QuestionRow[]).map(
    (row) => ({
      id: row.id,
      prompt: row.prompt,
      type: row.question_type ?? 'multiple_choice',
      explanation: row.solution_explanation ?? null,
      options: Array.isArray(row.question_options)
        ? row.question_options
            .slice()
            .sort((a, b) => (a.option_order ?? 0) - (b.option_order ?? 0))
            .map((option) => ({
              id: option.id,
              text: option.content,
              isCorrect: option.is_correct,
              feedback: option.feedback ?? null,
            }))
        : [],
      skillIds: Array.isArray(row.question_skills)
        ? row.question_skills
            .map((entry) => entry.skill_id)
            .filter((id): id is number => typeof id === 'number')
        : [],
    }),
  );

  return mappedQuestions.slice(0, limit);
};

type QuestionAttemptInput = {
  studentId: string | null;
  lessonId: number;
  sessionId: number | null;
  questionId: number;
  optionId: number | null;
  isCorrect: boolean;
  timeSpentSeconds: number;
  skillIds?: number[];
  masteryPct?: number;
  status?: 'not_started' | 'in_progress' | 'completed';
  attempts?: number;
  eventOrder?: number | null;
};

export const recordLessonQuestionAttempt = async (input: QuestionAttemptInput): Promise<void> => {
  const {
    studentId,
    lessonId,
    sessionId,
    questionId,
    optionId,
    isCorrect,
    timeSpentSeconds,
    skillIds = [],
    masteryPct,
    status = 'in_progress',
    attempts,
    eventOrder,
  } = input;

  if (!studentId || !sessionId) {
    return;
  }

  let resolvedEventOrder = eventOrder ?? null;

  if (resolvedEventOrder == null) {
    const { data: lastEventRow, error: lastEventError } = await supabase
      .from('practice_events')
      .select('event_order')
      .eq('session_id', sessionId)
      .order('event_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastEventError) {
      console.warn('[lesson-quiz] Unable to hydrate practice event order', lastEventError);
    }

    resolvedEventOrder = ((lastEventRow?.event_order as number | undefined) ?? 1) + 1;
  }

  try {
    await supabase.from('practice_events').insert({
      session_id: sessionId,
      event_order: resolvedEventOrder,
      event_type: 'question_attempt',
      lesson_id: lessonId,
      question_id: questionId,
      payload: {
        option_id: optionId,
        is_correct: isCorrect,
        time_spent_seconds: Math.max(1, Math.round(timeSpentSeconds)),
        skill_ids: skillIds,
      },
    });
  } catch (eventError) {
    console.warn('[lesson-quiz] Failed to record practice event', eventError);
    recordReliabilityCheckpoint('lesson_playback', 'error', {
      phase: 'practice_event',
      lessonId,
      studentId,
      error: eventError instanceof Error ? eventError.message : 'practice_event_failed',
    });
  }

  try {
    await supabase
      .from('student_progress')
      .upsert(
        {
          student_id: studentId,
          lesson_id: lessonId,
          status,
          mastery_pct: masteryPct,
          score: masteryPct,
          attempts: attempts ?? 1,
          last_activity_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,lesson_id' },
      );
  } catch (progressError) {
    console.warn('[lesson-quiz] Failed to sync progress from quiz', progressError);
    recordReliabilityCheckpoint('lesson_playback', 'error', {
      phase: 'progress_upsert',
      lessonId,
      studentId,
      error: progressError instanceof Error ? progressError.message : 'progress_upsert_failed',
    });
  }
};

export const syncLessonMasteryFromCheck = async (params: {
  studentId: string | null;
  lessonId: number;
  sessionId: number | null;
  questions: LessonPracticeQuestion[];
  responses: Map<number, { isCorrect: boolean }>;
  attempts?: number;
  subject?: Subject | null;
  eventOrder?: number | null;
}): Promise<void> => {
  const { studentId, lessonId, sessionId, questions, responses, attempts = 1, subject, eventOrder } = params;
  if (!studentId || !sessionId) return;
  if (!questions.length || responses.size === 0) return;

  const skillTotals = new Map<number, { correct: number; total: number }>();
  let correctCount = 0;

  questions.forEach((question) => {
    const response = responses.get(question.id);
    if (!response) return;
    if (response.isCorrect) {
      correctCount += 1;
    }
    question.skillIds.forEach((skillId) => {
      const entry = skillTotals.get(skillId) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (response.isCorrect) {
        entry.correct += 1;
      }
      skillTotals.set(skillId, entry);
    });
  });

  if (!skillTotals.size) return;

  const skillIds = Array.from(skillTotals.keys());
  const { data: masteryRows, error: masteryError } = await supabase
    .from('student_mastery')
    .select('skill_id, mastery_pct')
    .eq('student_id', studentId)
    .in('skill_id', skillIds);

  if (masteryError) {
    console.warn('[lesson-quiz] Unable to load mastery baselines for lesson', masteryError);
  }

  const currentMastery = new Map<number, number>();
  (masteryRows ?? []).forEach((row) => {
    currentMastery.set(row.skill_id as number, Number(row.mastery_pct) || 0);
  });

  const nowIso = new Date().toISOString();
  const masteryPayload: Array<{
    student_id: string;
    skill_id: number;
    mastery_pct: number;
    last_evidence_at: string;
    evidence: Record<string, unknown>;
  }> = [];

  const masteryBySkill: Record<string, number> = {};

  skillTotals.forEach((totals, skillId) => {
    const percent = totals.total > 0 ? Math.round((totals.correct / totals.total) * 100) : 0;
    const prev = currentMastery.get(skillId) ?? 0;
    const blended = Math.min(100, Math.round(prev * 0.7 + percent * 0.3));
    masteryBySkill[String(skillId)] = blended;

    masteryPayload.push({
      student_id: studentId,
      skill_id: skillId,
      mastery_pct: blended,
      last_evidence_at: nowIso,
      evidence: {
        source: 'lesson_check',
        lesson_id: lessonId,
        session_id: sessionId,
        correct: totals.correct,
        total: totals.total,
      },
    });
  });

  if (masteryPayload.length) {
    const { error: upsertError } = await supabase
      .from('student_mastery')
      .upsert(masteryPayload, { onConflict: 'student_id,skill_id' });

    if (upsertError) {
      console.warn('[lesson-quiz] Failed to update student_mastery from lesson', upsertError);
      recordReliabilityCheckpoint('lesson_playback', 'error', {
        phase: 'mastery_upsert',
        lessonId,
        studentId,
        error: upsertError.message,
      });
    }
  }

  const masteryPct = calculateMasteryPct(correctCount, responses.size || questions.length);
  const status: QuestionAttemptInput['status'] =
    responses.size >= questions.length ? 'completed' : 'in_progress';

  try {
    await supabase
      .from('student_progress')
      .upsert(
        {
          student_id: studentId,
          lesson_id: lessonId,
          status,
          mastery_pct: masteryPct,
          attempts,
          last_activity_at: nowIso,
        },
        { onConflict: 'student_id,lesson_id' },
      );
  } catch (progressError) {
    console.warn('[lesson-quiz] Failed to refresh student_progress rollup', progressError);
    recordReliabilityCheckpoint('lesson_playback', 'error', {
      phase: 'progress_rollup',
      lessonId,
      studentId,
      error: progressError instanceof Error ? progressError.message : 'progress_rollup_failed',
    });
  }

  if (eventOrder != null) {
    try {
      await supabase.from('practice_events').insert({
        session_id: sessionId,
        event_order: eventOrder,
        event_type: 'lesson_mastery',
        lesson_id: lessonId,
        payload: {
          mastery_pct: masteryPct,
          mastery_by_skill: masteryBySkill,
          subject,
        },
      });
    } catch (eventError) {
      console.warn('[lesson-quiz] Failed to log mastery practice_event', eventError);
      recordReliabilityCheckpoint('lesson_playback', 'error', {
        phase: 'mastery_event',
        lessonId,
        studentId,
        error: eventError instanceof Error ? eventError.message : 'mastery_event_failed',
      });
    }
  }
};
