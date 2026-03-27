import type { SupabaseClient } from '@supabase/supabase-js';

export type PublicLessonRow = {
  id: number;
  module_id: number;
  slug: string;
  title: string;
  metadata: Record<string, unknown> | null;
};

export const loadPublicLessonsByModuleIds = async (
  supabase: SupabaseClient,
  moduleIds: number[],
): Promise<Map<number, PublicLessonRow[]>> => {
  const uniqueModuleIds = Array.from(new Set(moduleIds)).filter((id) => Number.isInteger(id));
  const lessonsByModule = new Map<number, PublicLessonRow[]>();

  if (uniqueModuleIds.length === 0) {
    return lessonsByModule;
  }

  const { data, error } = await supabase
    .from('lessons')
    .select('id, module_id, slug, title, metadata')
    .in('module_id', uniqueModuleIds)
    .eq('visibility', 'public');

  if (error) {
    throw new Error(`Failed to load public lessons for modules: ${error.message}`);
  }

  for (const row of (data ?? []) as PublicLessonRow[]) {
    const existing = lessonsByModule.get(row.module_id);
    if (existing) {
      existing.push(row);
    } else {
      lessonsByModule.set(row.module_id, [row]);
    }
  }

  return lessonsByModule;
};

export const summarizePublicLessons = (lessons: PublicLessonRow[] | undefined): string =>
  (lessons ?? [])
    .map((lesson) => {
      const metadata = (lesson.metadata ?? {}) as Record<string, unknown>;
      const managedBy =
        typeof metadata.managed_by === 'string'
          ? metadata.managed_by
          : typeof metadata.seeded_by === 'string'
            ? metadata.seeded_by
            : 'unmanaged';
      return `${lesson.id}:${lesson.slug}:${managedBy}`;
    })
    .join(', ');
