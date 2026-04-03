import { createServer } from 'node:http';
import { type AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiHandler } from '../api.js';
import { createSupabaseClientMock } from '../../src/test/supabaseMock';

const requestSupabase = createSupabaseClientMock();
const serviceSupabase = createSupabaseClientMock();

const listModulesMock = vi.fn();
const getLessonDetailMock = vi.fn();
const getRecommendationsMock = vi.fn();
const recordLearningEventMock = vi.fn();
const applyAdaptiveEventMock = vi.fn();
const getStudentStatsMock = vi.fn();

vi.mock('../../scripts/utils/supabase.js', () => ({
  createRlsClient: vi.fn(() => requestSupabase),
  createServiceRoleClient: vi.fn(() => serviceSupabase),
}));

vi.mock('../modules.js', () => ({
  listModules: (...args: unknown[]) => listModulesMock(...args),
  getLessonDetail: (...args: unknown[]) => getLessonDetailMock(...args),
  getModuleAssessment: vi.fn(),
}));

vi.mock('../recommendations.js', () => ({
  getRecommendations: (...args: unknown[]) => getRecommendationsMock(...args),
}));

vi.mock('../notifications.js', () => ({
  notifyAssignmentCreated: vi.fn(),
}));

vi.mock('../auth.js', () => ({
  extractBearerToken: (req: { headers: Record<string, string | string[] | undefined> }) => {
    const header = req.headers.authorization;
    if (!header) return null;
    const value = Array.isArray(header) ? header[0] : header;
    return value?.split(' ')[1] ?? null;
  },
  resolveUserFromToken: vi.fn(async (_client, token: string | null) =>
    token === 'student-token'
      ? { id: 'student-1', role: 'student', email: 'student@example.com', name: 'Sam Student' }
      : token === 'parent-token'
      ? { id: 'parent-1', role: 'parent', email: 'parent@example.com', name: 'Pat Parent' }
      : null,
  ),
  resolveAdminFromToken: vi.fn(),
}));

vi.mock('../xpService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../xpService.js')>();
  return {
    ...actual,
    recordLearningEvent: (...args: Parameters<typeof actual.recordLearningEvent>) =>
      recordLearningEventMock(...args),
  };
});

vi.mock('../learningPaths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../learningPaths.js')>();
  return {
    ...actual,
    applyAdaptiveEvent: (...args: Parameters<typeof actual.applyAdaptiveEvent>) =>
      applyAdaptiveEventMock(...args),
    getStudentStats: (...args: Parameters<typeof actual.getStudentStats>) =>
      getStudentStatsMock(...args),
  };
});

const startTestServer = async () => {
  const handler = createApiHandler({ serviceSupabase });
  const server = createServer((req, res) => handler(req, res));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}` };
};

beforeEach(() => {
  vi.clearAllMocks();
  requestSupabase.setResponses({});
  serviceSupabase.setResponses({});
  recordLearningEventMock.mockResolvedValue({
    pointsAwarded: 40,
    xpTotal: 140,
    streakDays: 3,
    eventId: 9001,
    eventCreatedAt: '2026-04-03T12:00:00.000Z',
    awardedBadges: [],
  });
  applyAdaptiveEventMock.mockResolvedValue({
    path: { path: { id: 12, status: 'active', started_at: '2026-04-03T12:00:00.000Z', updated_at: '2026-04-03T12:00:00.000Z', metadata: null }, entries: [] },
    next: null,
    adaptive: { targetDifficulty: 2, misconceptions: ['6.NS.A.1'], recentAttempts: [] },
  });
  getStudentStatsMock.mockResolvedValue({
    xpTotal: 140,
    streakDays: 3,
    badges: 0,
    recentEvents: [],
    masteryAvg: 77,
    pathProgress: { completed: 1, remaining: 3, percent: 25 },
    avgAccuracy: 74,
    avgAccuracyPriorWeek: 70,
    avgAccuracyDelta: 4,
    weeklyTimeMinutes: 35,
    weeklyTimeMinutesPriorWeek: 20,
    weeklyTimeMinutesDelta: 15,
    modulesMastered: { count: 0, items: [] },
    focusStandards: [],
    latestQuizScore: 82,
    struggle: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('API integration', () => {
  it('serves module listings via /api/modules', async () => {
    listModulesMock.mockResolvedValue({
      data: [
        {
          id: 1,
          slug: 'algebra',
          title: 'Algebra',
          summary: 'Intro unit',
          grade_band: '5',
          subject: 'math',
          strand: null,
          topic: null,
          open_track: true,
          suggested_source_category: null,
          example_source: null,
        },
      ],
      total: 1,
    });

    const { server, url } = await startTestServer();
    const response = await fetch(`${url}/api/v1/modules`);
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(payload.data[0].title).toBe('Algebra');
    expect(listModulesMock).toHaveBeenCalled();
  });

  it('returns a not found error when a lesson cannot be resolved', async () => {
    getLessonDetailMock.mockResolvedValue(null);

    const { server, url } = await startTestServer();
    const response = await fetch(`${url}/api/v1/lessons/999`);
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('not_found');
  });

  it('requires moduleId for recommendations', async () => {
    const { server, url } = await startTestServer();
    const response = await fetch(`${url}/api/v1/recommendations`);
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('invalid_parameter');
  });

  it('creates assignments through /api/assignments/assign', async () => {
    requestSupabase.setResponses({
      modules: {
        maybeSingle: async () => ({ data: { id: 2, title: 'Fractions' }, error: null }),
      },
      lessons: {
        query: async () => ({ data: [{ id: 201 }], error: null }),
      },
      parent_profiles: {
        maybeSingle: async () => ({ data: { id: 'parent-1' }, error: null }),
      },
      assignments: {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 777 }, error: null }),
          }),
        }),
      },
      assignment_lessons: {
        upsert: async () => ({ data: null, error: null }),
      },
      student_assignments: {
        upsert: (payload: Array<{ assignment_id: number }>) => ({
          select: async () => ({
            data: payload.map((entry, index) => ({
              id: entry.assignment_id + index,
            })),
            error: null,
          }),
        }),
      },
      'rpc:is_guardian': {
        maybeSingle: async () => ({ data: true, error: null }),
      },
      'rpc:refresh_dashboard_rollups': {
        maybeSingle: async () => ({ data: null, error: null }),
      },
    });

    const { server, url } = await startTestServer();
    const response = await fetch(`${url}/api/v1/assignments/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer parent-token',
      },
      body: JSON.stringify({
        moduleId: 2,
        studentIds: ['student-1'],
        dueAt: '2024-08-01T00:00:00.000Z',
      }),
    });
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(payload.assignmentId).toBe(777);
    expect(payload.lessonsAttached).toBe(1);
    expect(payload.assignedStudents).toBe(1);
  });

  it('records student events and returns adaptive state through /api/v1/student/event', async () => {
    const { server, url } = await startTestServer();
    const response = await fetch(`${url}/api/v1/student/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer student-token',
      },
      body: JSON.stringify({
        eventType: 'lesson_completed',
        status: 'completed',
        score: 88,
        timeSpentSeconds: 125,
        difficulty: 3,
        payload: {
          lesson_id: 301,
          module_id: 44,
          standards: ['6.NS.A.1'],
          subject: 'math',
        },
      }),
    });
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(recordLearningEventMock).toHaveBeenCalledWith(
      serviceSupabase,
      expect.objectContaining({
        studentId: 'student-1',
        eventType: 'lesson_completed',
        difficulty: 3,
        payload: expect.objectContaining({
          lesson_id: 301,
          module_id: 44,
          standards: ['6.NS.A.1'],
          subject: 'math',
          score: 88,
          time_spent_s: 125,
        }),
      }),
    );
    expect(applyAdaptiveEventMock).toHaveBeenCalledWith(
      requestSupabase,
      'student-1',
      expect.objectContaining({
        eventType: 'lesson_completed',
        status: 'completed',
        score: 88,
        timeSpentSeconds: 125,
      }),
    );
    expect(payload.event.eventId).toBe(9001);
    expect(payload.stats.xpTotal).toBe(140);
    expect(payload.adaptive.targetDifficulty).toBe(2);
  });
});
