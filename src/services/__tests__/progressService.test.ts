import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchLessonProgress, startLessonSession } from '../progressService';

vi.mock('../../lib/supabaseClient', async () => {
  const { createSupabaseClientMock } = await import('../../test/supabaseMock');
  return { __esModule: true, default: createSupabaseClientMock() };
});

import supabaseMock from '../../lib/supabaseClient';

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.setResponses({});
});

describe('fetchLessonProgress', () => {
  it('returns defaults when progress rows are missing', async () => {
    supabaseMock.setResponses({
      student_progress: { maybeSingle: async () => ({ data: null, error: null }) },
      practice_sessions: { maybeSingle: async () => ({ data: null, error: null }) },
    });

    const snapshot = await fetchLessonProgress({ studentId: 's-1', lessonId: 42 });

    expect(snapshot.status).toBe('not_started');
    expect(snapshot.masteryPct).toBe(0);
    expect(snapshot.completedItems).toEqual([]);
    expect(snapshot.session).toBeNull();
  });

  it('normalizes session metadata and surfaces the latest event order', async () => {
    supabaseMock.setResponses({
      student_progress: {
        maybeSingle: async () => ({
          data: {
            status: 'in_progress',
            mastery_pct: 72,
            attempts: 3,
            last_activity_at: '2024-01-01T00:00:00.000Z',
          },
          error: null,
        }),
      },
      practice_sessions: {
        maybeSingle: async () => ({
          data: {
            id: 99,
            started_at: '2024-01-01T00:00:00.000Z',
            ended_at: null,
            metadata: { completed_items: ['intro', 123, 'wrap'] },
          },
          error: null,
        }),
      },
      practice_events: {
        maybeSingle: async () => ({ data: { event_order: 5 }, error: null }),
      },
    });

    const snapshot = await fetchLessonProgress({ studentId: 's-1', lessonId: 42 });

    expect(snapshot.masteryPct).toBe(72);
    expect(snapshot.completedItems).toEqual(['intro', 'wrap']);
    expect(snapshot.session?.lastEventOrder).toBe(5);
  });
});

describe('startLessonSession', () => {
  it('increments attempts and returns the inserted session metadata', async () => {
    supabaseMock.setResponses({
      practice_sessions: {
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: { id: 321, started_at: '2024-02-01T00:00:00.000Z' },
              error: null,
            }),
          }),
        }),
      },
      student_progress: {
        upsert: async () => ({ data: null, error: null }),
      },
    });

    const result = await startLessonSession({
      studentId: 's-1',
      lessonId: 77,
      moduleId: 12,
      moduleTitle: 'Practice Module',
      lessonTitle: 'Lesson 1',
      subject: 'math',
      initialCompletedItems: ['warmup'],
      baselineAttempts: 1,
    });

    expect(result.sessionId).toBe(321);
    expect(result.attempts).toBe(2);
  });
});
