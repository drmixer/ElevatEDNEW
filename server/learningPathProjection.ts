type RawProfileLearningPathItem = {
  id?: unknown;
  subject?: unknown;
  topic?: unknown;
  concept?: unknown;
  difficulty?: unknown;
  status?: unknown;
  xpReward?: unknown;
  moduleSlug?: unknown;
  strand?: unknown;
  standardCodes?: unknown;
  pathSource?: unknown;
  accessibilityLevel?: unknown;
  themeGrade?: unknown;
};

export type ProfileLearningPathItem = {
  id: string;
  subject: string;
  topic: string;
  concept: string;
  difficulty: number;
  status: string;
  xpReward: number;
  moduleSlug?: string;
  strand?: string;
  standardCodes?: string[];
  pathSource?: string;
  accessibilityLevel?: number;
  themeGrade?: number;
};

export type ProjectedPathEntry = {
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

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const asStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
};

export const parseProfileLearningPath = (value: unknown): ProfileLearningPathItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = (entry ?? {}) as RawProfileLearningPathItem;
      const id = asString(row.id);
      const subject = asString(row.subject);
      const topic = asString(row.topic);
      if (!id || !subject || !topic) return null;
      return {
        id,
        subject,
        topic,
        concept: asString(row.concept) ?? 'adaptive_path',
        difficulty: asNumber(row.difficulty) ?? 15,
        status: asString(row.status) ?? 'not_started',
        xpReward: asNumber(row.xpReward) ?? 60,
        moduleSlug: asString(row.moduleSlug) ?? undefined,
        strand: asString(row.strand) ?? undefined,
        standardCodes: asStringList(row.standardCodes),
        pathSource: asString(row.pathSource) ?? undefined,
        accessibilityLevel: asNumber(row.accessibilityLevel) ?? undefined,
        themeGrade: asNumber(row.themeGrade) ?? undefined,
      } satisfies ProfileLearningPathItem;
    })
    .filter((entry): entry is ProfileLearningPathItem => Boolean(entry));
};

export const projectProfileLearningPathEntries = (
  items: ProfileLearningPathItem[],
  options: {
    pathId: number;
    createdAt: string;
    updatedAt: string;
  },
): ProjectedPathEntry[] =>
  items.map((item, index) => {
    const lessonId = /^\d+$/.test(item.id) ? Number.parseInt(item.id, 10) : null;
    const normalizedStatus = item.status === 'mastered' ? 'completed' : item.status;
    return {
      id: -(index + 1),
      path_id: options.pathId,
      position: index + 1,
      type: 'lesson',
      module_id: null,
      lesson_id: lessonId,
      assessment_id: null,
      status: normalizedStatus,
      score: null,
      time_spent_s: null,
      target_standard_codes: item.standardCodes ?? [],
      metadata: {
        module_title: item.topic,
        module_slug: item.moduleSlug ?? item.id,
        reason: item.pathSource ?? item.concept,
        subject: item.subject,
        strand: item.strand ?? null,
        accessibility_level: item.accessibilityLevel ?? null,
        theme_grade: item.themeGrade ?? null,
        source: 'student_profile_learning_path',
      },
      created_at: options.createdAt,
      updated_at: options.updatedAt,
    } satisfies ProjectedPathEntry;
  });
