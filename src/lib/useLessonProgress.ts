import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  completeLessonSession,
  fetchLessonProgress,
  startLessonSession,
  updateLessonProgress,
  type LessonProgressStatus,
} from '../services/progressService';

type LessonProgressEntry = {
  completed: string[];
  updatedAt: string;
};

const STORAGE_KEY = 'elevated.lesson-progress.v1';

const readStorage = (): Record<string, LessonProgressEntry> => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, LessonProgressEntry>;
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return {};
  } catch (error) {
    console.warn('Failed to read lesson progress from storage', error);
    return {};
  }
};

const writeStorage = (payload: Record<string, LessonProgressEntry>) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist lesson progress', error);
  }
};

type LessonProgressOptions = {
  studentId?: string | null;
  moduleId?: number | null;
  moduleTitle?: string | null;
  lessonTitle?: string | null;
  subject?: string | null;
};

type SessionState = {
  sessionId: number | null;
  startedAt: string | null;
  attempts: number;
  completed: boolean;
  eventOrder: number | null;
};

const defaultSessionState: SessionState = {
  sessionId: null,
  startedAt: null,
  attempts: 0,
  completed: false,
  eventOrder: null,
};

const computeStatus = (
  completedCount: number,
  totalCount: number,
): LessonProgressStatus => {
  if (totalCount === 0 || completedCount === 0) return 'not_started';
  if (completedCount >= totalCount) return 'completed';
  return 'in_progress';
};

export const useLessonProgress = (
  lessonId: number | null,
  itemIds: string[],
  options: LessonProgressOptions = {},
) => {
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<LessonProgressStatus>('not_started');
  const [initialised, setInitialised] = useState<boolean>(
    !(options.studentId && lessonId != null),
  );
  const [saving, setSaving] = useState(false);
  const [forceLocal, setForceLocal] = useState(false);
  const sessionRef = useRef<SessionState>({ ...defaultSessionState });

  const persistent = Boolean(options.studentId && lessonId != null && !forceLocal);
  const totalCount = itemIds.length;
  const itemKey = useMemo(() => itemIds.join('|'), [itemIds]);

  useEffect(() => {
    setForceLocal(false);
  }, [lessonId, options.studentId]);

  // Local fallback loading
  useEffect(() => {
    if (persistent) {
      return;
    }

    if (lessonId == null) {
      setCompletedItems(new Set());
      setStatus('not_started');
      return;
    }

    const storage = readStorage();
    const entry = storage[String(lessonId)];
    if (!entry) {
      setCompletedItems(new Set());
      setStatus('not_started');
      return;
    }

    const validItems = new Set(itemIds);
    const restored = entry.completed.filter((item) => validItems.has(item));
    const restoredSet = new Set(restored);
    setCompletedItems(restoredSet);
    setStatus(computeStatus(restoredSet.size, totalCount));
  }, [persistent, lessonId, itemKey, totalCount]);

  // Local persistence
  useEffect(() => {
    if (persistent || lessonId == null) {
      return;
    }

    const storage = readStorage();
    storage[String(lessonId)] = {
      completed: Array.from(completedItems),
      updatedAt: new Date().toISOString(),
    };
    writeStorage(storage);
  }, [persistent, lessonId, completedItems]);

  // Supabase-backed initialisation
  useEffect(() => {
    if (!persistent || lessonId == null || !options.studentId) {
      if (!persistent) {
        sessionRef.current = { ...defaultSessionState };
        setInitialised(true);
      }
      return;
    }

    let cancelled = false;

    const initialise = async () => {
      setInitialised(false);
      setSaving(true);
      try {
        const snapshot = await fetchLessonProgress({
          studentId: options.studentId,
          lessonId,
          moduleId: options.moduleId ?? null,
          moduleTitle: options.moduleTitle ?? null,
          lessonTitle: options.lessonTitle ?? null,
          subject: options.subject ?? null,
        });

        if (cancelled) return;

        const validItems = new Set(itemIds);
        const restored = snapshot.completedItems.filter((item) => validItems.has(item));
        const restoredSet = new Set(restored);
        setCompletedItems(restoredSet);

        const derivedStatus = computeStatus(restoredSet.size, totalCount);
        setStatus(snapshot.status ?? derivedStatus);

        const session = await startLessonSession({
          studentId: options.studentId,
          lessonId,
          moduleId: options.moduleId ?? null,
          moduleTitle: options.moduleTitle ?? null,
          lessonTitle: options.lessonTitle ?? null,
          subject: options.subject ?? null,
          initialCompletedItems: Array.from(restoredSet),
          baselineAttempts: snapshot.attempts ?? 0,
        });

        if (cancelled) return;

        sessionRef.current = {
          sessionId: session.sessionId,
          startedAt: session.startedAt,
          attempts: session.attempts,
          completed: snapshot.status === 'completed' || derivedStatus === 'completed',
          eventOrder: 1,
        };
      } catch (error) {
        if (!cancelled) {
          console.warn('[progress] falling back to local tracking', error);
          sessionRef.current = { ...defaultSessionState };
          setForceLocal(true);
        }
      } finally {
        if (!cancelled) {
          setInitialised(true);
          setSaving(false);
        }
      }
    };

    initialise();

    return () => {
      cancelled = true;
    };
  }, [persistent, lessonId, itemKey, totalCount, options.studentId, options.moduleId, options.moduleTitle, options.lessonTitle, options.subject, itemIds]);

  const persistProgress = useCallback(
    async (nextSet: Set<string>) => {
      if (!persistent || !lessonId || !options.studentId) {
        return;
      }
      const session = sessionRef.current;
      if (!session.sessionId) {
        return;
      }

      const completedList = Array.from(nextSet);
      const progressPct = totalCount
        ? Math.round((completedList.length / totalCount) * 100)
        : 0;
      const nextStatus = computeStatus(nextSet.size, totalCount);

      setSaving(true);
      try {
        await updateLessonProgress({
          studentId: options.studentId,
          lessonId,
          moduleId: options.moduleId ?? null,
          moduleTitle: options.moduleTitle ?? null,
          lessonTitle: options.lessonTitle ?? null,
          subject: options.subject ?? null,
          sessionId: session.sessionId,
          completedItems: completedList,
          progressPct,
          status: nextStatus,
          attempts: session.attempts,
        });

        if (nextStatus === 'completed' && !session.completed) {
          await completeLessonSession({
            studentId: options.studentId,
            lessonId,
            moduleId: options.moduleId ?? null,
            moduleTitle: options.moduleTitle ?? null,
            lessonTitle: options.lessonTitle ?? null,
            subject: options.subject ?? null,
            sessionId: session.sessionId,
            startedAt: session.startedAt ?? new Date().toISOString(),
            completedItems: completedList,
            progressPct,
            attempts: session.attempts,
          });
          sessionRef.current = { ...sessionRef.current, completed: true };
        } else if (nextStatus !== 'completed' && session.completed) {
          sessionRef.current = { ...sessionRef.current, completed: false };
        }

        setStatus(nextStatus);
      } catch (error) {
        console.warn('[progress] failed to persist lesson progress', error);
      } finally {
        setSaving(false);
      }
    },
    [persistent, lessonId, options.studentId, options.moduleId, options.moduleTitle, options.lessonTitle, options.subject, totalCount],
  );

  const toggleItem = useCallback(
    (itemId: string) => {
      if (!itemIds.includes(itemId)) {
        return;
      }

      setCompletedItems((previous) => {
        const next = new Set(previous);
        if (next.has(itemId)) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }

        if (persistent && initialised) {
          void persistProgress(next);
        }

        setStatus(computeStatus(next.size, totalCount));
        return next;
      });
    },
    [itemIds, persistent, initialised, persistProgress, totalCount],
  );

  const markComplete = useCallback(() => {
    const next = new Set(itemIds);
    setCompletedItems(next);
    setStatus(computeStatus(next.size, totalCount));
    if (persistent && initialised) {
      void persistProgress(next);
    }
  }, [itemIds, totalCount, persistent, initialised, persistProgress]);

  const reset = useCallback(() => {
    const next = new Set<string>();
    setCompletedItems(next);
    setStatus('not_started');
    if (persistent && initialised) {
      void persistProgress(next);
    }
  }, [persistent, initialised, persistProgress]);

  const completedCount = completedItems.size;

  const progress = useMemo(() => {
    if (totalCount === 0) {
      return 0;
    }
    return Math.round((completedCount / totalCount) * 100);
  }, [completedCount, totalCount]);

  const isComplete = useCallback(
    (itemId: string) => completedItems.has(itemId),
    [completedItems],
  );

  const allocateEventOrder = useCallback((): number | null => {
    if (!sessionRef.current.sessionId) {
      return null;
    }
    const nextOrder = (sessionRef.current.eventOrder ?? 1) + 1;
    sessionRef.current = { ...sessionRef.current, eventOrder: nextOrder };
    return nextOrder;
  }, []);

  return {
    completedItems,
    completedCount,
    totalCount,
    progress,
    status,
    sessionId: sessionRef.current.sessionId,
    attempts: sessionRef.current.attempts,
    isLoading: !initialised,
    isSaving: saving,
    toggleItem,
    markComplete,
    reset,
    isComplete,
    allocateEventOrder,
  };
};

export type LessonProgressController = ReturnType<typeof useLessonProgress>;
