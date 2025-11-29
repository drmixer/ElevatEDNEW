import type { DashboardActivity } from '../types';

// @ts-expect-error bundler provides JSON typing
import rawActivities from '../../data/curriculum/activity_assets_phase14.json';

type RawActivityEntry = {
  source: string;
  url: string;
  title?: string;
  description?: string;
  kind?: string;
  tags?: string[];
  lessonSlug?: string;
  license?: string;
  metadata?: Record<string, unknown>;
};

const activityMap: Map<string, RawActivityEntry[]> = new Map();
const rawMap = (rawActivities as Record<string, RawActivityEntry[]>) ?? {};

Object.entries(rawMap).forEach(([moduleSlug, entries]) => {
  if (Array.isArray(entries)) {
    activityMap.set(moduleSlug, entries);
  }
});

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item : null))
    .filter((item): item is string => Boolean(item));
};

const toDashboardActivity = (moduleSlug: string, entry: RawActivityEntry): DashboardActivity => {
  const metadata = entry.metadata ?? {};
  const activityType =
    typeof metadata.activity_type === 'string' ? (metadata.activity_type as string) : undefined;
  const estimatedMinutes =
    typeof metadata.estimated_time_minutes === 'number'
      ? (metadata.estimated_time_minutes as number)
      : null;
  const difficulty =
    typeof metadata.difficulty === 'number' ? (metadata.difficulty as number) : null;

  const skills = parseStringArray((metadata as Record<string, unknown>).skills);
  const standards = parseStringArray((metadata as Record<string, unknown>).standards);

  const id =
    (metadata as Record<string, unknown>).activity_id?.toString() ??
    (metadata as Record<string, unknown>).project_slug?.toString() ??
    entry.url ??
    `${moduleSlug}-${entry.title ?? 'activity'}`;

  return {
    id,
    moduleSlug,
    lessonSlug: entry.lessonSlug ?? null,
    title: entry.title ?? 'Activity',
    description: entry.description ?? null,
    kind: entry.kind ?? 'activity',
    activityType,
    estimatedMinutes,
    difficulty,
    skills,
    standards,
    homeExtension: (metadata as Record<string, unknown>).home_extension === true,
    url: entry.url ?? null,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
  };
};

export const getActivitiesForModule = (moduleSlug: string): DashboardActivity[] => {
  const entries = activityMap.get(moduleSlug);
  if (!entries || entries.length === 0) return [];
  return entries.map((entry) => toDashboardActivity(moduleSlug, entry));
};

export const getHomeExtensionActivities = (moduleSlug: string): DashboardActivity[] =>
  getActivitiesForModule(moduleSlug).filter((activity) => activity.homeExtension);

export const activityModuleSlugs: Set<string> = new Set(activityMap.keys());
