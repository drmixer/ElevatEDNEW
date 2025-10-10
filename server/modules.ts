import type { SupabaseClient } from '@supabase/supabase-js';

export type ModuleListItem = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  grade_band: string;
  subject: string;
  strand: string | null;
  topic: string | null;
  open_track: boolean;
  suggested_source_category: string | null;
  example_source: string | null;
};

export type ModuleDetail = {
  module: ModuleListItem & {
    description: string | null;
    notes: string | null;
    license_requirement: string | null;
  };
  lessons: Array<{
    id: number;
    title: string;
    content: string;
    estimated_duration_minutes: number | null;
    attribution_block: string;
    open_track: boolean;
    assets: AssetSummary[];
  }>;
  moduleAssets: AssetSummary[];
  standards: ModuleStandard[];
  assessments: ModuleAssessmentSummary[];
};

export type AssetSummary = {
  id: number;
  lesson_id: number | null;
  title: string | null;
  description: string | null;
  url: string;
  kind: string;
  license: string;
  license_url: string | null;
  attribution_text: string | null;
  tags: string[];
};

export type ModuleStandard = {
  id: number;
  framework: string;
  code: string;
  description: string | null;
  alignment_strength: string | null;
  notes: string | null;
};

export type ModuleAssessmentSummary = {
  id: number;
  title: string;
  description: string | null;
  estimated_duration_minutes: number | null;
  question_count: number;
  attempt_count: number;
  completion_rate: number;
  average_score: number | null;
  purpose: string | null;
};

export type ModuleAssessmentOption = {
  id: number;
  order: number;
  content: string;
  is_correct: boolean;
  feedback: string | null;
};

export type ModuleAssessmentQuestion = {
  id: number;
  prompt: string;
  type: string;
  difficulty: number | null;
  explanation: string | null;
  standards: string[];
  tags: string[];
  options: ModuleAssessmentOption[];
};

export type ModuleAssessmentSection = {
  id: number;
  title: string;
  instructions: string | null;
  questions: ModuleAssessmentQuestion[];
};

export type ModuleAssessmentDetail = {
  id: number;
  title: string;
  description: string | null;
  estimated_duration_minutes: number | null;
  purpose: string | null;
  sections: ModuleAssessmentSection[];
};

export type ModuleFilters = {
  subject?: string;
  grade?: string;
  strand?: string;
  topic?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export const listModules = async (
  supabase: SupabaseClient,
  filters: ModuleFilters,
): Promise<{ data: ModuleListItem[]; total: number }> => {
  const {
    subject,
    grade,
    strand,
    topic,
    search,
    page = 1,
    pageSize = 12,
  } = filters;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('modules')
    .select('id, slug, title, summary, grade_band, subject, strand, topic, open_track, suggested_source_category, example_source', { count: 'exact' })
    .eq('visibility', 'public');

  if (subject) {
    query = query.eq('subject', subject);
  }
  if (grade) {
    query = query.eq('grade_band', grade);
  }
  if (strand) {
    query = query.ilike('strand', `%${strand}%`);
  }
  if (topic) {
    query = query.ilike('topic', `%${topic}%`);
  }
  if (search) {
    query = query.or(
      [
        `title.ilike.%${search}%`,
        `summary.ilike.%${search}%`,
        `topic.ilike.%${search}%`,
        `strand.ilike.%${search}%`,
      ].join(','),
    );
  }

  const { data, error, count } = await query
    .order('grade_band', { ascending: true })
    .order('title', { ascending: true })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to list modules: ${error.message}`);
  }

  return {
    data: (data ?? []) as ModuleListItem[],
    total: count ?? 0,
  };
};

export const getModuleDetail = async (
  supabase: SupabaseClient,
  moduleId: number,
): Promise<ModuleDetail | null> => {
  const { data: moduleData, error: moduleError } = await supabase
    .from('modules')
    .select('id, slug, title, summary, description, notes, grade_band, subject, strand, topic, open_track, suggested_source_category, example_source, license_requirement')
    .eq('id', moduleId)
    .eq('visibility', 'public')
    .single();

  if (moduleError) {
    if (moduleError.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to load module ${moduleId}: ${moduleError.message}`);
  }

  if (!moduleData) {
    return null;
  }

  const [lessonsResult, assetsResult, moduleStandardsResult, assessmentsResult] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, title, content, estimated_duration_minutes, attribution_block, open_track')
      .eq('module_id', moduleId)
      .eq('visibility', 'public')
      .order('id', { ascending: true }),
    supabase
      .from('assets')
      .select('id, lesson_id, title, description, url, kind, license, license_url, attribution_text, tags')
      .eq('module_id', moduleId),
    supabase
      .from('module_standards')
      .select('standard_id, alignment_strength, metadata')
      .eq('module_id', moduleId),
    supabase
      .from('assessments')
      .select('id, title, description, estimated_duration_minutes, metadata')
      .eq('module_id', moduleId),
  ]);

  if (lessonsResult.error) {
    throw new Error(`Failed to load lessons: ${lessonsResult.error.message}`);
  }
  if (assetsResult.error) {
    throw new Error(`Failed to load assets: ${assetsResult.error.message}`);
  }
  if (moduleStandardsResult.error) {
    throw new Error(`Failed to load module standards: ${moduleStandardsResult.error.message}`);
  }
  if (assessmentsResult.error) {
    throw new Error(`Failed to load module assessments: ${assessmentsResult.error.message}`);
  }

  const lessonsRaw = (lessonsResult.data ?? []) as LessonRow[];
  const lessons = lessonsRaw.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    content: lesson.content,
    estimated_duration_minutes: lesson.estimated_duration_minutes ?? null,
    attribution_block: lesson.attribution_block ?? '',
    open_track: lesson.open_track ?? false,
    assets: [] as AssetSummary[],
  }));

  const lessonIndex = new Map<number, number>();
  lessons.forEach((lesson, index) => lessonIndex.set(lesson.id, index));

  const moduleAssets: AssetSummary[] = [];

  for (const asset of assetsResult.data ?? []) {
    const summary = asset as AssetSummary;
    if (summary.lesson_id && lessonIndex.has(summary.lesson_id)) {
      lessons[lessonIndex.get(summary.lesson_id)!].assets.push(summary);
    } else {
      moduleAssets.push(summary);
    }
  }

  const moduleStandardsRaw = (moduleStandardsResult.data ?? []) as ModuleStandardRow[];
  let standards: ModuleStandard[] = [];

  if (moduleStandardsRaw.length > 0) {
    const uniqueStandardIds = Array.from(new Set(moduleStandardsRaw.map((entry) => entry.standard_id)));
    if (uniqueStandardIds.length > 0) {
      const { data: standardRows, error: standardsError } = await supabase
        .from('standards')
        .select('id, framework, code, description')
        .in('id', uniqueStandardIds);

      if (standardsError) {
        throw new Error(`Failed to load standards for module ${moduleId}: ${standardsError.message}`);
      }

      const lookup = new Map<number, { framework: string; code: string; description: string | null }>();
      for (const standard of standardRows ?? []) {
        lookup.set(standard.id as number, {
          framework: standard.framework as string,
          code: standard.code as string,
          description: (standard.description as string | null) ?? null,
        });
      }

      standards = moduleStandardsRaw
        .map((entry) => {
          const standard = lookup.get(entry.standard_id);
          if (!standard) {
            return null;
          }
          const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
          const notes = typeof metadata.notes === 'string' ? metadata.notes : null;
          return {
            id: entry.standard_id,
            framework: standard.framework,
            code: standard.code,
            description: standard.description,
            alignment_strength: entry.alignment_strength ?? null,
            notes,
          } satisfies ModuleStandard;
        })
        .filter((value): value is ModuleStandard => value !== null);
    }
  }

  const assessmentsRaw = (assessmentsResult.data ?? []) as AssessmentRow[];
  let assessments: ModuleAssessmentSummary[] = [];

  if (assessmentsRaw.length > 0) {
    const assessmentIds = Array.from(new Set(assessmentsRaw.map((entry) => entry.id)));

    const { data: sectionsData, error: sectionsError } = await supabase
      .from('assessment_sections')
      .select('id, assessment_id')
      .in('assessment_id', assessmentIds);

    if (sectionsError) {
      throw new Error(`Failed to load assessment sections: ${sectionsError.message}`);
    }

    const sections = (sectionsData ?? []) as AssessmentSectionRow[];
    const sectionIds = sections.map((section) => section.id);

    let questions: AssessmentQuestionRow[] = [];
    if (sectionIds.length > 0) {
      const { data: questionsData, error: questionsError } = await supabase
        .from('assessment_questions')
        .select('id, section_id')
        .in('section_id', sectionIds);

      if (questionsError) {
        throw new Error(`Failed to load assessment questions: ${questionsError.message}`);
      }
      questions = (questionsData ?? []) as AssessmentQuestionRow[];
    }

    const { data: attemptsData, error: attemptsError } = await supabase
      .from('student_assessment_attempts')
      .select('assessment_id, status, total_score, mastery_pct')
      .in('assessment_id', assessmentIds);

    if (attemptsError) {
      throw new Error(`Failed to load assessment attempts: ${attemptsError.message}`);
    }

    const sectionToAssessment = new Map<number, number>();
    sections.forEach((section) => sectionToAssessment.set(section.id, section.assessment_id));

    const questionCountByAssessment = new Map<number, number>();
    questions.forEach((question) => {
      const assessmentId = sectionToAssessment.get(question.section_id);
      if (!assessmentId) return;
      questionCountByAssessment.set(assessmentId, (questionCountByAssessment.get(assessmentId) ?? 0) + 1);
    });

    const attemptStats = new Map<
      number,
      { attempts: number; completed: number; scoreTotal: number; scoreCount: number }
    >();
    for (const attempt of (attemptsData ?? []) as AssessmentAttemptRow[]) {
      const assessmentId = attempt.assessment_id;
      const stats =
        attemptStats.get(assessmentId) ??
        { attempts: 0, completed: 0, scoreTotal: 0, scoreCount: 0 };
      stats.attempts += 1;
      if (attempt.status === 'completed') {
        stats.completed += 1;
      }
      const scoreValue =
        attempt.mastery_pct != null
          ? Number(attempt.mastery_pct)
          : attempt.total_score != null
            ? Number(attempt.total_score)
            : null;
      if (scoreValue != null && Number.isFinite(scoreValue)) {
        stats.scoreTotal += scoreValue;
        stats.scoreCount += 1;
      }
      attemptStats.set(assessmentId, stats);
    }

    assessments = assessmentsRaw.map((assessment) => {
      const stats = attemptStats.get(assessment.id) ?? {
        attempts: 0,
        completed: 0,
        scoreTotal: 0,
        scoreCount: 0,
      };
      const purpose = extractPurpose(assessment.metadata);
      const completionRate = stats.attempts > 0 ? stats.completed / stats.attempts : 0;
      const average =
        stats.scoreCount > 0 ? Math.round((stats.scoreTotal / stats.scoreCount) * 10) / 10 : null;

      return {
        id: assessment.id,
        title: assessment.title,
        description: assessment.description ?? null,
        estimated_duration_minutes: assessment.estimated_duration_minutes ?? null,
        question_count: questionCountByAssessment.get(assessment.id) ?? 0,
        attempt_count: stats.attempts,
        completion_rate: completionRate,
        average_score: average,
        purpose,
      } satisfies ModuleAssessmentSummary;
    });
  }

  return {
    module: moduleData as ModuleDetail['module'],
    lessons,
    moduleAssets,
    standards,
    assessments,
  };
};

export const getModuleAssessment = async (
  supabase: SupabaseClient,
  moduleId: number,
): Promise<ModuleAssessmentDetail | null> => {
  const { data: assessmentRow, error: assessmentError } = await supabase
    .from('assessments')
    .select('id, title, description, estimated_duration_minutes, metadata')
    .eq('module_id', moduleId)
    .contains('metadata', { purpose: 'baseline' })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assessmentError && assessmentError.code !== 'PGRST116') {
    throw new Error(`Failed to load baseline assessment for module ${moduleId}: ${assessmentError.message}`);
  }

  if (!assessmentRow) {
    return null;
  }

  const { data: sectionsData, error: sectionsError } = await supabase
    .from('assessment_sections')
    .select('id, title, instructions, section_order')
    .eq('assessment_id', assessmentRow.id)
    .order('section_order', { ascending: true });

  if (sectionsError) {
    throw new Error(`Failed to load assessment sections: ${sectionsError.message}`);
  }

  const sections = (sectionsData ?? []) as AssessmentSectionDetail[];
  const sectionIds = sections.map((section) => section.id);

  if (sectionIds.length === 0) {
    return {
      id: assessmentRow.id,
      title: assessmentRow.title,
      description: assessmentRow.description ?? null,
      estimated_duration_minutes: assessmentRow.estimated_duration_minutes ?? null,
      purpose: extractPurpose(assessmentRow.metadata),
      sections: [],
    };
  }

  const { data: questionLinksData, error: questionLinksError } = await supabase
    .from('assessment_questions')
    .select('id, section_id, question_id, question_order, metadata')
    .in('section_id', sectionIds)
    .order('question_order', { ascending: true });

  if (questionLinksError) {
    throw new Error(`Failed to load assessment question ordering: ${questionLinksError.message}`);
  }

  const questionLinks = (questionLinksData ?? []) as AssessmentQuestionLinkRow[];
  const questionIds = Array.from(new Set(questionLinks.map((link) => link.question_id)));

  const questionLookup = new Map<number, QuestionBankRow>();
  const optionsLookup = new Map<number, ModuleAssessmentOption[]>();
  if (questionIds.length > 0) {
    const { data: questionBankData, error: questionBankError } = await supabase
      .from('question_bank')
      .select('id, prompt, question_type, difficulty, solution_explanation, metadata, tags')
      .in('id', questionIds);

    if (questionBankError) {
      throw new Error(`Failed to load question bank entries: ${questionBankError.message}`);
    }

    for (const question of questionBankData ?? []) {
      questionLookup.set(question.id as number, question as QuestionBankRow);
    }

    const { data: optionsData, error: optionsError } = await supabase
      .from('question_options')
      .select('id, question_id, option_order, content, is_correct, feedback')
      .in('question_id', questionIds)
      .order('option_order', { ascending: true });

    if (optionsError) {
      throw new Error(`Failed to load question options: ${optionsError.message}`);
    }

    for (const option of optionsData ?? []) {
      const optionRow = option as QuestionOptionRow;
      const optionList = optionsLookup.get(optionRow.question_id) ?? [];
      optionList.push({
        id: optionRow.id,
        order: optionRow.option_order,
        content: optionRow.content,
        is_correct: optionRow.is_correct,
        feedback: optionRow.feedback ?? null,
      });
      optionsLookup.set(optionRow.question_id, optionList);
    }
  }

  const questionOrderLookup = new Map<string, number>();
  for (const link of questionLinks) {
    questionOrderLookup.set(`${link.section_id}:${link.question_id}`, link.question_order);
  }

  const sectionToQuestions = new Map<number, ModuleAssessmentQuestion[]>();

  for (const link of questionLinks) {
    const question = questionLookup.get(link.question_id);
    if (!question) continue;
    const metadata = (question.metadata ?? {}) as Record<string, unknown>;
    const standardsValue = metadata.standards;
    const standards =
      Array.isArray(standardsValue) ?
        standardsValue.map((item) => String(item)) :
        typeof standardsValue === 'string' ?
          [standardsValue] :
          [];
    const tags = Array.isArray(question.tags) ? (question.tags as string[]) : [];

    const questionDetail: ModuleAssessmentQuestion = {
      id: question.id,
      prompt: question.prompt,
      type: question.question_type,
      difficulty: question.difficulty ?? null,
      explanation: question.solution_explanation ?? null,
      standards,
      tags,
      options: (optionsLookup.get(question.id) ?? []).sort((a, b) => a.order - b.order),
    };

    const list = sectionToQuestions.get(link.section_id) ?? [];
    list.push(questionDetail);
    sectionToQuestions.set(link.section_id, list);
  }

  const detailedSections: ModuleAssessmentSection[] = sections.map((section) => ({
    id: section.id,
    title: section.title,
    instructions: section.instructions ?? null,
    questions: (sectionToQuestions.get(section.id) ?? []).sort((a, b) => {
      const orderA = questionOrderLookup.get(`${section.id}:${a.id}`) ?? 0;
      const orderB = questionOrderLookup.get(`${section.id}:${b.id}`) ?? 0;
      return orderA - orderB;
    }),
  }));

  const sectionOrderLookup = new Map<number, number>();
  sections.forEach((section) => {
    sectionOrderLookup.set(section.id, section.section_order ?? 0);
  });

  detailedSections.sort(
    (a, b) => (sectionOrderLookup.get(a.id) ?? 0) - (sectionOrderLookup.get(b.id) ?? 0),
  );

  return {
    id: assessmentRow.id,
    title: assessmentRow.title,
    description: assessmentRow.description ?? null,
    estimated_duration_minutes: assessmentRow.estimated_duration_minutes ?? null,
    purpose: extractPurpose(assessmentRow.metadata),
    sections: detailedSections,
  };
};

const extractPurpose = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  const purpose = record.purpose;
  if (typeof purpose === 'string' && purpose.trim().length > 0) {
    return purpose.trim();
  }
  const kind = record.kind;
  if (typeof kind === 'string' && kind.trim().length > 0) {
    return kind.trim();
  }
  return null;
};

type LessonRow = {
  id: number;
  title: string;
  content: string;
  estimated_duration_minutes: number | null;
  attribution_block: string | null;
  open_track: boolean | null;
};

type ModuleStandardRow = {
  standard_id: number;
  alignment_strength: string | null;
  metadata: Record<string, unknown> | null;
};

type AssessmentRow = {
  id: number;
  title: string;
  description: string | null;
  estimated_duration_minutes: number | null;
  metadata: Record<string, unknown> | null;
};

type AssessmentSectionRow = {
  id: number;
  assessment_id: number;
};

type AssessmentQuestionRow = {
  id: number;
  section_id: number;
};

type AssessmentAttemptRow = {
  assessment_id: number;
  status: string;
  total_score: number | null;
  mastery_pct: number | null;
};

type AssessmentSectionDetail = {
  id: number;
  title: string;
  instructions: string | null;
  section_order: number | null;
};

type AssessmentQuestionLinkRow = {
  id: number;
  section_id: number;
  question_id: number;
  question_order: number;
  metadata: Record<string, unknown> | null;
};

type QuestionBankRow = {
  id: number;
  prompt: string;
  question_type: string;
  difficulty: number | null;
  solution_explanation: string | null;
  metadata: Record<string, unknown> | null;
  tags: string[] | null;
};

type QuestionOptionRow = {
  id: number;
  question_id: number;
  option_order: number;
  content: string;
  is_correct: boolean;
  feedback: string | null;
};
