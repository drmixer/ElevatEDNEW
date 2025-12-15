import type { SupabaseClient } from '@supabase/supabase-js';

import type { StudentPreferences } from './personalization.js';
import { getStudentPreferences, updateStudentPreferences } from './personalization.js';
import { getRuntimeConfig } from './config.js';
import { recordOpsEvent } from './opsMetrics.js';
import { captureServerException, raiseAlert } from './monitoring.js';
import { HttpError } from './httpError.js';
import { selectPlacementAssessmentId } from './placementSelection.js';
import { validatePlacementQuestions } from './placementValidation.js';

type PathBuildOptions = {
  gradeBand?: string | null;
  goalFocus?: string | null;
  source?: string;
  limit?: number;
  metadata?: Record<string, unknown>;
};

type PlacementQuestion = {
  id: string;
  bankQuestionId: number;
  prompt: string;
  type: string;
  options: Array<{ id: number; text: string; isCorrect: boolean; feedback?: string | null }>;
  weight: number;
  difficulty: number;
  strand: string | null;
  targetStandards: string[];
  metadata?: Record<string, unknown> | null;
};

type PlacementStartResult = {
  assessmentId: number;
  attemptId: number;
  attemptNumber: number;
  gradeBand: string;
  resumeToken: string;
  items: PlacementQuestion[];
  existingResponses: Array<{ questionId: number; selectedOptionId: number | null; isCorrect: boolean | null }>;
};

type PlacementResponseInput = {
  bankQuestionId: number;
  optionId: number | null;
  timeSpentSeconds?: number | null;
};

type StrandEstimate = { strand: string; correct: number; total: number; accuracyPct: number };

export type PathEntry = {
  id: number;
  path_id: number;
  position: number;
  type: string;
  module_id: number | null;
  lesson_id: number | null;
  assessment_id: number | null;
  status: string;
  score: number | null;
  time_spent_s: number | null;
  target_standard_codes: string[];
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type PathSummary = {
  id: number;
  status: string;
  started_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
};

type QuestionBankRow = {
  id: number;
  prompt: string;
  question_type: string;
  difficulty: number | null;
  solution_explanation?: string | null;
  metadata?: Record<string, unknown> | null;
  tags?: string[] | null;
};

type AdaptiveAttempt = {
  standards: string[];
  correct: boolean;
  difficulty: number | null;
  source: string;
  createdAt: string;
  accuracy: number | null;
};

let TARGET_ACCURACY_BAND = { min: 0.65, max: 0.8 };
const MAX_ADAPTIVE_ATTEMPTS = 24;
const MAX_STANDARDS_TRACKED = 4;
let MAX_REMEDIATION_INSERTS = 2;
let MAX_PENDING_PRACTICE = 3;
const syncAdaptiveConfig = async (supabase: SupabaseClient | null) => {
  try {
    const config = await getRuntimeConfig(supabase ?? null);
    TARGET_ACCURACY_BAND = {
      min: config.adaptive.targetAccuracyMin,
      max: config.adaptive.targetAccuracyMax,
    };
    MAX_REMEDIATION_INSERTS = config.adaptive.maxRemediationPending;
    MAX_PENDING_PRACTICE = config.adaptive.maxPracticePending;
    return config;
  } catch (error) {
    console.warn('[adaptive] falling back to default config', error);
    captureServerException(error, { stage: 'adaptive_config_sync' });
    return null;
  }
};

const deriveGradeBand = (gradeLevel?: number | null, gradeBand?: string | null): string => {
  if (gradeBand && gradeBand.trim().length > 0) return gradeBand;
  if (!gradeLevel) return '6-8';
  if (gradeLevel <= 2) return 'K-2';
  if (gradeLevel <= 5) return '3-5';
  if (gradeLevel <= 8) return '6-8';
  return '9-12';
};

const gradeBandToLevel = (gradeBand?: string | null): number | null => {
  if (!gradeBand) return null;
  const normalized = gradeBand.trim().toUpperCase();
  if (normalized === 'K-2') return 2;
  if (normalized === '3-5') return 4;
  if (normalized === '6-8') return 7;
  if (normalized === '9-12') return 10;
  const numeric = Number.parseInt(normalized, 10);
  return Number.isFinite(numeric) ? numeric : null;
};

const splitName = (fullName?: string | null): { first: string; last: string | null } => {
  if (!fullName) return { first: 'Student', last: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0] ?? 'Student', last: null };
  }
  return { first: parts[0] ?? 'Student', last: parts.slice(1).join(' ') || null };
};

const loadStudentProfile = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<{ grade_level: number | null; grade_band: string | null; preferences: StudentPreferences }> => {
  const [profile, preferences] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('grade_level, grade_band')
      .eq('id', studentId)
      .maybeSingle(),
    getStudentPreferences(supabase, studentId),
  ]);

  if (profile.error) {
    throw new Error(`Unable to load student profile: ${profile.error.message}`);
  }

  return {
    grade_level: (profile.data?.grade_level as number | null | undefined) ?? null,
    grade_band: (profile.data?.grade_band as string | null | undefined) ?? null,
    preferences,
  };
};

export const ensureStudentProfileProvisioned = async (
  supabase: SupabaseClient,
  serviceSupabase: SupabaseClient | null,
  studentId: string,
  options?: { gradeBand?: string | null; fullName?: string | null; optInAi?: boolean; avatarId?: string | null; tutorPersonaId?: string | null },
): Promise<void> => {
  const writer = serviceSupabase ?? supabase;

  const [{ data: profileRow, error: profileError }, { data: studentRow, error: studentError }] = await Promise.all([
    writer.from('profiles').select('full_name').eq('id', studentId).maybeSingle(),
    writer.from('student_profiles').select('id').eq('id', studentId).maybeSingle(),
  ]);

  if (profileError) {
    throw new Error(`Unable to load profile: ${profileError.message}`);
  }
  if (studentError) {
    throw new Error(`Unable to verify student profile: ${studentError.message}`);
  }

  const fullName = options?.fullName ?? ((profileRow?.full_name as string | null | undefined) ?? null);
  const { first, last } = splitName(fullName);
  const gradeLevel = gradeBandToLevel(options?.gradeBand ?? null);

  if (!studentRow) {
    // Ensure a parent profile exists to satisfy the FK; for now, fall back to self-parenting if none exists.
    const parentId = studentId;
    const { data: parentRow, error: parentError } = await writer
      .from('parent_profiles')
      .select('id')
      .eq('id', parentId)
      .maybeSingle();
    if (parentError) {
      throw new Error(`Unable to verify parent profile: ${parentError.message}`);
    }
    if (!parentRow) {
      const { error: parentInsertError } = await writer
        .from('parent_profiles')
        .insert({ id: parentId, full_name: fullName ?? first });
      if (parentInsertError) {
        throw new Error(`Unable to provision parent profile placeholder: ${parentInsertError.message}`);
      }
    }

    const insertPayload: Record<string, unknown> = {
      id: studentId,
      parent_id: parentId,
      first_name: first,
      last_name: last,
      grade_level: gradeLevel,
    };
    if (options?.gradeBand) {
      insertPayload.grade_band = options.gradeBand;
    }

    const { error: insertError } = await writer.from('student_profiles').insert(insertPayload);
    if (insertError) {
      throw new Error(`Unable to provision student profile: ${insertError.message}`);
    }
  } else {
    const updates: Record<string, unknown> = {};
    if (options?.gradeBand) {
      updates.grade_band = options.gradeBand;
      const derivedLevel = gradeBandToLevel(options.gradeBand);
      if (derivedLevel) {
        updates.grade_level = derivedLevel;
      }
    }
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await writer.from('student_profiles').update(updates).eq('id', studentId);
      if (updateError) {
        throw new Error(`Unable to update student profile: ${updateError.message}`);
      }
    }
  }

  if (fullName) {
    const { error: nameUpdateError } = await writer
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', studentId);
    if (nameUpdateError) {
      console.warn('[placement] Unable to persist full name', nameUpdateError);
    }
  }

  // Ensure preferences exist and reflect the latest onboarding selections.
  const preferenceUpdates: Record<string, unknown> = {};
  if (options?.avatarId) preferenceUpdates.avatar_id = options.avatarId;
  if (options?.tutorPersonaId) preferenceUpdates.tutor_persona_id = options.tutorPersonaId;
  if (typeof options?.optInAi === 'boolean') preferenceUpdates.opt_in_ai = options.optInAi;

  if (Object.keys(preferenceUpdates).length > 0) {
    try {
      await updateStudentPreferences(supabase, studentId, preferenceUpdates);
    } catch (prefError) {
      console.warn('[placement] Unable to update student preferences', prefError);
    }
  } else {
    await getStudentPreferences(supabase, studentId);
  }
};

const findPlacementAssessmentId = async (
  supabase: SupabaseClient,
  targetGradeBand: string,
  goalFocus?: string | null,
): Promise<number | null> => {
  const { data, error } = await supabase
    .from('assessments')
    .select('id, module_id, metadata, created_at')
    .is('module_id', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Unable to read assessments: ${error.message}`);
  }

  const id = selectPlacementAssessmentId((data ?? []) as Array<{ id: number; module_id: number | null; created_at?: string | null; metadata: Record<string, unknown> | null }>, {
    targetGradeBand,
    goalFocus,
  });
  return id;
};

const loadPlacementQuestions = async (
  supabase: SupabaseClient,
  assessmentId: number,
): Promise<{ questions: PlacementQuestion[]; validation: { invalidReasons: Array<{ bankQuestionId: number; reason: string }>; filteredOutCount: number } }> => {
  const { data: sectionRows, error: sectionError } = await supabase
    .from('assessment_sections')
    .select('id, section_order')
    .eq('assessment_id', assessmentId)
    .order('section_order', { ascending: true });

  if (sectionError) {
    throw new Error(`Unable to load assessment sections: ${sectionError.message}`);
  }

  const sectionOrderById = new Map<number, number>();
  (sectionRows ?? []).forEach((row) => {
    sectionOrderById.set(row.id as number, (row.section_order as number | null | undefined) ?? 0);
  });

  const sectionIds = (sectionRows ?? []).map((section) => section.id as number);
  if (!sectionIds.length) {
    throw new HttpError(409, 'Placement assessment is missing sections.', 'placement_content_missing');
  }

  const { data: links, error: linkError } = await supabase
    .from('assessment_questions')
    .select('question_id, section_id, question_order, weight, metadata')
    .in('section_id', sectionIds)
    .order('question_order', { ascending: true });

  if (linkError) {
    throw new Error(`Unable to load assessment questions: ${linkError.message}`);
  }

  const questionLinks = (links ?? []) as Array<{
    question_id: number;
    section_id: number;
    question_order: number;
    weight: number | null;
    metadata: Record<string, unknown> | null;
  }>;

  const questionIds = Array.from(new Set(questionLinks.map((link) => link.question_id)));
  if (!questionIds.length) {
    throw new HttpError(409, 'Placement assessment has no questions configured.', 'placement_content_missing');
  }

  const [questionBankResult, optionsResult, skillsResult] = await Promise.all([
    supabase
      .from('question_bank')
      .select('id, prompt, question_type, difficulty, solution_explanation, metadata, tags')
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
    console.warn('[placement] Unable to load question skill mappings', skillsResult.error);
  }

  const bankLookup = new Map<number, QuestionBankRow>();
  (questionBankResult.data ?? []).forEach((row) => {
    bankLookup.set(row.id as number, row as QuestionBankRow);
  });

  const optionLookup = new Map<number, PlacementQuestion['options']>();
  (optionsResult.data ?? []).forEach((row) => {
    const optionRow = row as { id: number; question_id: number; content: string; is_correct: boolean; feedback?: string | null };
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
    const skillRow = row as { question_id: number; skill_id: number; skills?: { name?: string | null } | null };
    const list = skillLookup.get(skillRow.question_id) ?? [];
    list.push({ id: skillRow.skill_id, name: skillRow.skills?.name ?? null });
    skillLookup.set(skillRow.question_id, list);
  });

  const questions = questionLinks
    .map((link, index) => {
      const bankQuestion = bankLookup.get(link.question_id);
      if (!bankQuestion) return null;
      const metadata = (bankQuestion.metadata ?? {}) as Record<string, unknown>;
      const tags = Array.isArray(bankQuestion.tags) ? (bankQuestion.tags as string[]) : [];
      const strand =
        (metadata.strand as string | undefined) ??
        (link.metadata?.strand as string | undefined) ??
        (tags.length ? tags[0] : null);
      const standards = Array.isArray(metadata.standards)
        ? (metadata.standards as string[])
        : Array.isArray(link.metadata?.standards)
          ? ((link.metadata?.standards as string[]) ?? [])
          : [];
      return {
        id: `q-${link.question_id}-${index + 1}`,
        bankQuestionId: link.question_id,
        prompt: bankQuestion.prompt,
        type: bankQuestion.question_type as PlacementQuestion['type'],
        options: optionLookup.get(link.question_id) ?? [],
        weight: link.weight ?? 1,
        difficulty: bankQuestion.difficulty ?? 3,
        strand: strand ?? null,
        targetStandards: standards,
        metadata: metadata,
      } satisfies PlacementQuestion;
    })
    .filter((question): question is PlacementQuestion => Boolean(question))
    .sort((a, b) => {
      const aLink = questionLinks.find((link) => link.question_id === a.bankQuestionId);
      const bLink = questionLinks.find((link) => link.question_id === b.bankQuestionId);
      const aSectionOrder = aLink ? (sectionOrderById.get(aLink.section_id) ?? 0) : 0;
      const bSectionOrder = bLink ? (sectionOrderById.get(bLink.section_id) ?? 0) : 0;
      if (aSectionOrder !== bSectionOrder) return aSectionOrder - bSectionOrder;
      return (aLink?.question_order ?? 0) - (bLink?.question_order ?? 0);
    });

  const validation = validatePlacementQuestions(questions, { assessmentId });
  return {
    questions: validation.questions as PlacementQuestion[],
    validation: { invalidReasons: validation.invalidReasons, filteredOutCount: validation.filteredOutCount },
  };
};

export const startPlacementAssessment = async (
  supabase: SupabaseClient,
  studentId: string,
  options?: {
    gradeBand?: string | null;
    fullName?: string | null;
    optInAi?: boolean;
    avatarId?: string | null;
    tutorPersonaId?: string | null;
    serviceSupabase?: SupabaseClient | null;
  },
): Promise<PlacementStartResult> => {
  await ensureStudentProfileProvisioned(supabase, options?.serviceSupabase ?? null, studentId, {
    gradeBand: options?.gradeBand,
    fullName: options?.fullName,
    optInAi: options?.optInAi,
    avatarId: options?.avatarId ?? null,
    tutorPersonaId: options?.tutorPersonaId ?? null,
  });

  const profile = await loadStudentProfile(supabase, studentId);
  const resolvedGradeBand = deriveGradeBand(profile.grade_level, options?.gradeBand ?? profile.grade_band);

  const contentClient = options?.serviceSupabase ?? supabase;
  const assessmentId = await findPlacementAssessmentId(
    contentClient,
    resolvedGradeBand,
    profile.preferences.goal_focus ?? null,
  );
  if (!assessmentId) {
    throw new HttpError(
      404,
      'No placement assessment is available for your grade band yet.',
      'placement_assessment_missing',
      { gradeBand: resolvedGradeBand },
    );
  }

  const { data: assessmentSnapshot, error: assessmentSnapshotError } = await contentClient
    .from('assessments')
    .select('id, module_id, metadata')
    .eq('id', assessmentId)
    .maybeSingle();

  if (assessmentSnapshotError) {
    console.warn('[placement] Unable to load assessment metadata snapshot', assessmentSnapshotError);
  }

  const { data: lastAttempt, error: lastAttemptError } = await supabase
    .from('student_assessment_attempts')
    .select('id, attempt_number, status')
    .eq('student_id', studentId)
    .eq('assessment_id', assessmentId)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastAttemptError) {
    throw new Error(`Unable to read prior attempts: ${lastAttemptError.message}`);
  }

  const lastAttemptNumber = (lastAttempt?.attempt_number as number | undefined) ?? 0;
  const hasInProgress = (lastAttempt?.status as string | null) === 'in_progress';
  const attemptNumber = hasInProgress ? lastAttemptNumber : lastAttemptNumber + 1;

  let attemptId = (lastAttempt?.id as number | null | undefined) ?? null;

  if (!attemptId || !hasInProgress) {
    const { data: attempt, error: attemptError } = await supabase
      .from('student_assessment_attempts')
      .insert({
        student_id: studentId,
        assessment_id: assessmentId,
        attempt_number: attemptNumber,
        status: 'in_progress',
        metadata: { source: 'placement', grade_band: resolvedGradeBand },
      })
      .select('id')
      .maybeSingle();

    if (attemptError || !attempt?.id) {
      throw new Error(`Unable to start placement attempt: ${attemptError?.message ?? 'unknown error'}`);
    }

    attemptId = attempt.id as number;
  }

  let questions: PlacementQuestion[] = [];
  let validationSnapshot: { invalidReasons: Array<{ bankQuestionId: number; reason: string }>; filteredOutCount: number } | null =
    null;
  try {
    const loaded = await loadPlacementQuestions(contentClient, assessmentId);
    questions = loaded.questions;
    validationSnapshot = loaded.validation;
  } catch (error) {
    if (error instanceof HttpError && error.code === 'placement_content_invalid') {
      recordOpsEvent({
        type: 'placement_content_invalid',
        label: String(assessmentId),
        reason: error.code,
        metadata: {
          assessmentId,
          gradeBand: resolvedGradeBand,
          moduleId: (assessmentSnapshot?.module_id as number | null | undefined) ?? null,
          purpose: ((assessmentSnapshot?.metadata as Record<string, unknown> | null | undefined)?.purpose as string | undefined) ?? null,
          details: error.details ?? null,
        },
      });
      raiseAlert('placement_zero_valid_questions', {
        assessmentId,
        gradeBand: resolvedGradeBand,
        moduleId: (assessmentSnapshot?.module_id as number | null | undefined) ?? null,
        purpose: ((assessmentSnapshot?.metadata as Record<string, unknown> | null | undefined)?.purpose as string | undefined) ?? null,
      });
    }
    throw error;
  }

  recordOpsEvent({
    type: 'placement_selected',
    label: String(assessmentId),
    metadata: {
      assessmentId,
      gradeBand: resolvedGradeBand,
      moduleId: (assessmentSnapshot?.module_id as number | null | undefined) ?? null,
      purpose: ((assessmentSnapshot?.metadata as Record<string, unknown> | null | undefined)?.purpose as string | undefined) ?? null,
      totalQuestions: questions.length,
      skippedCount: validationSnapshot?.filteredOutCount ?? null,
      invalidCount: validationSnapshot?.invalidReasons.length ?? null,
    },
  });

  const { data: responseRows, error: responseError } = await supabase
    .from('student_assessment_responses')
    .select('question_id, selected_option_id, is_correct')
    .eq('attempt_id', attemptId);

  if (responseError) {
    console.warn('[placement] Unable to hydrate previous responses', responseError);
  }

  const existingResponses: PlacementStartResult['existingResponses'] = [];
  (responseRows ?? []).forEach((row) => {
    existingResponses.push({
      questionId: row.question_id as number,
      selectedOptionId: (row.selected_option_id as number | null | undefined) ?? null,
      isCorrect: (row.is_correct as boolean | null | undefined) ?? null,
    });
  });

  const resumeToken = Buffer.from(`${studentId}:${attemptId}`).toString('base64');

  return {
    assessmentId,
    attemptId,
    attemptNumber,
    gradeBand: resolvedGradeBand,
    resumeToken,
    items: questions,
    existingResponses,
  };
};

/**
 * Expand a grade band like '3-5' into individual grade strings ['3', '4', '5']
 * Also handles single grades like '4' -> ['4']
 */
const expandGradeBand = (gradeBand: string): string[] => {
  const normalized = gradeBand.trim();

  // Handle K-2 format
  if (normalized.toLowerCase() === 'k-2' || normalized.toLowerCase() === 'k') {
    return ['K', '1', '2'];
  }

  // Handle range format like '3-5', '6-8', '9-12'
  const rangeMatch = normalized.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = Number.parseInt(rangeMatch[1]!, 10);
    const end = Number.parseInt(rangeMatch[2]!, 10);
    const grades: string[] = [];
    for (let i = start; i <= end; i++) {
      grades.push(String(i));
    }
    return grades;
  }

  // Handle single grade number
  const numericGrade = Number.parseInt(normalized, 10);
  if (Number.isFinite(numericGrade) && numericGrade >= 1 && numericGrade <= 12) {
    return [String(numericGrade)];
  }

  // Fallback: return as-is
  return [normalized];
};

const fetchCanonicalSequence = async (
  supabase: SupabaseClient,
  gradeBand: string,
  limit: number,
  gradeLevel?: number | null,
): Promise<
  Array<{
    position: number;
    module_id: number | null;
    module_slug: string | null;
    module_title: string | null;
    standard_codes: string[] | null;
  }>
> => {
  // First, try learning_sequences with the exact grade band (for backwards compatibility)
  const { data, error } = await supabase
    .from('learning_sequences')
    .select('position, module_id, module_slug, module_title, standard_codes')
    .eq('grade_band', gradeBand)
    .order('position', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Unable to read learning sequences: ${error.message}`);
  }

  if (data && data.length > 0) {
    return data.map((row) => ({
      position: row.position as number,
      module_id: (row.module_id as number | null | undefined) ?? null,
      module_slug: (row.module_slug as string | null | undefined) ?? null,
      module_title: (row.module_title as string | null | undefined) ?? null,
      standard_codes: (row.standard_codes as string[] | null | undefined) ?? null,
    }));
  }

  // Expand the grade band to individual grades (e.g., '3-5' -> ['3', '4', '5'])
  const expandedGrades = expandGradeBand(gradeBand);

  // Prioritize the student's exact grade level if available
  let orderedGrades = [...expandedGrades];
  if (gradeLevel != null && gradeLevel >= 1 && gradeLevel <= 12) {
    const exactGrade = String(gradeLevel);
    // Put exact grade first, then others
    orderedGrades = [exactGrade, ...expandedGrades.filter(g => g !== exactGrade)];
  }

  // Try to find modules matching any of the expanded grades
  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select('id, slug, title, grade_band, subject')
    .in('grade_band', orderedGrades)
    .order('id', { ascending: true })
    .limit(limit * 2); // Get extra to allow sorting

  if (modulesError) {
    throw new Error(`Unable to read fallback modules: ${modulesError.message}`);
  }

  if (modules && modules.length > 0) {
    // Sort to prioritize exact grade level, then by grade closeness
    const targetGrade = gradeLevel ?? gradeBandToLevel(gradeBand) ?? 5;
    const sorted = [...modules].sort((a, b) => {
      const aGrade = Number.parseInt(a.grade_band ?? '0', 10) || 0;
      const bGrade = Number.parseInt(b.grade_band ?? '0', 10) || 0;
      const aDist = Math.abs(aGrade - targetGrade);
      const bDist = Math.abs(bGrade - targetGrade);
      return aDist - bDist;
    });

    return sorted.slice(0, limit).map((module, index) => ({
      position: index + 1,
      module_id: module.id as number,
      module_slug: (module.slug as string | null | undefined) ?? null,
      module_title: (module.title as string | null | undefined) ?? null,
      standard_codes: [],
    }));
  }

  // Ultimate fallback: try any modules if none found for the grade band
  console.warn(`[learningPaths] No modules found for grade band ${gradeBand}, expanding search`);
  const { data: fallbackModules } = await supabase
    .from('modules')
    .select('id, slug, title, grade_band')
    .order('id', { ascending: true })
    .limit(limit);

  return (fallbackModules ?? []).map((module, index) => ({
    position: index + 1,
    module_id: module.id as number,
    module_slug: (module.slug as string | null | undefined) ?? null,
    module_title: (module.title as string | null | undefined) ?? null,
    standard_codes: [],
  }));
};


export const buildStudentPath = async (
  supabase: SupabaseClient,
  studentId: string,
  options?: PathBuildOptions,
): Promise<{ pathId: number; entries: PathEntry[] }> => {
  const profile = await loadStudentProfile(supabase, studentId);
  const gradeBand = deriveGradeBand(profile.grade_level, options?.gradeBand ?? profile.grade_band);

  const { error: pauseError } = await supabase
    .from('student_paths')
    .update({ status: 'paused' })
    .eq('student_id', studentId)
    .eq('status', 'active');

  if (pauseError) {
    throw new Error(`Unable to pause existing paths: ${pauseError.message}`);
  }

  const { data: pathRow, error: pathError } = await supabase
    .from('student_paths')
    .insert({
      student_id: studentId,
      status: 'active',
      metadata: {
        source: options?.source ?? 'placement',
        grade_band: gradeBand,
        goal_focus: options?.goalFocus ?? profile.preferences.goal_focus ?? null,
        ...(options?.metadata ?? {}),
      },
    })
    .select('id')
    .maybeSingle();

  if (pathError || !pathRow?.id) {
    throw new Error(`Unable to create learning path: ${pathError?.message ?? 'unknown error'}`);
  }

  const sequence = await fetchCanonicalSequence(supabase, gradeBand, options?.limit ?? 12, profile.grade_level);

  const entries = sequence.map((item, index) => ({
    path_id: pathRow.id as number,
    position: index + 1,
    type: 'lesson',
    module_id: item.module_id,
    lesson_id: null,
    assessment_id: null,
    status: 'not_started',
    target_standard_codes: item.standard_codes ?? [],
    metadata: {
      module_slug: item.module_slug,
      module_title: item.module_title,
      source: options?.source ?? 'placement',
    },
  }));

  if (entries.length > 0) {
    const { error: entryError } = await supabase.from('student_path_entries').insert(entries);
    if (entryError) {
      throw new Error(`Unable to seed path entries: ${entryError.message}`);
    }
  }

  const { data: entryRows, error: entryQueryError } = await supabase
    .from('student_path_entries')
    .select('id, path_id, position, type, module_id, lesson_id, assessment_id, status, score, time_spent_s, target_standard_codes, metadata, created_at, updated_at')
    .eq('path_id', pathRow.id)
    .order('position');

  if (entryQueryError) {
    throw new Error(`Unable to read path entries: ${entryQueryError.message}`);
  }

  return {
    pathId: pathRow.id as number,
    entries: (entryRows as PathEntry[]) ?? [],
  };
};

export const submitPlacementAssessment = async (
  supabase: SupabaseClient,
  studentId: string,
  payload: {
    assessmentId: number;
    attemptId?: number | null;
    responses?: PlacementResponseInput[];
    goalFocus?: string | null;
    gradeBand?: string | null;
    fullName?: string | null;
    optInAi?: boolean;
    avatarId?: string | null;
    tutorPersonaId?: string | null;
  },
  serviceSupabase?: SupabaseClient | null,
): Promise<{ pathId: number; entries: PathEntry[]; strandEstimates: StrandEstimate[]; score: number; masteryPct: number }> => {
  if (!payload.assessmentId) {
    throw new Error('assessmentId is required to submit placement.');
  }

  const attemptId =
    payload.attemptId ??
    (await (async () => {
      const { data, error } = await supabase
        .from('student_assessment_attempts')
        .select('id')
        .eq('student_id', studentId)
        .eq('assessment_id', payload.assessmentId)
        .order('attempt_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        throw new Error(`Unable to resolve placement attempt: ${error.message}`);
      }
      return (data?.id as number | null | undefined) ?? null;
    })());

  if (!attemptId) {
    throw new Error('No placement attempt found to submit.');
  }

  await ensureStudentProfileProvisioned(supabase, serviceSupabase ?? null, studentId, {
    gradeBand: payload.gradeBand,
    fullName: payload.fullName,
    optInAi: payload.optInAi,
    avatarId: payload.avatarId ?? null,
    tutorPersonaId: payload.tutorPersonaId ?? null,
  });

  const profile = await loadStudentProfile(supabase, studentId);
  const resolvedGradeBand = deriveGradeBand(profile.grade_level, payload.gradeBand ?? profile.grade_band);

  const contentClient = serviceSupabase ?? supabase;
  const { questions } = await loadPlacementQuestions(contentClient, payload.assessmentId);
  const questionMap = new Map<number, PlacementQuestion>();
  questions.forEach((question) => questionMap.set(question.bankQuestionId, question));

  const responsePayload =
    payload.responses?.map((response) => {
      const question = questionMap.get(response.bankQuestionId);
      if (!question) return null;
      const option = question.options.find((opt) => opt.id === response.optionId);
      const isCorrect = option ? option.isCorrect : false;
      const timeSpentSeconds =
        typeof response.timeSpentSeconds === 'number' && Number.isFinite(response.timeSpentSeconds)
          ? Math.max(1, Math.round(response.timeSpentSeconds))
          : null;
      return {
        attempt_id: attemptId,
        question_id: response.bankQuestionId,
        selected_option_id: response.optionId,
        response_content: option ? { text: option.text } : null,
        is_correct: isCorrect,
        score: isCorrect ? question.weight : 0,
        time_spent_seconds: timeSpentSeconds,
      };
    }) ?? [];

  if (responsePayload.length) {
    const filtered = responsePayload.filter(Boolean) as Array<Record<string, unknown>>;
    if (filtered.length) {
      const { error: upsertError } = await supabase
        .from('student_assessment_responses')
        .upsert(filtered, { onConflict: 'attempt_id,question_id' });
      if (upsertError) {
        throw new Error(`Unable to save responses: ${upsertError.message}`);
      }
    }
  }

  const { data: savedResponses, error: savedError } = await supabase
    .from('student_assessment_responses')
    .select('question_id, selected_option_id, is_correct')
    .eq('attempt_id', attemptId);

  if (savedError) {
    throw new Error(`Unable to load saved responses: ${savedError.message}`);
  }

  const responsesForScoring = (savedResponses ?? []).map((row) => {
    const question = questionMap.get(row.question_id as number);
    if (!question) return null;
    const isCorrect = (row.is_correct as boolean | null | undefined) ?? false;
    return {
      question,
      isCorrect,
    };
  }).filter((entry): entry is { question: PlacementQuestion; isCorrect: boolean } => Boolean(entry));

  const totalWeight = responsesForScoring.reduce((sum, entry) => sum + (entry.question.weight ?? 1), 0);
  const earnedWeight = responsesForScoring.reduce(
    (sum, entry) => sum + (entry.isCorrect ? entry.question.weight ?? 1 : 0),
    0,
  );
  const masteryPct = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  const strandTotals = new Map<string, { correct: number; total: number }>();
  responsesForScoring.forEach((entry) => {
    const strand = entry.question.strand ?? 'general';
    const current = strandTotals.get(strand) ?? { correct: 0, total: 0 };
    if (entry.isCorrect) current.correct += 1;
    current.total += 1;
    strandTotals.set(strand, current);
  });
  const strandEstimates: StrandEstimate[] = Array.from(strandTotals.entries()).map(([strand, stats]) => ({
    strand,
    correct: stats.correct,
    total: stats.total,
    accuracyPct: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
  }));

  const attemptUpdate: Record<string, unknown> = {
    status: 'completed',
    completed_at: new Date().toISOString(),
    total_score: earnedWeight,
    mastery_pct: masteryPct,
    metadata: {
      grade_band: resolvedGradeBand,
      strand_estimates: strandEstimates,
      source: 'placement',
      goal_focus: payload.goalFocus ?? null,
    },
  };

  const { error: attemptUpdateError } = await supabase
    .from('student_assessment_attempts')
    .update(attemptUpdate)
    .eq('id', attemptId);

  if (attemptUpdateError) {
    throw new Error(`Unable to complete assessment attempt: ${attemptUpdateError.message}`);
  }

  await supabase.from('student_profiles').update({ assessment_completed: true }).eq('id', studentId);

  try {
    await supabase.from('student_events').insert({
      student_id: studentId,
      event_type: 'diagnostic_completed',
      payload: {
        assessment_id: payload.assessmentId,
        attempt_id: attemptId,
        score: masteryPct,
        strand_estimates: strandEstimates,
      },
      points_awarded: 0,
    });
  } catch (eventError) {
    console.warn('[placement] Unable to record diagnostic event', eventError);
  }

  const pathResult = await buildStudentPath(supabase, studentId, {
    gradeBand: resolvedGradeBand,
    goalFocus: payload.goalFocus,
    source: 'placement',
    metadata: { assessment_id: payload.assessmentId, attempt_id: attemptId, strand_estimates: strandEstimates },
  });

  // Keep legacy learning_path field roughly aligned for downstream consumers that still read it.
  try {
    const summarizedPath = pathResult.entries.slice(0, 12).map((entry) => ({
      moduleSlug: (entry.metadata as Record<string, unknown> | null | undefined)?.module_slug ?? null,
      status: entry.status,
      type: entry.type,
      moduleTitle: (entry.metadata as Record<string, unknown> | null | undefined)?.module_title ?? null,
    }));
    await supabase.from('student_profiles').update({ learning_path: summarizedPath }).eq('id', studentId);
  } catch (legacyError) {
    console.warn('[placement] Unable to sync legacy learning_path', legacyError);
  }

  return {
    ...pathResult,
    strandEstimates,
    score: masteryPct,
    masteryPct,
  };
};

const normalizeStandards = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim();
        if (typeof entry === 'number') return String(entry);
        return null;
      })
      .filter((entry): entry is string => Boolean(entry))
      .map((code) => code.trim())
      .filter((code) => code.length > 0);
    return Array.from(new Set(normalized)).slice(0, MAX_STANDARDS_TRACKED);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value as Record<string, unknown>).slice(0, MAX_STANDARDS_TRACKED);
  }
  return [];
};

const mapEventRowToAttempt = (row: { event_type?: string; payload?: Record<string, unknown> | null; created_at?: string | null }): AdaptiveAttempt | null => {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const eventType = (row.event_type ?? '').toLowerCase();
  const createdAt = (row.created_at as string | null | undefined) ?? new Date().toISOString();

  if (!eventType) return null;

  if (eventType === 'practice_answered') {
    const correct = Boolean(payload.correct);
    const difficulty = typeof payload.difficulty === 'number' && Number.isFinite(payload.difficulty) ? payload.difficulty : null;
    const standards = normalizeStandards(payload.standards ?? payload.standard_codes ?? []);
    return { standards, correct, difficulty, source: 'practice', createdAt, accuracy: correct ? 1 : 0 };
  }

  if (eventType === 'quiz_submitted') {
    const score = typeof payload.score === 'number' && Number.isFinite(payload.score) ? payload.score : null;
    const accuracy = score != null ? Math.max(0, Math.min(1, score / 100)) : null;
    const standards = normalizeStandards(payload.standard_breakdown ?? payload.standards ?? []);
    const difficulty = typeof payload.difficulty === 'number' && Number.isFinite(payload.difficulty) ? payload.difficulty : null;
    return {
      standards,
      correct: accuracy == null ? false : accuracy >= TARGET_ACCURACY_BAND.min,
      difficulty,
      source: 'quiz',
      createdAt,
      accuracy,
    };
  }

  if (eventType === 'lesson_completed') {
    const standards = normalizeStandards(payload.standards ?? []);
    const difficulty = typeof payload.difficulty === 'number' && Number.isFinite(payload.difficulty) ? payload.difficulty : null;
    return { standards, correct: true, difficulty, source: 'lesson', createdAt, accuracy: 1 };
  }

  return null;
};

const fetchAdaptiveAttempts = async (
  supabase: SupabaseClient,
  studentId: string,
  limit = MAX_ADAPTIVE_ATTEMPTS,
): Promise<AdaptiveAttempt[]> => {
  const { data, error } = await supabase
    .from('student_events')
    .select('event_type, payload, created_at')
    .eq('student_id', studentId)
    .in('event_type', ['practice_answered', 'quiz_submitted', 'lesson_completed'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[adaptive] Unable to load recent attempts', error);
    captureServerException(error, { stage: 'adaptive_attempts_fetch', limit });
    return [];
  }

  return ((data ?? []) as Array<{ event_type?: string; payload?: Record<string, unknown>; created_at?: string }>)
    .map(mapEventRowToAttempt)
    .filter((attempt): attempt is AdaptiveAttempt => Boolean(attempt));
};

const readAdaptiveState = (
  metadata: Record<string, unknown> | null | undefined,
): { currentDifficulty: number; difficultyStreak: number } => {
  const adaptive =
    ((metadata?.adaptive_state as Record<string, unknown> | null | undefined) ??
      (metadata?.adaptive as Record<string, unknown> | null | undefined) ??
      {}) as Record<string, unknown>;
  const currentDifficulty =
    typeof adaptive.current_difficulty === 'number' && Number.isFinite(adaptive.current_difficulty)
      ? Math.max(1, Math.min(5, Math.round(adaptive.current_difficulty)))
      : 1;
  const difficultyStreak =
    typeof adaptive.difficulty_streak === 'number' && Number.isFinite(adaptive.difficulty_streak)
      ? Math.max(0, Math.round(adaptive.difficulty_streak))
      : 0;
  return { currentDifficulty, difficultyStreak };
};

const resolveEntryFromPayload = (entries: PathEntry[], payload: Record<string, unknown>): number | null => {
  if (!entries.length) return null;
  const moduleId = typeof payload.module_id === 'number' ? payload.module_id : null;
  const lessonId = typeof payload.lesson_id === 'number' ? payload.lesson_id : null;
  const assessmentId = typeof payload.assessment_id === 'number' ? payload.assessment_id : null;

  const match = entries.find(
    (entry) =>
      entry.status !== 'completed' &&
      ((lessonId && entry.lesson_id === lessonId) ||
        (assessmentId && entry.assessment_id === assessmentId) ||
        (moduleId && entry.module_id === moduleId)),
  );

  return match ? (match.id as number) : null;
};

const mergePathEntryMetadata = async (
  supabase: SupabaseClient,
  entryId: number,
  attempt: AdaptiveAttempt | null,
  timeSpentSeconds?: number | null,
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('student_path_entries')
      .select('metadata')
      .eq('id', entryId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    const currentMetadata = ((data?.metadata as Record<string, unknown> | null | undefined) ?? {}) as Record<
      string,
      unknown
    >;
    const attempts = typeof currentMetadata.attempts === 'number' ? currentMetadata.attempts : 0;
    const nextMetadata: Record<string, unknown> = {
      ...currentMetadata,
      attempts: attempts + 1,
      last_event_at: new Date().toISOString(),
    };
    if (timeSpentSeconds && Number.isFinite(timeSpentSeconds)) {
      const existingTime =
        typeof currentMetadata.time_spent_s === 'number' && Number.isFinite(currentMetadata.time_spent_s)
          ? currentMetadata.time_spent_s
          : 0;
      nextMetadata.time_spent_s = existingTime + Math.max(0, Math.round(timeSpentSeconds));
    }
    if (attempt) {
      nextMetadata.last_difficulty = attempt.difficulty ?? nextMetadata.last_difficulty ?? null;
      nextMetadata.last_accuracy = attempt.accuracy ?? nextMetadata.last_accuracy ?? null;
      nextMetadata.last_correct = attempt.correct;
      if (attempt.standards.length) {
        nextMetadata.last_standards = attempt.standards;
      }
    }

    const { error: updateError } = await supabase
      .from('student_path_entries')
      .update({ metadata: nextMetadata })
      .eq('id', entryId);
    if (updateError) {
      throw updateError;
    }
  } catch (metadataError) {
    console.warn('[adaptive] Unable to update path entry metadata', metadataError);
    captureServerException(metadataError, { stage: 'adaptive_entry_metadata_update', entryId });
  }
};

const computeRollingAccuracy = (attempts: AdaptiveAttempt[]): number | null => {
  const recent = attempts.filter((attempt) => attempt.accuracy != null);
  if (!recent.length) return null;
  const total = recent.reduce((sum, attempt) => sum + (attempt.accuracy ?? 0), 0);
  return Math.max(0, Math.min(1, total / recent.length));
};

const detectMisconceptions = (attempts: AdaptiveAttempt[]): string[] => {
  const byStandard = new Map<string, AdaptiveAttempt[]>();
  attempts.forEach((attempt) => {
    const standards = attempt.standards.length ? attempt.standards : ['general'];
    standards.forEach((code) => {
      const list = byStandard.get(code) ?? [];
      list.push(attempt);
      byStandard.set(code, list);
    });
  });

  const remediation = new Set<string>();
  byStandard.forEach((entries, standard) => {
    const recent = entries.slice(0, 3);
    if (recent.length < 2) return;
    const misses = recent.filter((attempt) => !attempt.correct && (attempt.accuracy ?? 0) < TARGET_ACCURACY_BAND.max);
    if (misses.length >= 2) {
      remediation.add(standard);
    }
  });

  return Array.from(remediation).slice(0, MAX_STANDARDS_TRACKED);
};

const pickStretchStandard = (attempts: AdaptiveAttempt[]): string | null => {
  const coverage = new Map<string, { attempts: number; correct: number }>();
  attempts.forEach((attempt) => {
    const standards = attempt.standards.length ? attempt.standards : ['general'];
    standards.forEach((code) => {
      const entry = coverage.get(code) ?? { attempts: 0, correct: 0 };
      entry.attempts += 1;
      if (attempt.correct) {
        entry.correct += 1;
      }
      coverage.set(code, entry);
    });
  });
  if (!coverage.size) return null;

  const sorted = Array.from(coverage.entries()).sort((a, b) => {
    const coverageA = a[1].attempts;
    const coverageB = b[1].attempts;
    if (coverageA === coverageB) return (b[1].correct / Math.max(1, coverageB)) - (a[1].correct / Math.max(1, coverageA));
    return coverageA - coverageB;
  });

  return sorted[0]?.[0] ?? null;
};

const shouldInsertRemediation = (entries: PathEntry[], standard: string): boolean => {
  return !entries.some(
    (entry) =>
      entry.status !== 'completed' &&
      (entry.type === 'review' || (entry.metadata as Record<string, unknown> | null | undefined)?.reason === 'remediation') &&
      entry.target_standard_codes?.includes(standard),
  );
};

const appendAdaptiveEntry = async (
  supabase: SupabaseClient,
  pathId: number,
  entries: PathEntry[],
  type: PathEntry['type'],
  targetStandards: string[],
  metadata: Record<string, unknown>,
): Promise<PathEntry | null> => {
  const pendingOfType = entries.filter((entry) => entry.status !== 'completed' && entry.type === type).length;
  if ((type === 'review' && pendingOfType >= MAX_REMEDIATION_INSERTS) || (type === 'practice' && pendingOfType >= MAX_PENDING_PRACTICE)) {
    return null;
  }
  if (targetStandards.length) {
    const duplicate = entries.some(
      (entry) =>
        entry.status !== 'completed' &&
        entry.type === type &&
        entry.target_standard_codes.some((code) => targetStandards.includes(code)),
    );
    if (duplicate) {
      return null;
    }
  }

  const position = entries.reduce((max, entry) => Math.max(max, entry.position), 0) + 1;
  const insertPayload = {
    path_id: pathId,
    position,
    type,
    module_id: null,
    lesson_id: null,
    assessment_id: null,
    status: 'not_started',
    target_standard_codes: targetStandards,
    metadata,
  };

  const { data, error } = await supabase
    .from('student_path_entries')
    .insert(insertPayload)
    .select('id, path_id, position, type, module_id, lesson_id, assessment_id, status, score, time_spent_s, target_standard_codes, metadata, created_at, updated_at')
    .maybeSingle();

  if (error) {
    console.warn('[adaptive] Unable to append adaptive entry', error);
    captureServerException(error, { stage: 'adaptive_entry_append', pathId, type });
    return null;
  }

  return data as PathEntry;
};

const chooseAdaptiveNext = (entries: PathEntry[]): PathEntry | null => {
  const pending = entries.filter((entry) => entry.status !== 'completed');
  if (!pending.length) {
    return null;
  }

  const priority = (entry: PathEntry): number => {
    const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
    const reason = (metadata.reason as string | null | undefined) ?? '';
    if (reason === 'remediation' || entry.type === 'review') return 3;
    if (reason === 'stretch' || entry.type === 'practice') return 2;
    return 1;
  };

  return pending
    .slice()
    .sort((a, b) => {
      const priorityDelta = priority(b) - priority(a);
      if (priorityDelta !== 0) return priorityDelta;
      return a.position - b.position;
    })[0];
};

const updateAdaptiveState = (
  state: { currentDifficulty: number; difficultyStreak: number },
  latestAttempt: AdaptiveAttempt | null,
  rollingAccuracy: number | null,
): { currentDifficulty: number; difficultyStreak: number } => {
  let { currentDifficulty, difficultyStreak } = state;
  if (latestAttempt) {
    const attemptedDifficulty =
      typeof latestAttempt.difficulty === 'number' && Number.isFinite(latestAttempt.difficulty)
        ? Math.max(1, Math.min(5, Math.round(latestAttempt.difficulty)))
        : null;
    const isCorrect =
      latestAttempt.correct || (latestAttempt.accuracy != null && latestAttempt.accuracy >= TARGET_ACCURACY_BAND.min);

    if (isCorrect && (attemptedDifficulty == null || attemptedDifficulty === currentDifficulty)) {
      difficultyStreak += 1;
      if (difficultyStreak >= 2) {
        currentDifficulty = Math.min(currentDifficulty + 1, 5);
        difficultyStreak = 0;
      }
    } else if (!isCorrect) {
      difficultyStreak = 0;
      if (rollingAccuracy != null && rollingAccuracy < TARGET_ACCURACY_BAND.min) {
        currentDifficulty = Math.max(1, currentDifficulty - 1);
      }
    } else {
      difficultyStreak = 1;
    }
  }

  if (rollingAccuracy != null) {
    if (rollingAccuracy > TARGET_ACCURACY_BAND.max + 0.05 && currentDifficulty < 5) {
      currentDifficulty = Math.min(currentDifficulty + 1, 5);
      difficultyStreak = 0;
    } else if (rollingAccuracy < TARGET_ACCURACY_BAND.min - 0.05 && currentDifficulty > 1) {
      currentDifficulty = Math.max(1, currentDifficulty - 1);
      difficultyStreak = 0;
    }
  }

  return { currentDifficulty, difficultyStreak };
};

export const getStudentPath = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<{ path: PathSummary; entries: PathEntry[] } | null> => {
  const { data: pathRow, error: pathError } = await supabase
    .from('student_paths')
    .select('id, status, started_at, updated_at, metadata')
    .eq('student_id', studentId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pathError) {
    throw new Error(`Unable to load student path: ${pathError.message}`);
  }

  if (!pathRow?.id) {
    return null;
  }

  const { data: entries, error: entriesError } = await supabase
    .from('student_path_entries')
    .select('id, path_id, position, type, module_id, lesson_id, assessment_id, status, score, time_spent_s, target_standard_codes, metadata, created_at, updated_at')
    .eq('path_id', pathRow.id)
    .order('position', { ascending: true });

  if (entriesError) {
    throw new Error(`Unable to load path entries: ${entriesError.message}`);
  }

  return {
    path: {
      id: pathRow.id as number,
      status: pathRow.status as string,
      started_at: pathRow.started_at as string,
      updated_at: pathRow.updated_at as string,
      metadata: (pathRow.metadata as Record<string, unknown> | null | undefined) ?? null,
    },
    entries: (entries as PathEntry[]) ?? [],
  };
};

export const selectNextEntry = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<PathEntry | null> => {
  const currentPath = await getStudentPath(supabase, studentId);
  if (!currentPath) return null;

  const pending = chooseAdaptiveNext(currentPath.entries);
  if (pending) {
    return pending;
  }

  const { data: suggestions, error: suggestionError } = await supabase
    .rpc('suggest_next_lessons', { p_student_id: studentId, limit_count: 1 });

  if (suggestionError) {
    throw new Error(`Unable to compute next activity: ${suggestionError.message}`);
  }

  if (Array.isArray(suggestions) && suggestions.length > 0) {
    const suggestion = suggestions[0] as Record<string, unknown>;
    return {
      id: 0,
      path_id: currentPath.path.id,
      position: currentPath.entries.length + 1,
      type: 'lesson',
      module_id: null,
      lesson_id: suggestion.lesson_id as number,
      assessment_id: null,
      status: 'not_started',
      score: null,
      time_spent_s: null,
      target_standard_codes: [],
      metadata: { reason: suggestion.reason ?? 'adaptive_suggestion' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return null;
};

export const getAdaptiveContext = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<{ targetDifficulty: number; misconceptions: string[]; recentAttempts: AdaptiveAttempt[] }> => {
  await syncAdaptiveConfig(supabase);
  const path = await getStudentPath(supabase, studentId);
  const attempts = await fetchAdaptiveAttempts(supabase, studentId, 12);
  const state = readAdaptiveState(path?.path.metadata ?? {});
  const misconceptions = detectMisconceptions(attempts);

  return {
    targetDifficulty: state.currentDifficulty,
    misconceptions,
    recentAttempts: attempts.slice(0, 8),
  };
};

export const applyAdaptiveEvent = async (
  supabase: SupabaseClient,
  studentId: string,
  event: {
    eventType: string;
    pathEntryId?: number | null;
    status?: 'not_started' | 'in_progress' | 'completed' | null;
    score?: number | null;
    timeSpentSeconds?: number | null;
    payload?: Record<string, unknown> | null;
  },
): Promise<{ path: { path: PathSummary; entries: PathEntry[] } | null; next: PathEntry | null; adaptive: { targetDifficulty: number; misconceptions: string[]; recentAttempts: AdaptiveAttempt[] } }> => {
  await syncAdaptiveConfig(supabase);
  const currentPath = await getStudentPath(supabase, studentId);
  if (!currentPath) {
    return { path: null, next: null, adaptive: { targetDifficulty: 1, misconceptions: [], recentAttempts: [] } };
  }

  const payload = event.payload ?? {};
  const inferredEntryId = resolveEntryFromPayload(currentPath.entries, payload);
  const resolvedEntryId = event.pathEntryId ?? inferredEntryId;
  const attemptSnapshot = mapEventRowToAttempt({
    event_type: event.eventType,
    payload,
    created_at: new Date().toISOString(),
  });

  if (resolvedEntryId) {
    await updatePathEntryProgress(supabase, resolvedEntryId, {
      status: event.status as 'not_started' | 'in_progress' | 'completed' | undefined,
      score: event.score ?? null,
      timeSpentSeconds: event.timeSpentSeconds ?? null,
    });
    await mergePathEntryMetadata(supabase, resolvedEntryId, attemptSnapshot, event.timeSpentSeconds ?? null);
    recordOpsEvent({
      type: 'path_progress',
      label: event.eventType,
      durationMs: event.timeSpentSeconds != null ? event.timeSpentSeconds * 1000 : null,
    });
  }

  const attempts = await fetchAdaptiveAttempts(supabase, studentId, MAX_ADAPTIVE_ATTEMPTS);
  const attemptsWithCurrent =
    attemptSnapshot && !attempts.some((entry) => entry.createdAt === attemptSnapshot.createdAt && entry.source === attemptSnapshot.source)
      ? [attemptSnapshot, ...attempts].slice(0, MAX_ADAPTIVE_ATTEMPTS)
      : attempts;

  const rollingAccuracy = computeRollingAccuracy(attemptsWithCurrent);
  const misconceptions = detectMisconceptions(attemptsWithCurrent);
  const adaptiveState = readAdaptiveState(currentPath.path.metadata ?? {});
  const updatedState = updateAdaptiveState(adaptiveState, attemptsWithCurrent[0] ?? null, rollingAccuracy);
  const previousMisconceptions = Array.isArray(
    (currentPath.path.metadata as Record<string, unknown> | null | undefined)?.adaptive_state?.misconceptions,
  )
    ? (((currentPath.path.metadata as Record<string, unknown> | null | undefined)?.adaptive_state as Record<string, unknown>)?.misconceptions as string[]).filter(
      (code): code is string => typeof code === 'string',
    )
    : [];
  const newlyTagged = misconceptions.filter((code) => !previousMisconceptions.includes(code)).slice(0, MAX_STANDARDS_TRACKED);

  const nextMetadata = {
    ...(currentPath.path.metadata ?? {}),
    adaptive_state: {
      current_difficulty: updatedState.currentDifficulty,
      difficulty_streak: updatedState.difficultyStreak,
      target_accuracy_min: TARGET_ACCURACY_BAND.min,
      target_accuracy_max: TARGET_ACCURACY_BAND.max,
      misconceptions,
      updated_at: new Date().toISOString(),
    },
  };

  try {
    await supabase.from('student_paths').update({ metadata: nextMetadata }).eq('id', currentPath.path.id);
  } catch (metaError) {
    console.warn('[adaptive] Unable to persist adaptive state on path', metaError);
    captureServerException(metaError, { stage: 'adaptive_state_persist', pathId: currentPath.path.id });
  }

  if (newlyTagged.length) {
    try {
      const payloads = newlyTagged.map((code) => ({
        student_id: studentId,
        event_type: 'misconception_tagged',
        payload: { standard_code: code, source: 'adaptive_detector' },
        points_awarded: 0,
      }));
      await supabase.from('student_events').insert(payloads);
    } catch (misError) {
      console.warn('[adaptive] Unable to persist misconception events', misError);
      captureServerException(misError, { stage: 'adaptive_misconception_events', count: newlyTagged.length });
    }
  }

  const workingEntries = [...currentPath.entries];

  for (const standard of misconceptions) {
    if (!shouldInsertRemediation(workingEntries, standard)) continue;
    const label = standard.includes(':') ? standard.split(':').slice(1).join(':') : standard;
    const inserted = await appendAdaptiveEntry(
      supabase,
      currentPath.path.id,
      workingEntries,
      'review',
      [standard],
      {
        reason: 'remediation',
        module_title: `Review ${label || standard}`,
        standard_code: standard,
        source: 'adaptive_selector',
      },
    );
    if (inserted) {
      workingEntries.push(inserted);
    }
  }

  if (rollingAccuracy != null && rollingAccuracy > TARGET_ACCURACY_BAND.max) {
    const stretchStandard = pickStretchStandard(attemptsWithCurrent);
    const stretchLabel = stretchStandard ? (stretchStandard.includes(':') ? stretchStandard.split(':').slice(1).join(':') : stretchStandard) : 'Stretch practice';
    const inserted = await appendAdaptiveEntry(
      supabase,
      currentPath.path.id,
      workingEntries,
      'practice',
      stretchStandard ? [stretchStandard] : [],
      {
        reason: 'stretch',
        module_title: stretchLabel,
        target_difficulty: Math.min(updatedState.currentDifficulty + 1, 5),
        source: 'adaptive_selector',
      },
    );
    if (inserted) {
      workingEntries.push(inserted);
    }
  }

  const refreshedPath = await getStudentPath(supabase, studentId);
  const resolvedPath = refreshedPath ?? { ...currentPath, entries: workingEntries };
  const next = chooseAdaptiveNext(resolvedPath.entries);

  return {
    path: resolvedPath,
    next,
    adaptive: {
      targetDifficulty: updatedState.currentDifficulty,
      misconceptions,
      recentAttempts: attemptsWithCurrent.slice(0, 8),
    },
  };
};

export const savePlacementResponse = async (
  supabase: SupabaseClient,
  studentId: string,
  payload: {
    assessmentId: number;
    attemptId: number;
    bankQuestionId: number;
    optionId: number | null;
    timeSpentSeconds?: number | null;
  },
  serviceSupabase?: SupabaseClient | null,
): Promise<{ isCorrect: boolean }> => {
  const contentClient = serviceSupabase ?? supabase;
  const { questions } = await loadPlacementQuestions(contentClient, payload.assessmentId);
  const question = questions.find((q) => q.bankQuestionId === payload.bankQuestionId);
  if (!question) {
    throw new Error('Question not found for placement assessment.');
  }

  const option = question.options.find((opt) => opt.id === payload.optionId);
  const isCorrect = option ? option.isCorrect : false;
  const timeSpentSeconds =
    typeof payload.timeSpentSeconds === 'number' && Number.isFinite(payload.timeSpentSeconds)
      ? Math.max(1, Math.round(payload.timeSpentSeconds))
      : null;

  const { error } = await supabase.from('student_assessment_responses').upsert(
    {
      attempt_id: payload.attemptId,
      question_id: payload.bankQuestionId,
      selected_option_id: payload.optionId,
      response_content: option ? { text: option.text } : null,
      is_correct: isCorrect,
      score: isCorrect ? question.weight : 0,
      time_spent_seconds: timeSpentSeconds,
    },
    { onConflict: 'attempt_id,question_id' },
  );

  if (error) {
    throw new Error(`Unable to save placement response: ${error.message}`);
  }

  try {
    await supabase
      .from('student_assessment_attempts')
      .update({ status: 'in_progress', metadata: { last_question_id: payload.bankQuestionId } })
      .eq('id', payload.attemptId)
      .eq('student_id', studentId);
  } catch (attemptError) {
    console.warn('[placement] Unable to update attempt progress', attemptError);
  }

  return { isCorrect };
};

export const updatePathEntryProgress = async (
  supabase: SupabaseClient,
  entryId: number,
  updates: { status?: 'not_started' | 'in_progress' | 'completed'; score?: number | null; timeSpentSeconds?: number | null },
): Promise<void> => {
  const now = new Date();
  let metadataUpdate: Record<string, unknown> = {};
  try {
    const { data: existingRow } = await supabase
      .from('student_path_entries')
      .select('status, metadata, time_spent_s')
      .eq('id', entryId)
      .maybeSingle();
    const meta = ((existingRow?.metadata as Record<string, unknown> | null | undefined) ?? {}) as Record<string, unknown>;
    const previousStatus = (existingRow?.status as string | null | undefined) ?? null;

    if (updates.status === 'in_progress' && previousStatus === 'not_started') {
      meta.first_started_at = meta.first_started_at ?? now.toISOString();
      meta.last_started_at = now.toISOString();
    }
    if (updates.status === 'completed') {
      meta.completed_at = now.toISOString();
      const lastStarted = typeof meta.last_started_at === 'string' ? new Date(meta.last_started_at) : null;
      const elapsed = updates.timeSpentSeconds
        ? updates.timeSpentSeconds
        : lastStarted
          ? Math.max(1, Math.round((now.getTime() - lastStarted.getTime()) / 1000))
          : null;
      if (elapsed != null) {
        const existing = typeof meta.time_spent_s === 'number' ? meta.time_spent_s : 0;
        meta.time_spent_s = existing + elapsed;
      }
    }
    metadataUpdate = meta;
  } catch (error) {
    console.warn('[path] unable to read metadata for update', error);
  }

  const payload: Record<string, unknown> = {};
  if (updates.status) payload.status = updates.status;
  if (updates.score !== undefined) payload.score = updates.score;
  if (updates.timeSpentSeconds !== undefined) {
    const existingTime = typeof metadataUpdate.time_spent_s === 'number'
      ? (metadataUpdate.time_spent_s as number)
      : undefined;
    payload.time_spent_s = existingTime != null ? existingTime : updates.timeSpentSeconds;
  }
  if (Object.keys(metadataUpdate).length > 0) payload.metadata = metadataUpdate;

  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase
    .from('student_path_entries')
    .update(payload)
    .eq('id', entryId);

  if (error) {
    throw new Error(`Unable to update path entry: ${error.message}`);
  }
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const safeNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : null;
  if (parsed == null || Number.isNaN(parsed) || !Number.isFinite(parsed)) return null;
  return parsed;
};

const MODULE_MASTERY_THRESHOLD = 85;
const WEEKLY_LOOKBACK_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MAX_EVENT_SAMPLE = 200;

export type StudentInsightSnapshot = {
  avgAccuracy: number | null;
  avgAccuracyPriorWeek: number | null;
  avgAccuracyDelta: number | null;
  weeklyTimeMinutes: number;
  weeklyTimeMinutesPriorWeek: number;
  weeklyTimeMinutesDelta: number | null;
  lessonsCompleted: number;
  modulesMastered: Array<{ moduleId: number; title: string | null; mastery: number }>;
  focusStandards: Array<{ code: string; accuracy: number; samples: number }>;
  latestQuizScore: number | null;
  latestQuizAt: string | null;
  struggle: boolean;
};

export const computeStudentInsights = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<StudentInsightSnapshot> => {
  const runtimeConfig = await getRuntimeConfig(supabase);
  TARGET_ACCURACY_BAND = {
    min: runtimeConfig.adaptive.targetAccuracyMin,
    max: runtimeConfig.adaptive.targetAccuracyMax,
  };
  const now = new Date();
  const weekStart = new Date(now.getTime() - WEEKLY_LOOKBACK_DAYS * MS_PER_DAY);
  const priorWeekStart = new Date(now.getTime() - WEEKLY_LOOKBACK_DAYS * 2 * MS_PER_DAY);
  const priorWeekStartDate = priorWeekStart.toISOString().slice(0, 10);

  const [eventResult, activityResult, progressResult] = await Promise.all([
    supabase
      .from('student_events')
      .select('event_type, payload, created_at')
      .eq('student_id', studentId)
      .in('event_type', ['practice_answered', 'quiz_submitted', 'lesson_completed'])
      .order('created_at', { ascending: false })
      .limit(MAX_EVENT_SAMPLE),
    supabase
      .from('student_daily_activity')
      .select('activity_date, practice_minutes')
      .eq('student_id', studentId)
      .gte('activity_date', priorWeekStartDate),
    supabase
      .from('student_progress')
      .select('mastery_pct, lessons ( module_id, modules ( id, title ) )')
      .eq('student_id', studentId)
      .order('last_activity_at', { ascending: false })
      .limit(400),
  ]);

  if (eventResult.error) {
    throw new Error(`Unable to read student events: ${eventResult.error.message}`);
  }
  if (activityResult.error) {
    console.warn('[insights] Unable to read weekly activity', activityResult.error);
  }
  if (progressResult.error) {
    console.warn('[insights] Unable to read module progress', progressResult.error);
  }

  const accuracySamplesCurrent: number[] = [];
  const accuracySamplesPrior: number[] = [];
  const standardAccuracy = new Map<string, { correct: number; total: number }>();
  const recordStandardAccuracy = (code: string, accuracy: number) => {
    const entry = standardAccuracy.get(code) ?? { correct: 0, total: 0 };
    entry.correct += clamp(accuracy, 0, 1);
    entry.total += 1;
    standardAccuracy.set(code, entry);
  };

  let lessonsCompleted = 0;
  let latestQuizScore: number | null = null;
  let latestQuizAt: string | null = null;
  let eventTimeSecondsCurrent = 0;
  let eventTimeSecondsPrior = 0;
  let consecutiveMisses = 0;
  const struggleThreshold = runtimeConfig.adaptive.struggleConsecutiveMisses;

  for (const row of (eventResult.data ?? []) as Array<{ event_type?: string; payload?: Record<string, unknown> | null; created_at?: string | null }>) {
    const eventType = (row.event_type ?? '').toLowerCase();
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const createdAt = typeof row.created_at === 'string' ? new Date(row.created_at) : now;

    const timeSpent = safeNumber(
      payload.time_spent_s ?? payload.time_spent ?? payload.timeSpentSeconds ?? payload.duration_seconds ?? payload.duration,
    );
    if (timeSpent != null && createdAt >= priorWeekStart) {
      if (createdAt >= weekStart) {
        eventTimeSecondsCurrent += Math.max(0, timeSpent);
      } else {
        eventTimeSecondsPrior += Math.max(0, timeSpent);
      }
    }

    if (eventType === 'lesson_completed') {
      lessonsCompleted += 1;
      continue;
    }

    if (eventType === 'practice_answered') {
      const correct = Boolean(payload.correct);
      if (createdAt >= priorWeekStart) {
        if (createdAt >= weekStart) {
          accuracySamplesCurrent.push(correct ? 1 : 0);
        } else {
          accuracySamplesPrior.push(correct ? 1 : 0);
        }
      }
      consecutiveMisses = correct ? 0 : consecutiveMisses + 1;
      const standards = normalizeStandards(payload.standards ?? payload.standard_codes ?? []);
      standards.forEach((code) => recordStandardAccuracy(code, correct ? 1 : 0));
      continue;
    }

    if (eventType === 'quiz_submitted') {
      const score = safeNumber(payload.score ?? payload.percentage ?? payload.result);
      const normalizedScore = score != null ? (score > 1 ? score / 100 : score) : null;
      if (normalizedScore != null) {
        const boundedScore = clamp(normalizedScore, 0, 1);
        if (createdAt >= priorWeekStart) {
          if (createdAt >= weekStart) {
            accuracySamplesCurrent.push(boundedScore);
          } else {
            accuracySamplesPrior.push(boundedScore);
          }
        }
        if (normalizedScore < TARGET_ACCURACY_BAND.min) {
          consecutiveMisses += 1;
        } else {
          consecutiveMisses = 0;
        }
        if (latestQuizScore == null) {
          latestQuizScore = Math.round(clamp(normalizedScore, 0, 1) * 1000) / 10;
          latestQuizAt = createdAt.toISOString();
        }
      }

      const breakdown = payload.standard_breakdown as Record<string, unknown> | null | undefined;
      if (breakdown && typeof breakdown === 'object') {
        Object.entries(breakdown).forEach(([code, value]) => {
          const pct = safeNumber(value);
          if (pct == null) return;
          const accuracy = pct > 1 ? pct / 100 : pct;
          recordStandardAccuracy(code, accuracy);
        });
      }
    }
  }

  let activityMinutesCurrent = 0;
  let activityMinutesPrior = 0;
  for (const row of (activityResult.data ?? []) as Array<{ activity_date?: string | null; practice_minutes?: number | null }>) {
    if (!row.activity_date) continue;
    const activityDate = new Date(row.activity_date);
    if (activityDate < priorWeekStart) continue;
    const minutes = safeNumber(row.practice_minutes) ?? 0;
    if (activityDate >= weekStart) {
      activityMinutesCurrent += Math.max(0, minutes);
    } else {
      activityMinutesPrior += Math.max(0, minutes);
    }
  }

  const weeklyTimeMinutesCurrent =
    activityMinutesCurrent > 0 ? activityMinutesCurrent : Math.round(eventTimeSecondsCurrent / 60);
  const weeklyTimeMinutesPrior =
    activityMinutesPrior > 0 ? activityMinutesPrior : Math.round(eventTimeSecondsPrior / 60);
  const hasPriorTimeSamples = activityMinutesPrior > 0 || eventTimeSecondsPrior > 0;
  const weeklyTimeMinutesDelta = hasPriorTimeSamples ? weeklyTimeMinutesCurrent - weeklyTimeMinutesPrior : null;

  const progressRows = (progressResult.data ?? []) as Array<{
    mastery_pct?: number | null;
    lessons?: { module_id?: number | null; modules?: { id?: number | null; title?: string | null } | null } | null;
  }>;

  const moduleAgg = new Map<number, { total: number; count: number; title: string | null }>();
  for (const row of progressRows) {
    const mastery = safeNumber(row.mastery_pct);
    const moduleId =
      (row.lessons?.modules?.id as number | null | undefined) ??
      (row.lessons?.module_id as number | null | undefined) ??
      null;
    if (moduleId == null || mastery == null) continue;
    const entry = moduleAgg.get(moduleId) ?? { total: 0, count: 0, title: (row.lessons?.modules?.title as string | null | undefined) ?? null };
    entry.total += mastery;
    entry.count += 1;
    if (!entry.title && row.lessons?.modules?.title) {
      entry.title = row.lessons.modules.title as string;
    }
    moduleAgg.set(moduleId, entry);
  }

  const modulesMastered = Array.from(moduleAgg.entries())
    .map(([moduleId, value]) => ({
      moduleId,
      title: value.title ?? null,
      mastery: value.count > 0 ? Math.round((value.total / value.count) * 100) / 100 : 0,
    }))
    .filter((entry) => entry.mastery >= MODULE_MASTERY_THRESHOLD);

  const averageAccuracy = (samples: number[]) =>
    samples.length > 0
      ? Math.round(((samples.reduce((sum, value) => sum + value, 0) / samples.length) * 1000)) / 10
      : null;

  const avgAccuracyCurrentWeek = averageAccuracy(accuracySamplesCurrent);
  const avgAccuracyPriorWeek = averageAccuracy(accuracySamplesPrior);
  const avgAccuracyDelta =
    avgAccuracyCurrentWeek != null && avgAccuracyPriorWeek != null
      ? Math.round((avgAccuracyCurrentWeek - avgAccuracyPriorWeek) * 10) / 10
      : null;
  const accuracySamplesAll = [...accuracySamplesCurrent, ...accuracySamplesPrior];
  const avgAccuracy = avgAccuracyCurrentWeek ?? averageAccuracy(accuracySamplesAll);

  const focusStandards = Array.from(standardAccuracy.entries())
    .map(([code, stats]) => ({
      code,
      accuracy: stats.total > 0 ? Math.round(((stats.correct / stats.total) * 1000)) / 10 : 0,
      samples: stats.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  const struggle =
    consecutiveMisses >= struggleThreshold ||
    (avgAccuracy != null && avgAccuracy < 60) ||
    (focusStandards.length > 0 && focusStandards[0].accuracy < 60);

  return {
    avgAccuracy,
    avgAccuracyPriorWeek,
    avgAccuracyDelta,
    weeklyTimeMinutes: Math.max(0, weeklyTimeMinutesCurrent),
    weeklyTimeMinutesPriorWeek: Math.max(0, weeklyTimeMinutesPrior),
    weeklyTimeMinutesDelta,
    lessonsCompleted,
    modulesMastered,
    focusStandards,
    latestQuizScore,
    latestQuizAt,
    struggle,
  };
};

export const getStudentStats = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<{
  xpTotal: number;
  streakDays: number;
  badges: number;
  badgeDetails: Array<{ id: number; slug: string | null; name: string | null; earnedAt: string | null; icon: string | null; rarity: string | null }>;
  recentEvents: Array<{ event_type: string; points_awarded: number; created_at: string }>;
  masteryAvg: number | null;
  pathProgress: { completed: number; remaining: number; percent: number | null };
  avgAccuracy: number | null;
  avgAccuracyPriorWeek: number | null;
  avgAccuracyDelta: number | null;
  weeklyTimeMinutes: number;
  weeklyTimeMinutesPriorWeek: number;
  weeklyTimeMinutesDelta: number | null;
  modulesMastered: { count: number; items: Array<{ moduleId: number; title: string | null; mastery: number }> };
  focusStandards: Array<{ code: string; accuracy: number; samples: number }>;
  latestQuizScore: number | null;
  struggle: boolean;
}> => {
  const [xpRow, events, mastery, path, insights, badges] = await Promise.all([
    supabase.from('xp_ledger').select('xp_total, streak_days, badge_ids').eq('student_id', studentId).maybeSingle(),
    supabase
      .from('student_events')
      .select('event_type, points_awarded, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('student_mastery')
      .select('mastery_pct')
      .eq('student_id', studentId)
      .limit(100),
    getStudentPath(supabase, studentId),
    computeStudentInsights(supabase, studentId),
    supabase
      .from('student_badges')
      .select('badge_id, earned_at, badge_definitions ( id, slug, name, icon, rarity )')
      .eq('student_id', studentId)
      .order('earned_at', { ascending: false }),
  ]);

  if (xpRow.error) {
    throw new Error(`Unable to read XP: ${xpRow.error.message}`);
  }
  if (events.error) {
    throw new Error(`Unable to read recent events: ${events.error.message}`);
  }
  if (mastery.error) {
    throw new Error(`Unable to read mastery: ${mastery.error.message}`);
  }
  if (badges.error) {
    throw new Error(`Unable to read earned badges: ${badges.error.message}`);
  }

  const masteryValues = ((mastery.data ?? []) as Array<{ mastery_pct?: number | null }>).map((row) =>
    row.mastery_pct ?? 0,
  );
  const masteryAvg =
    masteryValues.length > 0
      ? Math.round((masteryValues.reduce((sum, value) => sum + value, 0) / masteryValues.length) * 100) / 100
      : null;

  const completed = path?.entries.filter((entry) => entry.status === 'completed').length ?? 0;
  const remaining = (path?.entries.length ?? 0) - completed;
  const pathPercent = (path?.entries.length ?? 0) > 0
    ? Math.round(((completed / (path?.entries.length ?? 0)) * 1000)) / 10
    : null;

  const badgeDetails =
    (badges.data as Array<{ badge_id?: number | null; earned_at?: string | null; badge_definitions?: Record<string, unknown> | null }> | null)?.map((row) => ({
      id: (row.badge_id as number | null | undefined) ?? 0,
      slug: (row.badge_definitions?.slug as string | null | undefined) ?? null,
      name: (row.badge_definitions?.name as string | null | undefined) ?? null,
      earnedAt: (row.earned_at as string | null | undefined) ?? null,
      icon: (row.badge_definitions?.icon as string | null | undefined) ?? null,
      rarity: (row.badge_definitions?.rarity as string | null | undefined) ?? null,
    })) ?? [];

  return {
    xpTotal: (xpRow.data?.xp_total as number | null | undefined) ?? 0,
    streakDays: (xpRow.data?.streak_days as number | null | undefined) ?? 0,
    badges: Array.isArray(xpRow.data?.badge_ids)
      ? (xpRow.data?.badge_ids as unknown[]).length
      : badgeDetails.length,
    badgeDetails,
    recentEvents: (events.data as Array<{ event_type: string; points_awarded: number; created_at: string }> | null) ?? [],
    masteryAvg,
    pathProgress: { completed, remaining: Math.max(remaining, 0), percent: pathPercent },
    avgAccuracy: insights.avgAccuracy,
    weeklyTimeMinutes: insights.weeklyTimeMinutes,
    avgAccuracyPriorWeek: insights.avgAccuracyPriorWeek,
    avgAccuracyDelta: insights.avgAccuracyDelta,
    weeklyTimeMinutesPriorWeek: insights.weeklyTimeMinutesPriorWeek,
    weeklyTimeMinutesDelta: insights.weeklyTimeMinutesDelta,
    modulesMastered: { count: insights.modulesMastered.length, items: insights.modulesMastered },
    focusStandards: insights.focusStandards,
    latestQuizScore: insights.latestQuizScore,
    struggle: insights.struggle,
  };
};

export const getParentOverview = async (
  supabase: SupabaseClient,
  parentId: string,
): Promise<{
  children: Array<{
    id: string;
    name: string;
    grade_band: string | null;
    xp_total: number;
    streak_days: number;
    recent_events: Array<{ event_type: string; created_at: string }>;
    progress_pct: number | null;
    latest_quiz_score: number | null;
    weekly_time_minutes: number;
    alerts: string[];
    struggle: boolean;
  }>;
}> => {
  const { data: directChildren, error: directError } = await supabase
    .from('student_profiles')
    .select('id, first_name, last_name, grade_band')
    .eq('parent_id', parentId);

  if (directError) {
    throw new Error(`Unable to read linked students: ${directError.message}`);
  }

  const { data: guardianLinks, error: guardianError } = await supabase
    .from('guardian_child_links')
    .select('student_id')
    .eq('parent_id', parentId)
    .eq('status', 'active');

  if (guardianError) {
    throw new Error(`Unable to read guardian links: ${guardianError.message}`);
  }

  const studentIds = Array.from(
    new Set([
      ...(directChildren ?? []).map((row) => row.id as string),
      ...(guardianLinks ?? []).map((row) => row.student_id as string),
    ]),
  );

  if (studentIds.length === 0) {
    return { children: [] };
  }

  const [xpRows, recentEvents, insights] = await Promise.all([
    supabase.from('xp_ledger').select('student_id, xp_total, streak_days').in('student_id', studentIds),
    supabase
      .from('student_events')
      .select('student_id, event_type, created_at')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })
      .limit(studentIds.length * 3),
    Promise.all(
      studentIds.map(async (id) => {
        const [insight, path] = await Promise.all([
          computeStudentInsights(supabase, id).catch((error) => {
            console.warn('[parent overview] failed to compute insights for child', { id, error });
            return null;
          }),
          getStudentPath(supabase, id).catch((error) => {
            console.warn('[parent overview] failed to load path for child', { id, error });
            return null;
          }),
        ]);
        return {
          studentId: id,
          insight,
          path,
        };
      }),
    ),
  ]);

  if (xpRows.error) {
    throw new Error(`Unable to read child XP: ${xpRows.error.message}`);
  }
  if (recentEvents.error) {
    throw new Error(`Unable to read child events: ${recentEvents.error.message}`);
  }

  const xpMap = new Map<string, { xp_total: number; streak_days: number }>();
  for (const row of xpRows.data ?? []) {
    xpMap.set(row.student_id as string, {
      xp_total: (row.xp_total as number | null | undefined) ?? 0,
      streak_days: (row.streak_days as number | null | undefined) ?? 0,
    });
  }

  const eventMap = new Map<string, Array<{ event_type: string; created_at: string }>>();
  for (const row of recentEvents.data ?? []) {
    const studentId = row.student_id as string;
    if (!eventMap.has(studentId)) {
      eventMap.set(studentId, []);
    }
    if ((eventMap.get(studentId) ?? []).length < 3) {
      eventMap.get(studentId)?.push({
        event_type: row.event_type as string,
        created_at: row.created_at as string,
      });
    }
  }

  const insightMap = new Map<
    string,
    {
      insight: StudentInsightSnapshot | null;
      path: { path: PathSummary; entries: PathEntry[] } | null;
    }
  >();
  insights.forEach((entry) => {
    insightMap.set(entry.studentId, { insight: entry.insight, path: entry.path });
  });

  const children = studentIds.map((id) => {
    const profile = (directChildren ?? []).find((row) => row.id === id);
    const xp = xpMap.get(id) ?? { xp_total: 0, streak_days: 0 };
    const insight = insightMap.get(id);
    const pathEntries = insight?.path?.entries ?? [];
    const completedEntries = pathEntries.filter((entry) => entry.status === 'completed').length;
    const progressPct = pathEntries.length > 0 ? Math.round(((completedEntries / pathEntries.length) * 1000)) / 10 : null;
    const alerts: string[] = [];
    if (insight?.insight.struggle) {
      alerts.push('Struggle flag: consecutive misses detected. Encourage a guided review.');
    }
    return {
      id,
      name: `${profile?.first_name ?? 'Learner'}${profile?.last_name ? ` ${profile.last_name}` : ''}`.trim(),
      grade_band: (profile?.grade_band as string | null | undefined) ?? null,
      xp_total: xp.xp_total,
      streak_days: xp.streak_days,
      recent_events: eventMap.get(id) ?? [],
      progress_pct: progressPct,
      latest_quiz_score: insight?.insight.latestQuizScore ?? null,
      weekly_time_minutes: insight?.insight.weeklyTimeMinutes ?? 0,
      alerts,
      struggle: insight?.insight.struggle ?? false,
    };
  });

  return { children };
};
