import type {
  CatalogFilters,
  CatalogModule,
  ModuleAsset,
  ModuleDetail,
  ModuleLesson,
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
  };
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
