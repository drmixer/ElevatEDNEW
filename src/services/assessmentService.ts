import supabase from '../lib/supabaseClient';
import type { Subject } from '../types';
import { refreshLearningPathFromSuggestions } from './adaptiveService';

export type AssessmentOption = {
  id: number;
  text: string;
  isCorrect: boolean;
  feedback?: string | null;
};

export type AssessmentQuestion = {
  id: string;
  bankQuestionId: number;
  prompt: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank';
  options: AssessmentOption[];
  weight: number;
  difficulty: number;
  concept: string;
  skillIds: number[];
  subjectId: number | null;
  topicId: number | null;
};

export type LoadedAssessment = {
  assessmentId: number;
  attemptId: number;
  attemptNumber: number;
  title: string;
  description: string | null;
  subject: Subject | null;
  estimatedDurationMinutes: number | null;
  questions: AssessmentQuestion[];
  existingResponses: Map<number, { selectedOptionId: number | null; isCorrect: boolean | null }>;
};

export type AssessmentAnswer = {
  questionId: string;
  bankQuestionId: number;
  optionId: number | null;
  isCorrect: boolean;
  timeSpent: number;
  weight: number;
  concept: string;
  skillIds: number[];
};

export type AssessmentResult = {
  score: number;
  correct: number;
  total: number;
  strengths: string[];
  weaknesses: string[];
  planMessages: string[];
};

type AssessmentRow = {
  id: number;
  title: string;
  description?: string | null;
  subject_id?: number | null;
  estimated_duration_minutes?: number | null;
  metadata?: Record<string, unknown> | null;
  module_id?: number | null;
  modules?: { title?: string | null; subject?: string | null } | null;
};

type AssessmentQuestionLink = {
  question_id: number;
  section_id: number;
  question_order: number;
  weight: number | null;
  metadata: Record<string, unknown> | null;
};

type QuestionBankRow = {
  id: number;
  prompt: string;
  question_type: AssessmentQuestion['type'];
  difficulty: number | null;
  solution_explanation?: string | null;
  metadata?: Record<string, unknown> | null;
  tags?: string[] | null;
  subject_id?: number | null;
};

type QuestionOptionRow = {
  id: number;
  question_id: number;
  option_order: number;
  content: string;
  is_correct: boolean;
  feedback?: string | null;
};

type QuestionSkillRow = {
  question_id: number;
  skill_id: number;
  skills?: { name?: string | null } | null;
};

const normalizeSubject = (value: unknown): Subject | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'socialstudies') return 'social_studies';
  if (['math', 'english', 'science', 'social_studies'].includes(normalized)) {
    return normalized as Subject;
  }
  return null;
};

const deriveConcept = (
  question: QuestionBankRow,
  link: AssessmentQuestionLink,
  moduleTitle: string | null,
): string => {
  const tags = Array.isArray(question.tags) ? question.tags : [];
  if (tags.length) {
    return tags[0] ?? 'Concept focus';
  }
  const metadata = (question.metadata ?? {}) as Record<string, unknown>;
  const standardsValue = metadata.standards;
  if (Array.isArray(standardsValue) && standardsValue.length) {
    return String(standardsValue[0]);
  }
  if (typeof link.metadata?.module_slug === 'string') {
    return link.metadata.module_slug;
  }
  return moduleTitle ?? 'Concept focus';
};

const pickAssessment = (rows: AssessmentRow[]): AssessmentRow | null => {
  if (!rows.length) return null;
  const preferred = rows.find((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const purpose = typeof meta.purpose === 'string' ? meta.purpose.toLowerCase() : '';
    return purpose.includes('diagnostic') || meta.diagnostic === true || meta.is_adaptive === true;
  });
  if (preferred) return preferred;
  const baseline = rows.find((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const purpose = typeof meta.purpose === 'string' ? meta.purpose.toLowerCase() : '';
    return purpose.includes('baseline');
  });
  return baseline ?? rows[0] ?? null;
};

const fetchAssessmentDefinition = async (studentId: string): Promise<LoadedAssessment> => {
  const { data: assessments, error: assessmentError } = await supabase
    .from('assessments')
    .select(
      'id, title, description, subject_id, estimated_duration_minutes, metadata, module_id, modules ( title, subject )',
    )
    .order('created_at', { ascending: false })
    .limit(5);

  if (assessmentError) {
    throw new Error(`Unable to load assessment definitions: ${assessmentError.message}`);
  }

  const assessmentRow = pickAssessment((assessments ?? []) as AssessmentRow[]);
  if (!assessmentRow) {
    throw new Error('No assessments have been configured yet.');
  }

  const moduleTitle = assessmentRow.modules?.title ?? null;
  const subject = normalizeSubject(assessmentRow.modules?.subject ?? null) ?? null;

  const { data: sectionRows, error: sectionError } = await supabase
    .from('assessment_sections')
    .select('id, section_order')
    .eq('assessment_id', assessmentRow.id)
    .order('section_order', { ascending: true });

  if (sectionError) {
    throw new Error(`Failed to load assessment sections: ${sectionError.message}`);
  }

  const sectionIds = (sectionRows ?? []).map((section) => section.id as number);
  if (!sectionIds.length) {
    throw new Error('Assessment is missing sections or questions.');
  }
  const { data: links, error: linkError } = await supabase
    .from('assessment_questions')
    .select('question_id, section_id, question_order, weight, metadata')
    .in('section_id', sectionIds)
    .order('question_order', { ascending: true });

  if (linkError) {
    throw new Error(`Failed to load assessment questions: ${linkError.message}`);
  }

  const questionLinks = (links ?? []) as AssessmentQuestionLink[];
  const questionIds = Array.from(new Set(questionLinks.map((link) => link.question_id)));
  if (!questionIds.length) {
    throw new Error('Assessment does not have any questions configured.');
  }

  const [questionBankResult, optionsResult, skillsResult] = await Promise.all([
    supabase
      .from('question_bank')
      .select('id, prompt, question_type, difficulty, solution_explanation, metadata, tags, subject_id')
      .in('id', questionIds),
    supabase
      .from('question_options')
      .select('id, question_id, option_order, content, is_correct, feedback')
      .in('question_id', questionIds)
      .order('option_order', { ascending: true }),
    supabase
      .from('question_skills')
      .select('question_id, skill_id, skills ( name )')
      .in('question_id', questionIds),
  ]);

  if (questionBankResult.error) {
    throw new Error(`Failed to load assessment questions: ${questionBankResult.error.message}`);
  }
  if (optionsResult.error) {
    throw new Error(`Failed to load assessment options: ${optionsResult.error.message}`);
  }
  if (skillsResult.error) {
    console.warn('[assessment] Unable to load question skill mappings', skillsResult.error);
  }

  const bankLookup = new Map<number, QuestionBankRow>();
  (questionBankResult.data ?? []).forEach((row) => {
    bankLookup.set(row.id as number, row as QuestionBankRow);
  });

  const optionLookup = new Map<number, AssessmentOption[]>();
  (optionsResult.data ?? []).forEach((row) => {
    const optionRow = row as QuestionOptionRow;
    const list = optionLookup.get(optionRow.question_id) ?? [];
    list.push({
      id: optionRow.id,
      text: optionRow.content,
      isCorrect: optionRow.is_correct,
      feedback: optionRow.feedback ?? null,
    });
    optionLookup.set(optionRow.question_id, list);
  });

  const skillLookup = new Map<number, { id: number; name: string | null }[]>();
  (skillsResult.data ?? []).forEach((row) => {
    const skillRow = row as QuestionSkillRow;
    const list = skillLookup.get(skillRow.question_id) ?? [];
    list.push({ id: skillRow.skill_id, name: skillRow.skills?.name ?? null });
    skillLookup.set(skillRow.question_id, list);
  });

  const questions = questionLinks
    .slice()
    .sort((a, b) => a.question_order - b.question_order)
    .map((link, index) => {
      const bankQuestion = bankLookup.get(link.question_id);
      if (!bankQuestion) {
        throw new Error(`Question ${link.question_id} missing from bank.`);
      }
      const options = (optionLookup.get(link.question_id) ?? []).sort((a, b) => a.id - b.id);
      const skillIds = (skillLookup.get(link.question_id) ?? []).map((skill) => skill.id);
      const concept = deriveConcept(bankQuestion, link, moduleTitle);

      return {
        id: `${link.question_id}`,
        bankQuestionId: link.question_id,
        prompt: bankQuestion.prompt,
        type: bankQuestion.question_type,
        options,
        weight: link.weight ?? 1,
        difficulty: bankQuestion.difficulty ?? 3,
        concept,
        skillIds,
        subjectId: bankQuestion.subject_id ?? assessmentRow.subject_id ?? null,
        topicId: typeof link.metadata?.topic_id === 'number' ? (link.metadata.topic_id as number) : null,
        order: link.question_order ?? index + 1,
      } satisfies AssessmentQuestion & { order: number };
    })
    .sort((a, b) => a.order - b.order)
    .map((q) => {
      const { order, ...rest } = q;
      return rest;
    });

  const { data: attemptRow, error: attemptError } = await supabase
    .from('student_assessment_attempts')
    .select('id, attempt_number, status')
    .eq('student_id', studentId)
    .eq('assessment_id', assessmentRow.id)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (attemptError && attemptError.code !== 'PGRST116') {
    throw new Error(`Failed to load assessment attempts: ${attemptError.message}`);
  }

  let attemptId = attemptRow?.id as number | undefined;
  let attemptNumber = (attemptRow?.attempt_number as number | undefined) ?? 0;

  if (!attemptId || attemptRow?.status !== 'in_progress') {
    const { data: newAttempt, error: insertError } = await supabase
      .from('student_assessment_attempts')
      .insert({
        student_id: studentId,
        assessment_id: assessmentRow.id,
        attempt_number: attemptNumber + 1,
        status: 'in_progress',
      })
      .select('id, attempt_number')
      .single();

    if (insertError || !newAttempt) {
      throw new Error(insertError ? `Failed to start assessment attempt: ${insertError.message}` : 'Attempt could not be created.');
    }

    attemptId = newAttempt.id as number;
    attemptNumber = (newAttempt.attempt_number as number | undefined) ?? attemptNumber + 1;
  }

  const existingResponses = new Map<number, { selectedOptionId: number | null; isCorrect: boolean | null }>();
  if (attemptId) {
    const { data: responseRows, error: responseError } = await supabase
      .from('student_assessment_responses')
      .select('question_id, selected_option_id, is_correct')
      .eq('attempt_id', attemptId);

    if (responseError) {
      console.warn('[assessment] Unable to hydrate previous responses', responseError);
    }

    (responseRows ?? []).forEach((row) => {
      existingResponses.set(row.question_id as number, {
        selectedOptionId: (row.selected_option_id as number | null) ?? null,
        isCorrect: row.is_correct as boolean | null,
      });
    });
  }

  return {
    assessmentId: assessmentRow.id,
    attemptId,
    attemptNumber,
    title: assessmentRow.title,
    description: assessmentRow.description ?? null,
    subject,
    estimatedDurationMinutes: assessmentRow.estimated_duration_minutes ?? null,
    questions,
    existingResponses,
  } satisfies LoadedAssessment;
};

export const loadDiagnosticAssessment = async (studentId: string): Promise<LoadedAssessment> => {
  return fetchAssessmentDefinition(studentId);
};

export const recordAssessmentResponse = async (
  params: {
    studentId: string;
    attemptId: number;
    assessmentId: number;
    question: AssessmentQuestion;
    optionId: number | null;
    timeSpentSeconds: number;
  },
): Promise<{ isCorrect: boolean } > => {
  const { studentId, attemptId, assessmentId, question, optionId, timeSpentSeconds } = params;
  const option = question.options.find((opt) => opt.id === optionId) ?? null;
  const isCorrect = option ? option.isCorrect : false;

  const payload = {
    attempt_id: attemptId,
    question_id: question.bankQuestionId,
    selected_option_id: optionId,
    response_content: option ? { text: option.text } : null,
    is_correct: isCorrect,
    score: isCorrect ? question.weight : 0,
    time_spent_seconds: Math.max(1, Math.round(timeSpentSeconds)),
  };

  const { error } = await supabase
    .from('student_assessment_responses')
    .upsert(payload, { onConflict: 'attempt_id,question_id' });

  if (error) {
    console.error('[assessment] Failed to save response', error);
    throw error;
  }

  try {
    await supabase
      .from('student_assessment_attempts')
      .update({
        metadata: { last_question_id: question.bankQuestionId },
        status: 'in_progress',
      })
      .eq('id', attemptId)
      .eq('student_id', studentId)
      .eq('assessment_id', assessmentId);
  } catch (attemptError) {
    console.warn('[assessment] Unable to update attempt progress', attemptError);
  }

  return { isCorrect };
};

const applyMasteryEvidence = async (
  studentId: string,
  answers: AssessmentAnswer[],
  attemptId: number,
): Promise<void> => {
  const skillTotals = new Map<number, { correct: number; total: number }>();

  answers.forEach((answer) => {
    answer.skillIds.forEach((skillId) => {
      const entry = skillTotals.get(skillId) ?? { correct: 0, total: 0 };
      if (answer.isCorrect) entry.correct += answer.weight;
      entry.total += answer.weight;
      skillTotals.set(skillId, entry);
    });
  });

  const skillIds = Array.from(skillTotals.keys());
  if (!skillIds.length) return;

  const { data: masteryRows, error: masteryError } = await supabase
    .from('student_mastery')
    .select('skill_id, mastery_pct')
    .eq('student_id', studentId)
    .in('skill_id', skillIds);

  if (masteryError) {
    console.warn('[assessment] Unable to load mastery baselines', masteryError);
  }

  const currentMastery = new Map<number, number>();
  (masteryRows ?? []).forEach((row) => {
    currentMastery.set(row.skill_id as number, Number(row.mastery_pct) || 0);
  });

  const nowIso = new Date().toISOString();
  const masteryPayload = [] as Array<{
    student_id: string;
    skill_id: number;
    mastery_pct: number;
    last_evidence_at: string;
    evidence: Record<string, unknown>;
  }>;
  const eventsPayload = [] as Array<{
    student_id: string;
    skill_id: number;
    assessment_attempt_id: number;
    source: string;
    delta_pct: number;
    mastery_pct_after: number;
    metadata: Record<string, unknown>;
  }>;

  skillTotals.forEach((value, skillId) => {
    const percent = value.total > 0 ? Math.round((value.correct / value.total) * 100) : 0;
    const prev = currentMastery.get(skillId) ?? 0;
    const blended = Math.min(100, Math.round(prev * 0.6 + percent * 0.4));

    masteryPayload.push({
      student_id: studentId,
      skill_id: skillId,
      mastery_pct: blended,
      last_evidence_at: nowIso,
      evidence: {
        source: 'diagnostic_assessment',
        attempt_id: attemptId,
        correct: value.correct,
        total: value.total,
      },
    });

    eventsPayload.push({
      student_id: studentId,
      skill_id: skillId,
      assessment_attempt_id: attemptId,
      source: 'diagnostic_assessment',
      delta_pct: blended - prev,
      mastery_pct_after: blended,
      metadata: {
        correct: value.correct,
        total: value.total,
      },
    });
  });

  if (masteryPayload.length) {
    const { error: upsertError } = await supabase
      .from('student_mastery')
      .upsert(masteryPayload, { onConflict: 'student_id,skill_id' });

    if (upsertError) {
      console.warn('[assessment] Failed to update mastery records', upsertError);
    }
  }

  if (eventsPayload.length) {
    const { error: eventsError } = await supabase.from('student_mastery_events').insert(eventsPayload);
    if (eventsError) {
      console.warn('[assessment] Failed to log mastery events', eventsError);
    }
  }

  // Push a baseline into student_progress so adaptive rules can reason about attempts and mastery.
  const { data: lessonSkills, error: lessonSkillError } = await supabase
    .from('lesson_skills')
    .select('lesson_id, skill_id')
    .in('skill_id', skillIds);

  if (lessonSkillError) {
    console.warn('[assessment] Unable to map skills to lessons', lessonSkillError);
    return;
  }

  const lessonTargetMastery = new Map<number, number>();
  (lessonSkills ?? []).forEach((row) => {
    const lessonId = row.lesson_id as number;
    const skillId = row.skill_id as number;
    const mastery = masteryPayload.find((entry) => entry.skill_id === skillId)?.mastery_pct;
    if (mastery == null) return;
    const existing = lessonTargetMastery.get(lessonId);
    lessonTargetMastery.set(lessonId, existing != null ? Math.max(existing, mastery) : mastery);
  });

  const lessonIds = Array.from(lessonTargetMastery.keys());
  if (!lessonIds.length) return;

  const { data: existingProgress, error: progressError } = await supabase
    .from('student_progress')
    .select('lesson_id, mastery_pct, attempts, status')
    .eq('student_id', studentId)
    .in('lesson_id', lessonIds);

  if (progressError) {
    console.warn('[assessment] Unable to load existing lesson progress', progressError);
  }

  const progressLookup = new Map<number, { mastery_pct: number | null; attempts: number | null; status: string | null }>();
  (existingProgress ?? []).forEach((row) => {
    progressLookup.set(row.lesson_id as number, {
      mastery_pct: row.mastery_pct as number | null,
      attempts: row.attempts as number | null,
      status: (row.status as string | null) ?? null,
    });
  });

  const progressPayload = [] as Array<{
    student_id: string;
    lesson_id: number;
    mastery_pct: number;
    attempts: number;
    status: 'not_started' | 'in_progress' | 'completed';
    last_activity_at: string;
  }>;

  lessonTargetMastery.forEach((targetMastery, lessonId) => {
    const baseline = progressLookup.get(lessonId);
    const attempts = (baseline?.attempts ?? 0) + 1;
    const updatedMastery = Math.max(baseline?.mastery_pct ?? 0, targetMastery);
    const status = baseline?.status === 'completed' ? 'completed' : 'in_progress';

    progressPayload.push({
      student_id: studentId,
      lesson_id: lessonId,
      mastery_pct: updatedMastery,
      attempts,
      status,
      last_activity_at: nowIso,
    });
  });

  if (progressPayload.length) {
    const { error: upsertProgressError } = await supabase
      .from('student_progress')
      .upsert(progressPayload, { onConflict: 'student_id,lesson_id' });

    if (upsertProgressError) {
      console.warn('[assessment] Failed to update student_progress baselines', upsertProgressError);
    }
  }
};

export const finalizeAssessmentAttempt = async (
  params: {
    studentId: string;
    assessment: LoadedAssessment;
    answers: AssessmentAnswer[];
    startedAt: Date;
  },
): Promise<AssessmentResult> => {
  const { studentId, assessment, answers, startedAt } = params;
  if (!answers.length) {
    throw new Error('Cannot finalize assessment without answers.');
  }

  const totalWeight = answers.reduce((acc, answer) => acc + answer.weight, 0);
  const earnedWeight = answers.reduce((acc, answer) => acc + (answer.isCorrect ? answer.weight : 0), 0);
  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  const conceptTotals = new Map<string, { correct: number; total: number }>();
  answers.forEach((answer) => {
    const entry = conceptTotals.get(answer.concept) ?? { correct: 0, total: 0 };
    if (answer.isCorrect) entry.correct += 1;
    entry.total += 1;
    conceptTotals.set(answer.concept, entry);
  });

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  conceptTotals.forEach((value, concept) => {
    const accuracy = value.total > 0 ? Math.round((value.correct / value.total) * 100) : 0;
    if (accuracy >= 75) strengths.push(concept);
    else if (accuracy <= 50) weaknesses.push(concept);
  });

  const finishedAt = new Date();

  const { error: attemptUpdateError } = await supabase
    .from('student_assessment_attempts')
    .update({
      status: 'completed',
      completed_at: finishedAt.toISOString(),
      total_score: earnedWeight,
      mastery_pct: score,
      metadata: {
        strengths,
        weaknesses,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
      },
    })
    .eq('id', assessment.attemptId)
    .eq('student_id', studentId)
    .eq('assessment_id', assessment.assessmentId);

  if (attemptUpdateError) {
    console.warn('[assessment] Failed to finalize attempt row', attemptUpdateError);
  }

  try {
    await applyMasteryEvidence(studentId, answers, assessment.attemptId);
  } catch (masteryError) {
    console.warn('[assessment] Mastery update failed', masteryError);
  }

  try {
    await supabase
      .from('student_profiles')
      .update({ assessment_completed: true })
      .eq('id', studentId);
  } catch (profileError) {
    console.warn('[assessment] Failed to flag assessment completion', profileError);
  }

  let planMessages: string[] = [];
  try {
    const plan = await refreshLearningPathFromSuggestions(studentId, 4);
    planMessages = plan.messages;
  } catch (planError) {
    console.warn('[assessment] Adaptive plan refresh failed', planError);
  }

  return {
    score,
    correct: answers.filter((answer) => answer.isCorrect).length,
    total: answers.length,
    strengths,
    weaknesses,
    planMessages,
  } satisfies AssessmentResult;
};
