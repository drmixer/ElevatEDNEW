import supabase from '../lib/supabaseClient';
import type { LessonPracticeQuestion, Subject } from '../types';

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
    }

    if (subjectRow?.id) {
      const { data: subjectQuestions, error: subjectQuestionsError } = await supabase
        .from('question_bank')
        .select('id')
        .eq('subject_id', subjectRow.id)
        .limit(limit * 4);

      if (subjectQuestionsError) {
        console.warn('[lesson-quiz] Failed to load subject practice questions', subjectQuestionsError);
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
  }
};
