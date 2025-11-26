import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createServiceRoleClient } from './utils/supabase.js';

type ModuleRow = {
  id: number;
  slug: string;
  title: string;
  subject: string;
  grade_band: string;
  strand: string | null;
  topic: string | null;
  subtopic: string | null;
};

type LessonRow = {
  id: number;
  slug: string;
  module_id: number;
  metadata: Record<string, unknown> | null;
};

type SubjectRow = { id: number; name: string };

const TARGET_SUBJECTS = ['Mathematics', 'English Language Arts', 'Science', 'Social Studies'];
const TARGET_GRADES = ['3', '4', '5', '6', '7', '8'];

const normalize = (value: string | null | undefined): string => (value ?? '').toLowerCase();
const toGrade = (value: string | null | undefined): number => Number.parseInt((value ?? '').trim(), 10) || 0;

const shortTopic = (module: ModuleRow): string =>
  [module.topic, module.subtopic, module.title].find((value) => value && value.trim())?.trim() ??
  module.slug.replace(/-/g, ' ');

const buildMathQuestion = (module: ModuleRow) => {
  const focus = shortTopic(module);
  const prompt = `After today's launch on ${focus}, which action best demonstrates correct reasoning?`;
  return {
    prompt,
    options: [
      {
        text: 'Set up quantities or visuals (tables, diagrams, number lines) to represent the relationships before solving.',
        isCorrect: true,
        feedback: 'Modeling the relationships with visuals/tables shows you can translate the scenario into math.',
      },
      { text: 'Guess and check numbers until one seems close.', isCorrect: false },
      { text: 'Skip labeling units or quantities to move faster.', isCorrect: false },
      { text: 'Copy a classmate’s answer and change the numbers slightly.', isCorrect: false },
    ],
  };
};

const buildElaQuestion = (module: ModuleRow) => {
  const focus = shortTopic(module);
  const prompt = `Which response best shows evidence-based thinking about today's focus on ${focus}?`;
  return {
    prompt,
    options: [
      {
        text: 'Cite a detail from the text and explain how it supports your idea.',
        isCorrect: true,
        feedback: 'Using a quoted or paraphrased detail and connecting it to your idea shows command of evidence.',
      },
      { text: 'Share a personal opinion without mentioning the text.', isCorrect: false },
      { text: 'Summarize the whole text without a clear point.', isCorrect: false },
      { text: 'Copy a sentence from the text without explaining it.', isCorrect: false },
    ],
  };
};

const buildScienceQuestion = (module: ModuleRow) => {
  const focus = shortTopic(module);
  const prompt = `When explaining the phenomenon about ${focus}, which step best uses evidence?`;
  return {
    prompt,
    options: [
      {
        text: 'Describe the pattern you observed and link it to a cause using collected evidence.',
        isCorrect: true,
        feedback: 'Naming the pattern and tying it to evidence shows scientific reasoning.',
      },
      { text: 'State a claim without mentioning observations or data.', isCorrect: false },
      { text: 'Rely only on what you guessed before the investigation.', isCorrect: false },
      { text: 'Change the claim until it fits what others said.', isCorrect: false },
    ],
  };
};

const buildSocialQuestion = (module: ModuleRow) => {
  const focus = shortTopic(module);
  const prompt = `For today's inquiry on ${focus}, which approach best builds a supported claim?`;
  return {
    prompt,
    options: [
      {
        text: 'Use a detail from a primary or secondary source and explain why it supports the claim.',
        isCorrect: true,
        feedback: 'Sourcing evidence and connecting it to the claim shows strong reasoning.',
      },
      { text: 'Share an opinion without referring to any source.', isCorrect: false },
      { text: 'Use an unrelated fact that sounds impressive.', isCorrect: false },
      { text: 'Repeat a classmate’s idea without evidence.', isCorrect: false },
    ],
  };
};

const buildQuestion = (module: ModuleRow) => {
  switch (module.subject) {
    case 'Mathematics':
      return buildMathQuestion(module);
    case 'English Language Arts':
      return buildElaQuestion(module);
    case 'Science':
      return buildScienceQuestion(module);
    case 'Social Studies':
      return buildSocialQuestion(module);
    default:
      return buildMathQuestion(module);
  }
};

const fetchSubjects = async (supabase: SupabaseClient): Promise<Map<string, SubjectRow>> => {
  const { data, error } = await supabase.from('subjects').select('id, name');
  if (error) throw new Error(`Failed to load subjects: ${error.message}`);
  const map = new Map<string, SubjectRow>();
  for (const record of (data ?? []) as SubjectRow[]) {
    const name = (record.name as string)?.trim();
    if (name) map.set(name, { id: record.id, name });
  }
  return map;
};

const fetchModules = async (supabase: SupabaseClient): Promise<Map<number, ModuleRow>> => {
  const { data, error } = await supabase
    .from('modules')
    .select('id, slug, title, subject, grade_band, strand, topic, subtopic')
    .in('subject', TARGET_SUBJECTS)
    .in('grade_band', TARGET_GRADES);
  if (error) throw new Error(`Failed to load modules: ${error.message}`);
  const map = new Map<number, ModuleRow>();
  for (const record of (data ?? []) as ModuleRow[]) {
    map.set(record.id, record);
  }
  return map;
};

const fetchLessons = async (supabase: SupabaseClient, moduleIds: number[]): Promise<LessonRow[]> => {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, slug, module_id, metadata')
    .in('module_id', moduleIds);
  if (error) throw new Error(`Failed to load lessons: ${error.message}`);
  return (data ?? []) as LessonRow[];
};

const deleteExistingExitTicket = async (
  supabase: SupabaseClient,
  moduleId: number,
  lessonSlug: string,
): Promise<void> => {
  const { data: assessments, error: assessErr } = await supabase
    .from('assessments')
    .select('id')
    .eq('module_id', moduleId)
    .contains('metadata', { purpose: 'exit_ticket', lesson_slug: lessonSlug });

  if (assessErr) throw new Error(`Failed checking existing exit tickets for ${lessonSlug}: ${assessErr.message}`);

  const assessmentIds = (assessments ?? []).map((row) => row.id as number);
  if (assessmentIds.length === 0) return;

  const { data: sections, error: sectionErr } = await supabase
    .from('assessment_sections')
    .select('id')
    .in('assessment_id', assessmentIds);
  if (sectionErr) throw new Error(`Failed loading sections for ${lessonSlug}: ${sectionErr.message}`);
  const sectionIds = (sections ?? []).map((row) => row.id as number);

  if (sectionIds.length > 0) {
    const { data: links, error: linksErr } = await supabase
      .from('assessment_questions')
      .select('question_id')
      .in('section_id', sectionIds);
    if (linksErr) throw new Error(`Failed loading question links for ${lessonSlug}: ${linksErr.message}`);
    const questionIds = Array.from(new Set((links ?? []).map((row) => row.question_id as number)));

    await supabase.from('assessment_questions').delete().in('section_id', sectionIds);
    if (questionIds.length > 0) {
      await supabase.from('question_bank').delete().in('id', questionIds);
    }
  }

  if (sectionIds.length > 0) {
    await supabase.from('assessment_sections').delete().in('id', sectionIds);
  }
  await supabase.from('assessments').delete().in('id', assessmentIds);
};

const insertQuestion = async (
  supabase: SupabaseClient,
  subjectId: number,
  module: ModuleRow,
  lesson: LessonRow,
  question: { prompt: string; options: Array<{ text: string; isCorrect: boolean; feedback?: string }> },
): Promise<number> => {
  const { data, error } = await supabase
    .from('question_bank')
    .insert({
      subject_id: subjectId,
      question_type: 'multiple_choice',
      prompt: question.prompt,
      solution_explanation: null,
      difficulty: 2,
      tags: [module.subject, 'exit_ticket'],
      metadata: {
        purpose: 'exit_ticket',
        module_slug: module.slug,
        lesson_slug: lesson.slug,
        seeded_by: 'seed_lesson_exit_tickets',
      },
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert exit ticket question for ${lesson.slug}: ${error?.message ?? 'unknown'}`);
  }

  const questionId = data.id as number;
  const { error: optionsError } = await supabase.from('question_options').insert(
    question.options.map((option, index) => ({
      question_id: questionId,
      option_order: index + 1,
      content: option.text,
      is_correct: option.isCorrect,
      feedback: option.feedback ?? null,
    })),
  );

  if (optionsError) {
    await supabase.from('question_bank').delete().eq('id', questionId);
    const message = optionsError.message ?? JSON.stringify(optionsError);
    throw new Error(`Failed to insert options for ${lesson.slug}: ${message}`);
  }

  return questionId;
};

const insertAssessment = async (
  supabase: SupabaseClient,
  subjectId: number,
  module: ModuleRow,
  lesson: LessonRow,
  questionId: number,
): Promise<void> => {
  const grade = toGrade(module.grade_band);
  const { data: assessmentRow, error: assessErr } = await supabase
    .from('assessments')
    .insert({
      title: `${lesson.slug} · Exit Ticket`,
      description: `Quick exit check for ${module.title}`,
      subject_id: subjectId,
      module_id: module.id,
      is_adaptive: false,
      estimated_duration_minutes: 3,
      metadata: {
        purpose: 'exit_ticket',
        module_slug: module.slug,
        lesson_slug: lesson.slug,
        grade_band: module.grade_band,
        grade,
      },
    })
    .select('id')
    .single();

  if (assessErr || !assessmentRow) {
    throw new Error(`Failed to create exit ticket for ${lesson.slug}: ${assessErr?.message ?? 'unknown'}`);
  }

  const assessmentId = assessmentRow.id as number;
  const { data: sectionRow, error: sectionErr } = await supabase
    .from('assessment_sections')
    .insert({
      assessment_id: assessmentId,
      section_order: 1,
      title: 'Exit Ticket',
      instructions: 'Answer to show what you took away from today.',
    })
    .select('id')
    .single();

  if (sectionErr || !sectionRow) {
    throw new Error(`Failed to create exit ticket section for ${lesson.slug}: ${sectionErr?.message ?? 'unknown'}`);
  }

  const sectionId = sectionRow.id as number;
  const { error: linkErr } = await supabase.from('assessment_questions').insert({
    section_id: sectionId,
    question_id: questionId,
    question_order: 1,
    weight: 1,
    metadata: {
      module_slug: module.slug,
      lesson_slug: lesson.slug,
    },
  });

  if (linkErr) {
    throw new Error(`Failed to link question for ${lesson.slug}: ${linkErr.message}`);
  }
};

const seedExitTickets = async () => {
  const supabase = createServiceRoleClient();
  const subjectMap = await fetchSubjects(supabase);
  const modules = await fetchModules(supabase);
  const lessons = await fetchLessons(
    supabase,
    Array.from(modules.keys()),
  );

  let seeded = 0;

  for (const lesson of lessons) {
    const module = modules.get(lesson.module_id);
    if (!module) continue;
    const subject = subjectMap.get(module.subject);
    if (!subject) {
      throw new Error(`Subject "${module.subject}" not found for module ${module.slug}`);
    }

    await deleteExistingExitTicket(supabase, module.id, lesson.slug);
    const question = buildQuestion(module);
    const questionId = await insertQuestion(supabase, subject.id, module, lesson, question);
    await insertAssessment(supabase, subject.id, module, lesson, questionId);
    seeded += 1;
  }

  console.log(`Seeded ${seeded} lesson exit tickets.`);
};

const invokedFromCli =
  process.argv[1]?.includes('seed_lesson_exit_tickets.ts') ||
  process.argv[1]?.includes('seed_lesson_exit_tickets.js');

if (invokedFromCli) {
  seedExitTickets().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
