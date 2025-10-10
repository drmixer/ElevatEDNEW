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

  const [lessonsResult, assetsResult] = await Promise.all([
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
  ]);

  if (lessonsResult.error) {
    throw new Error(`Failed to load lessons: ${lessonsResult.error.message}`);
  }
  if (assetsResult.error) {
    throw new Error(`Failed to load assets: ${assetsResult.error.message}`);
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

  return {
    module: moduleData as ModuleDetail['module'],
    lessons,
    moduleAssets,
  };
};
type LessonRow = {
  id: number;
  title: string;
  content: string;
  estimated_duration_minutes: number | null;
  attribution_block: string | null;
  open_track: boolean | null;
};
