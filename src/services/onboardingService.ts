import { authenticatedFetch, handleApiResponse } from '../lib/apiClient';

export type SubjectPlacementKey = 'math' | 'english';

export type PlacementOption = {
  id: number;
  text: string;
  isCorrect: boolean;
  feedback?: string | null;
};

export type PlacementItem = {
  id: string;
  bankQuestionId: number;
  prompt: string;
  type: string;
  options: PlacementOption[];
  weight: number;
  difficulty: number;
  strand: string | null;
  targetStandards: string[];
  metadata?: Record<string, unknown> | null;
};

export type PlacementStartResponse = {
  assessmentId: number;
  attemptId: number;
  attemptNumber: number;
  gradeBand: string;
  subject: string | null;
  expectedLevel: number | null;
  engineVersion?: string;
  resumeToken: string;
  items: PlacementItem[];
  existingResponses: Array<{ questionId: number; selectedOptionId: number | null; isCorrect: boolean | null }>;
};

export type PlacementResponseInput = {
  bankQuestionId: number;
  optionId: number | null;
  timeSpentSeconds?: number | null;
};

export type StudentPathEntry = {
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
};

export type StudentPath = {
  path: {
    id: number;
    subject?: string | null;
    status: string;
    started_at: string;
    updated_at: string;
    metadata: Record<string, unknown> | null;
  } | null;
  entries: StudentPathEntry[];
  next: StudentPathEntry | null;
};

type StudentPathApiResponse = {
  path: { path: StudentPath['path']; entries: StudentPathEntry[] } | null;
  next: StudentPathEntry | null;
};

export type StudentSubjectState = {
  id: number;
  student_id: string;
  subject: string;
  expected_level: number;
  working_level: number | null;
  level_confidence: number;
  placement_status: string;
  diagnostic_assessment_id: number | null;
  diagnostic_attempt_id: number | null;
  diagnostic_completed_at: string | null;
  strand_scores: Record<string, unknown>;
  weak_standard_codes: string[];
  recommended_module_slugs: string[];
  last_path_id: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type StudentSubjectPath = {
  subject: string | null;
  state: StudentSubjectState | null;
  path: { path: StudentPath['path']; entries: StudentPathEntry[] } | null;
};

export type StudentPreferences = {
  student_id: string;
  avatar_id: string | null;
  tutor_persona_id: string | null;
  opt_in_ai: boolean;
  goal_focus: string | null;
  theme: string | null;
};

export type CatalogAvatar = {
  id: string;
  name: string;
  image_url: string | null;
  category: string;
  is_default: boolean;
  metadata: Record<string, unknown> | null;
};

export type TutorPersona = {
  id: string;
  name: string;
  tone: string | null;
  constraints: string | null;
  prompt_snippet: string | null;
  sample_replies?: string[] | null;
  metadata: Record<string, unknown> | null;
};

export const startPlacement = async (payload: {
  subject?: SubjectPlacementKey | null;
  ageYears?: number | null;
  gradeLevel?: number | null;
  gradeBand?: string | null;
  fullName?: string | null;
  optInAi?: boolean;
  avatarId?: string | null;
  tutorPersonaId?: string | null;
}): Promise<PlacementStartResponse> => {
  const response = await authenticatedFetch('/api/v1/student/assessment/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleApiResponse<PlacementStartResponse>(response);
};

export const savePlacementProgress = async (payload: {
  assessmentId: number;
  attemptId: number;
  bankQuestionId: number;
  optionId: number | null;
  timeSpentSeconds?: number | null;
}): Promise<{ isCorrect: boolean; engineVersion?: string; nextItem?: PlacementItem | null; isComplete?: boolean }> => {
  const response = await authenticatedFetch('/api/v1/student/assessment/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleApiResponse<{ isCorrect: boolean; engineVersion?: string; nextItem?: PlacementItem | null; isComplete?: boolean }>(response);
};

export const submitPlacement = async (payload: {
  assessmentId: number;
  attemptId: number;
  responses: PlacementResponseInput[];
  subject?: SubjectPlacementKey | null;
  ageYears?: number | null;
  gradeLevel?: number | null;
  gradeBand?: string | null;
  goalFocus?: string | null;
  fullName?: string | null;
  optInAi?: boolean;
  avatarId?: string | null;
  tutorPersonaId?: string | null;
}): Promise<{
  pathId: number;
  entries: StudentPathEntry[];
  strandEstimates: Array<{ strand: string; correct: number; total: number; accuracyPct: number }>;
  score: number;
  masteryPct: number;
  subject: string | null;
  expectedLevel: number;
  workingLevel: number;
  levelConfidence: number;
  subjectState: StudentSubjectState | null;
}> => {
  const response = await authenticatedFetch('/api/v1/student/assessment/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleApiResponse<{
    pathId: number;
    entries: StudentPathEntry[];
    strandEstimates: Array<{ strand: string; correct: number; total: number; accuracyPct: number }>;
    score: number;
    masteryPct: number;
    subject: string | null;
    expectedLevel: number;
    workingLevel: number;
    levelConfidence: number;
    subjectState: StudentSubjectState | null;
  }>(response);
};

export const fetchStudentPath = async (): Promise<StudentPath> => {
  const response = await authenticatedFetch('/api/v1/student/path');
  const payload = await handleApiResponse<StudentPathApiResponse>(response);
  if (!payload.path) {
    return { path: null, entries: [], next: payload.next ?? null };
  }
  return {
    path: payload.path.path,
    entries: payload.path.entries ?? [],
    next: payload.next ?? null,
  };
};

export const fetchStudentPaths = async (): Promise<StudentSubjectPath[]> => {
  const response = await authenticatedFetch('/api/v1/student/paths');
  return handleApiResponse<{ paths: StudentSubjectPath[] }>(response).then((payload) => payload.paths ?? []);
};

export const fetchPreferences = async (): Promise<StudentPreferences> => {
  const response = await authenticatedFetch('/api/v1/student/preferences');
  return handleApiResponse<{ preferences: StudentPreferences }>(response).then((payload) => payload.preferences);
};

export const updatePreferences = async (payload: {
  avatarId?: string | null;
  tutorPersonaId?: string | null;
  optInAi?: boolean;
  goalFocus?: string | null;
  theme?: string | null;
}): Promise<StudentPreferences> => {
  const response = await authenticatedFetch('/api/v1/student/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleApiResponse<{ preferences: StudentPreferences }>(response).then((payload) => payload.preferences);
};

export const listAvatars = async (category?: string): Promise<CatalogAvatar[]> => {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  const response = await fetch(`/api/v1/avatars${query}`);
  return handleApiResponse<{ avatars: CatalogAvatar[] }>(response).then((payload) => payload.avatars);
};

export const listTutorPersonas = async (): Promise<TutorPersona[]> => {
  const response = await fetch('/api/v1/tutor_personas');
  return handleApiResponse<{ tutorPersonas: TutorPersona[] }>(response).then((payload) => payload.tutorPersonas);
};
