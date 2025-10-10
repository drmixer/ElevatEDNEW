import { useCallback, useEffect, useMemo, useState } from 'react';

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

export const useLessonProgress = (lessonId: number | null, itemIds: string[]) => {
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (lessonId == null) {
      setCompletedItems(new Set());
      return;
    }

    const storage = readStorage();
    const entry = storage[String(lessonId)];
    if (!entry) {
      setCompletedItems(new Set());
      return;
    }

    const validItems = new Set(itemIds);
    const restored = entry.completed.filter((item) => validItems.has(item));
    setCompletedItems(new Set(restored));
  }, [lessonId, itemIds.join('|')]);

  useEffect(() => {
    if (lessonId == null) {
      return;
    }

    const storage = readStorage();
    storage[String(lessonId)] = {
      completed: Array.from(completedItems),
      updatedAt: new Date().toISOString(),
    };
    writeStorage(storage);
  }, [lessonId, completedItems]);

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
        return next;
      });
    },
    [itemIds],
  );

  const markComplete = useCallback(() => {
    setCompletedItems(new Set(itemIds));
  }, [itemIds]);

  const reset = useCallback(() => {
    setCompletedItems(new Set());
  }, []);

  const completedCount = completedItems.size;
  const totalCount = itemIds.length;

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

  return {
    completedItems,
    completedCount,
    totalCount,
    progress,
    toggleItem,
    markComplete,
    reset,
    isComplete,
  };
};

export type LessonProgressController = ReturnType<typeof useLessonProgress>;
