import type {
  CatalogFilters,
  CatalogModule,
  ModuleAsset,
  ModuleAssessmentDetail,
  ModuleAssessmentSection,
  ModuleAssessmentSummary,
  ModuleDetail,
  ModuleLesson,
  ModuleStandard,
  RecommendationItem,
} from '../types';

type ApiModule = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  grade_band: string;
  subject: string;
  strand: string | null;
  topic: string | null;
  open_track: boolean | null;
  suggested_source_category: string | null;
  example_source: string | null;
  description?: string | null;
  notes?: string | null;
  license_requirement?: string | null;
};

type ApiAsset = {
  id: number;
  lesson_id: number | null;
  title: string | null;
  description: string | null;
  url: string;
  kind: string;
  license: string;
  license_url: string | null;
  attribution_text: string | null;
  tags: string[] | null;
};

type ApiLesson = {
  id: number;
  title: string;
  content: string;
  estimated_duration_minutes: number | null;
  attribution_block: string | null;
  open_track: boolean | null;
  assets?: ApiAsset[];
};

type ApiModuleStandard = {
  id: number;
  framework: string;
  code: string;
  description: string | null;
  alignment_strength: string | null;
  notes: string | null;
};

type ApiModuleAssessmentSummary = {
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

type ApiAssessmentOption = {
  id: number;
  order: number;
  content: string;
  is_correct: boolean;
  feedback: string | null;
};

type ApiAssessmentQuestion = {
  id: number;
  prompt: string;
  type: string;
  difficulty: number | null;
  explanation: string | null;
  standards: string[] | null;
  tags: string[] | null;
  options: ApiAssessmentOption[];
};

type ApiAssessmentSection = {
  id: number;
  title: string;
  instructions: string | null;
  questions: ApiAssessmentQuestion[];
};

type ApiModuleAssessmentDetail = {
  id: number;
  title: string;
  description: string | null;
  estimated_duration_minutes: number | null;
  purpose: string | null;
  sections: ApiAssessmentSection[];
};

type ApiRecommendation = {
  id: number;
  slug: string;
  title: string;
  subject: string;
  strand: string | null;
  topic: string | null;
  grade_band: string;
  summary: string | null;
  open_track: boolean | null;
  reason: string;
  fallback: boolean;
};

type ModuleListResponse = { data: ApiModule[]; total: number };
type ModuleDetailResponse = {
  module: ApiModule & {
    description: string | null;
    notes: string | null;
    license_requirement: string | null;
  };
  lessons: ApiLesson[];
  moduleAssets: ApiAsset[];
  standards: ApiModuleStandard[];
  assessments: ApiModuleAssessmentSummary[];
};
type RecommendationsResponse = { recommendations: ApiRecommendation[] };

const mapModule = (item: ApiModule): CatalogModule => ({
  id: item.id,
  slug: item.slug,
  title: item.title,
  summary: item.summary ?? null,
  gradeBand: item.grade_band,
  subject: item.subject,
  strand: item.strand ?? null,
  topic: item.topic ?? null,
  openTrack: item.open_track ?? false,
  suggestedSourceCategory: item.suggested_source_category ?? null,
  exampleSource: item.example_source ?? null,
});

const mapAsset = (asset: ApiAsset): ModuleAsset => ({
  id: asset.id,
  lessonId: asset.lesson_id ?? null,
  title: asset.title ?? null,
  description: asset.description ?? null,
  url: asset.url,
  kind: asset.kind ?? 'link',
  license: asset.license,
  licenseUrl: asset.license_url ?? null,
  attributionText: asset.attribution_text ?? null,
  tags: asset.tags ?? [],
});

const mapLesson = (lesson: ApiLesson): ModuleLesson => ({
  id: lesson.id,
  title: lesson.title,
  content: lesson.content,
  estimatedDurationMinutes: lesson.estimated_duration_minutes ?? null,
  attributionBlock: lesson.attribution_block ?? '',
  openTrack: lesson.open_track ?? false,
  assets: Array.isArray(lesson.assets) ? lesson.assets.map(mapAsset) : [],
});

const mapStandard = (standard: ApiModuleStandard): ModuleStandard => ({
  id: standard.id,
  framework: standard.framework,
  code: standard.code,
  description: standard.description ?? null,
  alignmentStrength: standard.alignment_strength ?? null,
  notes: standard.notes ?? null,
});

const mapAssessmentSummary = (assessment: ApiModuleAssessmentSummary): ModuleAssessmentSummary => ({
  id: assessment.id,
  title: assessment.title,
  description: assessment.description ?? null,
  estimatedDurationMinutes: assessment.estimated_duration_minutes ?? null,
  questionCount: assessment.question_count ?? 0,
  attemptCount: assessment.attempt_count ?? 0,
  completionRate: assessment.completion_rate ?? 0,
  averageScore: assessment.average_score ?? null,
  purpose: assessment.purpose ?? null,
});

const mapAssessmentOption = (option: ApiAssessmentOption): ModuleAssessmentOption => ({
  id: option.id,
  order: option.order,
  content: option.content,
  isCorrect: option.is_correct,
  feedback: option.feedback ?? null,
});

const mapAssessmentQuestion = (question: ApiAssessmentQuestion): ModuleAssessmentQuestion => ({
  id: question.id,
  prompt: question.prompt,
  type: question.type,
  difficulty: question.difficulty ?? null,
  explanation: question.explanation ?? null,
  standards: Array.isArray(question.standards) ? question.standards : [],
  tags: Array.isArray(question.tags) ? question.tags : [],
  options: Array.isArray(question.options) ? question.options.map(mapAssessmentOption) : [],
});

const mapAssessmentSection = (section: ApiAssessmentSection): ModuleAssessmentSection => ({
  id: section.id,
  title: section.title,
  instructions: section.instructions ?? null,
  questions: Array.isArray(section.questions)
    ? section.questions.map(mapAssessmentQuestion)
    : [],
});

const mapAssessmentDetail = (payload: ApiModuleAssessmentDetail): ModuleAssessmentDetail => ({
  id: payload.id,
  title: payload.title,
  description: payload.description ?? null,
  estimatedDurationMinutes: payload.estimated_duration_minutes ?? null,
  purpose: payload.purpose ?? null,
  sections: Array.isArray(payload.sections)
    ? payload.sections.map(mapAssessmentSection)
    : [],
});

const mapRecommendation = (item: ApiRecommendation): RecommendationItem => ({
  id: item.id,
  slug: item.slug,
  title: item.title,
  subject: item.subject,
  strand: item.strand ?? null,
  topic: item.topic ?? null,
  gradeBand: item.grade_band,
  summary: item.summary ?? null,
  openTrack: item.open_track ?? false,
  reason: item.reason,
  fallback: Boolean(item.fallback),
});

const buildQueryString = (filters: CatalogFilters): string => {
  const params = new URLSearchParams();
  if (filters.subject) params.set('subject', filters.subject);
  if (filters.grade) params.set('grade', filters.grade);
  if (filters.strand) params.set('strand', filters.strand);
  if (filters.topic) params.set('topic', filters.topic);
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const query = params.toString();
  return query ? `?${query}` : '';
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
};

export const fetchCatalogModules = async (
  filters: CatalogFilters,
): Promise<{ data: CatalogModule[]; total: number }> => {
  const response = await fetch(`/api/modules${buildQueryString(filters)}`);
  const payload = await handleResponse<ModuleListResponse>(response);
  return {
    data: Array.isArray(payload.data) ? payload.data.map(mapModule) : [],
    total: payload.total ?? 0,
  };
};

export const fetchModuleDetail = async (moduleId: number): Promise<ModuleDetail> => {
  const response = await fetch(`/api/modules/${moduleId}`);
  const payload = await handleResponse<ModuleDetailResponse>(response);
  return {
    module: {
      id: payload.module.id,
      slug: payload.module.slug,
      title: payload.module.title,
      summary: payload.module.summary ?? null,
      description: payload.module.description ?? null,
      notes: payload.module.notes ?? null,
      gradeBand: payload.module.grade_band,
      subject: payload.module.subject,
      strand: payload.module.strand ?? null,
      topic: payload.module.topic ?? null,
      openTrack: payload.module.open_track ?? false,
      suggestedSourceCategory: payload.module.suggested_source_category ?? null,
      exampleSource: payload.module.example_source ?? null,
      licenseRequirement: payload.module.license_requirement ?? null,
    },
    lessons: Array.isArray(payload.lessons) ? payload.lessons.map(mapLesson) : [],
    moduleAssets: Array.isArray(payload.moduleAssets)
      ? payload.moduleAssets.map(mapAsset)
      : [],
    standards: Array.isArray(payload.standards) ? payload.standards.map(mapStandard) : [],
    assessments: Array.isArray(payload.assessments)
      ? payload.assessments.map(mapAssessmentSummary)
      : [],
  };
};

export const fetchModuleAssessment = async (
  moduleId: number,
): Promise<ModuleAssessmentDetail | null> => {
  const response = await fetch(`/api/modules/${moduleId}/assessment`);
  if (response.status === 404) {
    return null;
  }
  const payload = await handleResponse<ApiModuleAssessmentDetail>(response);
  return mapAssessmentDetail(payload);
};

export const fetchRecommendations = async (
  moduleId: number,
  lastScore?: number,
): Promise<RecommendationItem[]> => {
  const params = new URLSearchParams({ moduleId: String(moduleId) });
  if (typeof lastScore === 'number' && Number.isFinite(lastScore)) {
    params.set('lastScore', String(lastScore));
  }
  const response = await fetch(`/api/recommendations?${params.toString()}`);
  const payload = await handleResponse<RecommendationsResponse>(response);
  return Array.isArray(payload.recommendations)
    ? payload.recommendations.map(mapRecommendation)
    : [];
};

export const runImporter = async (
  provider: 'openstax' | 'gutenberg' | 'federal',
  mapping: Record<string, unknown>,
): Promise<{ inserted: number }> => {
  const response = await fetch(`/api/import/${provider}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mapping }),
  });
  const payload = await handleResponse<{ inserted: number }>(response);
  return {
    inserted: payload.inserted ?? 0,
  };
};
