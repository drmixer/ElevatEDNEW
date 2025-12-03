import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  fetchPreferences,
  fetchStudentPath,
  listTutorPersonas,
  type StudentPath,
  type StudentPreferences,
  type TutorPersona,
} from '../services/onboardingService';
import {
  fetchParentOverview,
  fetchStudentStats,
  type ParentOverview,
  type StudentStats,
} from '../services/statsService';
import { sendStudentEvent, type StudentEventInput, type StudentEventResponse } from '../services/studentEventService';

const DEFAULT_PALETTE = { background: '#EEF2FF', accent: '#6366F1', text: '#1F2937' };

const parsePalette = (metadata?: Record<string, unknown> | null) => {
  const palette = (metadata?.palette as { background?: string; accent?: string; text?: string } | undefined) ?? undefined;
  return {
    background: palette?.background ?? DEFAULT_PALETTE.background,
    accent: palette?.accent ?? DEFAULT_PALETTE.accent,
    text: palette?.text ?? DEFAULT_PALETTE.text,
  };
};

export const studentPathQueryKey = (studentId?: string | null) => ['student-path', studentId ?? 'unknown'];
export const studentStatsQueryKey = (studentId?: string | null) => ['student-stats', studentId ?? 'unknown'];
export const xpSummaryQueryKey = (studentId?: string | null) => ['xp-summary', studentId ?? 'unknown'];
export const tutorPersonaQueryKey = (studentId?: string | null) => ['tutor-persona', studentId ?? 'unknown'];
export const parentOverviewQueryKey = (parentId?: string | null) => ['parent-overview', parentId ?? 'unknown'];
export const studentDashboardQueryKey = (studentId?: string | null) => ['student-dashboard', studentId ?? 'unknown'];

export type AdaptiveFlash = {
  eventType: string;
  createdAt: number;
  targetDifficulty?: number | null;
  misconceptions?: string[];
  nextReason?: string | null;
  nextTitle?: string | null;
  primaryStandard?: string | null;
};

const adaptiveFlashKey = (studentId?: string | null) => (studentId ? `adaptive-flash:${studentId}` : null);

const safeStandard = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === 'string' && entry.trim().length);
    return (first as string | undefined)?.trim() ?? null;
  }
  return null;
};

const persistAdaptiveFlash = (
  studentId: string | null | undefined,
  response: StudentEventResponse,
  event?: StudentEventInput,
) => {
  if (typeof window === 'undefined' || !studentId) return;
  const key = adaptiveFlashKey(studentId);
  if (!key) return;

  const adaptive = response.adaptive;
  const next = response.next;
  if (!adaptive && !next) return;

  const attempts = Array.isArray(adaptive?.recentAttempts) ? adaptive?.recentAttempts : [];
  const primaryAttempt = attempts[0] as Record<string, unknown> | undefined;
  const attemptStandard = primaryAttempt
    ? safeStandard(
        (primaryAttempt.standards as unknown) ??
          (primaryAttempt.standard_codes as unknown) ??
          (primaryAttempt.standard as unknown),
      )
    : null;
  const payloadStandard = safeStandard(event?.payload?.standards);
  const nextStandard = safeStandard(
    (next?.target_standard_codes as unknown) ?? (next?.metadata as Record<string, unknown> | null | undefined)?.standard_code,
  );
  const misconception = safeStandard(adaptive?.misconceptions);
  const primaryStandard = attemptStandard ?? payloadStandard ?? misconception ?? nextStandard;
  const nextMetadata = (next?.metadata ?? {}) as Record<string, unknown>;

  const flash: AdaptiveFlash = {
    eventType: event?.eventType ?? 'path_updated',
    createdAt: Date.now(),
    targetDifficulty: adaptive?.targetDifficulty ?? null,
    misconceptions: Array.isArray(adaptive?.misconceptions)
      ? adaptive?.misconceptions.filter((code): code is string => typeof code === 'string')
      : [],
    nextReason: typeof nextMetadata.reason === 'string' ? nextMetadata.reason : null,
    nextTitle:
      (typeof nextMetadata.lesson_title === 'string' ? nextMetadata.lesson_title : null) ??
      (typeof nextMetadata.module_title === 'string' ? nextMetadata.module_title : null) ??
      null,
    primaryStandard,
  };

  try {
    window.sessionStorage.setItem(key, JSON.stringify(flash));
  } catch (storageError) {
    console.warn('[adaptive] Unable to persist adaptive flash', storageError);
  }
};

export const consumeAdaptiveFlash = (studentId?: string | null): AdaptiveFlash | null => {
  if (typeof window === 'undefined') return null;
  const key = adaptiveFlashKey(studentId);
  if (!key) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    window.sessionStorage.removeItem(key);
    const parsed = JSON.parse(raw) as AdaptiveFlash;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (error) {
    console.warn('[adaptive] Unable to read adaptive flash', error);
    return null;
  }
};

export const useStudentPath = (studentId?: string | null) => {
  const queryClient = useQueryClient();
  const query = useQuery<StudentPath>({
    queryKey: studentPathQueryKey(studentId),
    queryFn: fetchStudentPath,
    enabled: Boolean(studentId),
    staleTime: 60 * 1000,
  });

  const refresh = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: studentPathQueryKey(studentId) });
  }, [queryClient, studentId]);

  const upNext = useMemo(() => {
    const entries = query.data?.entries ?? [];
    const nextEntry = query.data?.next ?? null;
    if (nextEntry) {
      const deduped = entries.filter((entry) => entry.id !== nextEntry.id);
      return [nextEntry, ...deduped].slice(0, 3);
    }
    return entries.slice(0, 3);
  }, [query.data?.entries, query.data?.next]);

  return {
    ...query,
    path: query.data?.path ?? null,
    entries: query.data?.entries ?? [],
    next: query.data?.next ?? null,
    upNext,
    refresh,
  };
};

export const useStudentStats = (studentId?: string | null) =>
  useQuery<StudentStats>({
    queryKey: studentStatsQueryKey(studentId),
    queryFn: fetchStudentStats,
    enabled: Boolean(studentId),
    staleTime: 60 * 1000,
  });

export const useXP = (
  studentId?: string | null,
  initial?: { xp?: number | null; streakDays?: number | null; badges?: number | null },
) => {
  const queryClient = useQueryClient();
  const cachedSummary = queryClient.getQueryData<{ xp: number; streakDays: number; badges: number }>(
    xpSummaryQueryKey(studentId),
  );
  const statsQuery = useStudentStats(studentId);
  const xp = cachedSummary?.xp ?? statsQuery.data?.xpTotal ?? initial?.xp ?? 0;
  const streakDays = cachedSummary?.streakDays ?? statsQuery.data?.streakDays ?? initial?.streakDays ?? 0;
  const badges = cachedSummary?.badges ?? statsQuery.data?.badges ?? initial?.badges ?? 0;

  return {
    ...statsQuery,
    xp,
    streakDays,
    badges,
    stats: statsQuery.data ?? null,
  };
};

export const useTutorPersona = (studentId?: string | null) => {
  const query = useQuery<{
    preferences: StudentPreferences | null;
    personas: TutorPersona[];
    persona: TutorPersona | null;
  }>({
    queryKey: tutorPersonaQueryKey(studentId),
    queryFn: async () => {
      const [preferences, personas] = await Promise.all([fetchPreferences(), listTutorPersonas()]);
      const personaId = preferences?.tutor_persona_id ?? null;
      const persona = personaId ? personas.find((entry) => entry.id === personaId) ?? null : personas[0] ?? null;
      return { preferences, personas, persona };
    },
    enabled: Boolean(studentId),
    staleTime: 5 * 60 * 1000,
  });

  const palette = useMemo(() => parsePalette((query.data?.persona?.metadata ?? {}) as Record<string, unknown>), [query.data?.persona]);

  return {
    ...query,
    preferences: query.data?.preferences ?? null,
    personas: query.data?.personas ?? [],
    persona: query.data?.persona ?? null,
    palette,
  };
};

export const useParentOverview = (parentId?: string | null) =>
  useQuery<ParentOverview>({
    queryKey: parentOverviewQueryKey(parentId),
    queryFn: fetchParentOverview,
    enabled: Boolean(parentId),
    staleTime: 2 * 60 * 1000,
  });

export const applyStudentEventResponse = (
  queryClient: QueryClient,
  studentId: string | null | undefined,
  response: StudentEventResponse,
) => {
  if (response.path || response.next) {
    const nextPath: StudentPath = {
      path: response.path?.path ?? null,
      entries: response.path?.entries ?? [],
      next: response.next ?? null,
    };
    queryClient.setQueryData(studentPathQueryKey(studentId), nextPath);
  }

  if (response.stats) {
    queryClient.setQueryData(studentStatsQueryKey(studentId), response.stats);
    queryClient.setQueryData(xpSummaryQueryKey(studentId), {
      xp: response.stats.xpTotal,
      streakDays: response.stats.streakDays,
      badges: response.stats.badges,
    });
  }

  queryClient.invalidateQueries({ queryKey: studentDashboardQueryKey(studentId) }).catch(() => undefined);
};

export const useStudentEvent = (studentId?: string | null) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: StudentEventInput) => sendStudentEvent(input),
    onSuccess: (response, variables) => {
      applyStudentEventResponse(queryClient, studentId, response);
      persistAdaptiveFlash(studentId, response, variables);
    },
  });

  return {
    ...mutation,
    emitStudentEvent: mutation.mutateAsync,
  };
};
