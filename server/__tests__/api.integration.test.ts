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
const fetchStudentMathDailyPlanMock = vi.fn();
const fetchStudentElaDailyPlanMock = vi.fn();
const fetchMathAdaptiveVariantMock = vi.fn();
const fetchStudentMathSubjectStateMock = vi.fn();
const fetchStudentElaSubjectStateMock = vi.fn();
const fetchStudentMathParentPreferenceMock = vi.fn();
const fetchStudentMathWeeklyRecordMock = vi.fn();
const fetchStudentElaWeeklyRecordMock = vi.fn();
const fetchStudentElaBlockContentMock = vi.fn();
const updateStudentMathParentPreferenceMock = vi.fn();
const updateMathSubjectStateFromAdaptiveVariantEventMock = vi.fn();
const updateElaSubjectStateFromCompletionEventMock = vi.fn();
const recordElaWorkSampleFromSubjectStateUpdateMock = vi.fn();

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

vi.mock('../homeschoolPlans.js', () => ({
  fetchStudentMathDailyPlan: (...args: unknown[]) => fetchStudentMathDailyPlanMock(...args),
  fetchMathAdaptiveVariant: (...args: unknown[]) => fetchMathAdaptiveVariantMock(...args),
  fetchStudentMathSubjectState: (...args: unknown[]) => fetchStudentMathSubjectStateMock(...args),
  fetchStudentMathParentPreference: (...args: unknown[]) => fetchStudentMathParentPreferenceMock(...args),
  fetchStudentMathWeeklyRecord: (...args: unknown[]) => fetchStudentMathWeeklyRecordMock(...args),
  updateStudentMathParentPreference: (...args: unknown[]) => updateStudentMathParentPreferenceMock(...args),
}));

vi.mock('../elaHomeschoolPlans.js', () => ({
  fetchStudentElaDailyPlan: (...args: unknown[]) => fetchStudentElaDailyPlanMock(...args),
  fetchStudentElaSubjectState: (...args: unknown[]) => fetchStudentElaSubjectStateMock(...args),
  fetchStudentElaWeeklyRecord: (...args: unknown[]) => fetchStudentElaWeeklyRecordMock(...args),
}));

vi.mock('../elaBlockContentService.js', () => ({
  fetchStudentElaBlockContent: (...args: unknown[]) => fetchStudentElaBlockContentMock(...args),
}));

vi.mock('../mathSubjectState.js', () => ({
  updateMathSubjectStateFromAdaptiveVariantEvent: (...args: unknown[]) =>
    updateMathSubjectStateFromAdaptiveVariantEventMock(...args),
}));

vi.mock('../elaSubjectState.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../elaSubjectState.js')>();
  return {
    ...actual,
    updateElaSubjectStateFromCompletionEvent: (...args: unknown[]) =>
      updateElaSubjectStateFromCompletionEventMock(...args),
  };
});

vi.mock('../elaWorkSamples.js', () => ({
  recordElaWorkSampleFromSubjectStateUpdate: (...args: unknown[]) =>
    recordElaWorkSampleFromSubjectStateUpdateMock(...args),
}));

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
  fetchStudentMathDailyPlanMock.mockResolvedValue({
    date: '2026-04-27',
    studentId: 'student-1',
    estimatedMinutes: 37,
    requiredMinutes: 37,
    blocks: [],
    subjects: [
      {
        subject: 'math',
        estimatedMinutes: 37,
        primaryModuleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
        action: 'diagnose',
        parentSummary: 'Math is starting with grade 3 place value.',
        studentSummary: 'Start here so the app can see what math level fits best.',
      },
    ],
    parentNotes: ['Math is starting with grade 3 place value.'],
  });
  fetchStudentElaDailyPlanMock.mockResolvedValue({
    date: '2026-04-27',
    studentId: 'student-1',
    estimatedMinutes: 35,
    requiredMinutes: 35,
    blocks: [],
    subjects: [
      {
        subject: 'ela',
        estimatedMinutes: 35,
        primaryModuleSlug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
        action: 'read',
        targetStrand: 'reading_informational',
        parentSummary: 'ELA is continuing reading informational text.',
        studentSummary: 'Read and answer with evidence.',
      },
    ],
    parentNotes: ['ELA is continuing reading informational text.'],
  });
  fetchMathAdaptiveVariantMock.mockReturnValue({
    id: '5-mathematics-number-and-operations-fractions-concepts-equivalence::repair_lesson',
    moduleSlug: '5-mathematics-number-and-operations-fractions-concepts-equivalence',
    kind: 'repair_lesson',
    title: 'Repair fractions',
    estimatedMinutes: 20,
    purpose: 'Rebuild equivalent fractions.',
    markdown: '## Repair\nUse the same-sized whole.',
    practiceItems: [],
    masteryCheck: 'Explain the strategy.',
  });
  fetchStudentMathSubjectStateMock.mockResolvedValue({
    subject: 'math',
    placementStatus: 'completed',
    currentStrand: 'place_value_operations',
    currentModuleSlug: '3-mathematics-number-and-operations-multiplication-division',
    currentModuleTitle: 'Multiplication/division',
    workingGrade: 3,
    confidence: 0.76,
    masteredModuleSlugs: ['3-mathematics-number-and-operations-place-value-thousands-millions'],
    weakModuleSlugs: [],
    recommendedModuleSlugs: ['3-mathematics-number-and-operations-multiplication-division'],
    lastAdaptiveVariantResult: {
      adaptiveVariantId: '3-mathematics-number-and-operations-place-value-thousands-millions::exit_ticket',
      adaptiveVariantKind: 'exit_ticket',
      moduleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
      moduleTitle: 'Place Value (thousands/millions)',
      adaptiveStrand: 'place_value_operations',
      score: 91,
      accuracy: 91,
      completedAt: '2026-04-27T10:00:00.000Z',
      outcome: 'mastered',
      nextModuleSlug: '3-mathematics-number-and-operations-multiplication-division',
      nextModuleTitle: 'Multiplication/division',
      reasonCode: 'mastery_advance',
      parentSummary: 'Math advanced because the latest check was strong.',
      practiceItemCount: 4,
      practiceItemsScored: 4,
    },
    recentEvidence: [
      {
        moduleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
        moduleTitle: 'Place Value (thousands/millions)',
        scorePct: 91,
        completedAt: '2026-04-27T10:00:00.000Z',
      },
    ],
    rotationHistory: [
      {
        date: '2026-04-27',
        targetStrand: 'place_value_operations',
        assignedModuleSlug: '3-mathematics-number-and-operations-multiplication-division',
        assignedModuleTitle: 'Multiplication/division',
        rotationReason: 'continue_current_strand',
        completedModuleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
        completedModuleTitle: 'Place Value (thousands/millions)',
        score: 91,
        outcome: 'mastered',
        parentSummary: 'Math advanced because the latest check was strong.',
      },
    ],
    parentPreference: {
      preferredStrand: 'geometry_measurement',
      weekStart: '2026-04-27',
      updatedAt: '2026-04-27T10:00:00.000Z',
      updatedBy: 'parent-1',
    },
  });
  fetchStudentElaSubjectStateMock.mockResolvedValue({
    subject: 'ela',
    placementStatus: 'completed',
    currentStrand: 'reading_informational',
    currentModuleSlug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
    currentModuleTitle: 'Science/Tech Articles (open-licensed)',
    workingGrade: 6,
    confidence: 0.76,
    masteredModuleSlugs: [],
    weakModuleSlugs: [],
    recommendedModuleSlugs: ['6-english-language-arts-reading-informational-science-tech-articles-open-licensed'],
    recentEvidence: [
      {
        moduleSlug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
        moduleTitle: 'Science/Tech Articles (open-licensed)',
        strand: 'reading_informational',
        scorePct: 82,
        completedAt: '2026-04-27T10:00:00.000Z',
      },
    ],
    reasonCode: 'continue_current_module',
    parentSummary: 'ELA is continuing reading informational text.',
  });
  fetchStudentMathParentPreferenceMock.mockResolvedValue({
    preferredStrand: 'geometry_measurement',
    weekStart: '2026-04-27',
    updatedAt: '2026-04-27T10:00:00.000Z',
    updatedBy: 'parent-1',
  });
  fetchStudentMathWeeklyRecordMock.mockResolvedValue({
    subject: 'math',
    studentId: 'student-1',
    weekStart: '2026-04-27',
    weekEnd: '2026-05-04',
    estimatedMinutes: 25,
    completedModuleCount: 1,
    completedModules: [
      {
        moduleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
        moduleTitle: 'Place Value (thousands/millions)',
        completedAt: '2026-04-27T10:00:00.000Z',
        scorePct: 91,
        estimatedMinutes: 25,
        source: 'lesson_progress',
        outcome: 'mastered',
      },
    ],
    masteredModuleSlugs: ['3-mathematics-number-and-operations-place-value-thousands-millions'],
    weakModuleSlugs: [],
    currentModuleSlug: '3-mathematics-number-and-operations-multiplication-division',
    currentModuleTitle: 'Multiplication/division',
    currentStrand: 'place_value_operations',
    rotationHistory: [],
    parentPreference: {
      preferredStrand: 'geometry_measurement',
      weekStart: '2026-04-27',
      updatedAt: '2026-04-27T10:00:00.000Z',
      updatedBy: 'parent-1',
    },
    latestChangeSummary: 'This week changed because Place Value scored 91%.',
    parentNotes: ['1 math check or lesson recorded this week.'],
  });
  fetchStudentElaWeeklyRecordMock.mockResolvedValue({
    subject: 'ela',
    studentId: 'student-1',
    weekStart: '2026-04-27',
    weekEnd: '2026-05-04',
    estimatedMinutes: 22,
    completedModuleCount: 1,
    completedModules: [
      {
        moduleSlug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
        moduleTitle: 'Science/Tech Articles (open-licensed)',
        strand: 'reading_informational',
        completedAt: '2026-04-27T10:00:00.000Z',
        scorePct: 82,
        estimatedMinutes: 22,
        outcome: 'practice',
      },
    ],
    masteredModuleSlugs: [],
    weakModuleSlugs: [],
    currentModuleSlug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
    currentModuleTitle: 'Science/Tech Articles (open-licensed)',
    currentStrand: 'reading_informational',
    latestChangeSummary: 'ELA changed because Science/Tech Articles scored 82%.',
    parentNotes: ['1 ELA check or lesson recorded this week.'],
  });
  fetchStudentElaBlockContentMock.mockResolvedValue({
    block: {
      id: 'ela-practice-6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
      subject: 'ela',
      kind: 'guided_practice',
      title: 'Evidence response',
      moduleSlug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
      estimatedMinutes: 18,
      required: true,
      purpose: 'Answer with evidence.',
      completionEvidence: ['written explanation'],
    },
    content: {
      id: 'ela-authored-lesson::100::ela-practice-6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
      title: 'Science article launch',
      strand: 'reading_informational',
      sourceType: 'authored_lesson',
      contentKind: 'passage',
      focus: 'identify the main idea or author point with evidence',
      body: ['A short authored passage about science articles.'],
      sourceLabel: 'Author: ElevatED',
      parentSummary: 'This content comes from an authored lesson.',
    },
  });
  updateStudentMathParentPreferenceMock.mockResolvedValue({
    preferredStrand: 'fractions_decimals',
    weekStart: '2026-04-27',
    updatedAt: '2026-04-27T11:00:00.000Z',
    updatedBy: 'parent-1',
  });
  updateMathSubjectStateFromAdaptiveVariantEventMock.mockResolvedValue(null);
  updateElaSubjectStateFromCompletionEventMock.mockResolvedValue(null);
  recordElaWorkSampleFromSubjectStateUpdateMock.mockResolvedValue(false);
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
          adaptive_variant_id:
            '3-mathematics-number-and-operations-place-value-thousands-millions::exit_ticket',
          adaptive_variant_kind: 'exit_ticket',
          module_slug: '3-mathematics-number-and-operations-place-value-thousands-millions',
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
          adaptive_variant_id:
            '3-mathematics-number-and-operations-place-value-thousands-millions::exit_ticket',
          adaptive_variant_kind: 'exit_ticket',
          module_slug: '3-mathematics-number-and-operations-place-value-thousands-millions',
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
    expect(updateMathSubjectStateFromAdaptiveVariantEventMock).toHaveBeenCalledWith(
      serviceSupabase,
      'student-1',
      expect.objectContaining({
        adaptiveVariantId:
          '3-mathematics-number-and-operations-place-value-thousands-millions::exit_ticket',
        adaptiveVariantKind: 'exit_ticket',
        moduleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
        score: 88,
        accuracy: 88,
        payload: expect.objectContaining({
          subject: 'math',
          score: 88,
        }),
      }),
    );
    expect(payload.event.eventId).toBe(9001);
    expect(payload.stats.xpTotal).toBe(140);
    expect(payload.adaptive.targetDifficulty).toBe(2);
  });

  it('updates ELA subject state from scored ELA lesson completions', async () => {
    const elaStateUpdate = {
      metadata: {
        last_ela_completion: {
          module_slug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
          score: 86,
        },
      },
    };
    updateElaSubjectStateFromCompletionEventMock.mockResolvedValueOnce(elaStateUpdate);
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
        score: 86,
        timeSpentSeconds: 1320,
        payload: {
          subject: 'ela',
          module_slug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
          response_kind: 'evidence_response',
        },
      }),
    });
    await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(updateElaSubjectStateFromCompletionEventMock).toHaveBeenCalledWith(
      serviceSupabase,
      'student-1',
      expect.objectContaining({
        moduleSlug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
        score: 86,
        accuracy: 86,
        completedAt: '2026-04-03T12:00:00.000Z',
        estimatedMinutes: 22,
        payload: expect.objectContaining({
          subject: 'ela',
          score: 86,
          time_spent_s: 1320,
          response_kind: 'evidence_response',
        }),
      }),
    );
    expect(recordElaWorkSampleFromSubjectStateUpdateMock).toHaveBeenCalledWith(
      serviceSupabase,
      'student-1',
      elaStateUpdate,
      expect.objectContaining({
        eventType: 'lesson_completed',
        eventCreatedAt: '2026-04-03T12:00:00.000Z',
        payload: expect.objectContaining({
          subject: 'ela',
          module_slug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
          response_kind: 'evidence_response',
        }),
      }),
    );
    expect(updateMathSubjectStateFromAdaptiveVariantEventMock).not.toHaveBeenCalled();
  });

  it('returns the logged-in student homeschool math plan', async () => {
    const { server, url } = await startTestServer();
    const response = await fetch(`${url}/api/v1/student/homeschool/math-plan?date=2026-04-27`, {
      headers: {
        Authorization: 'Bearer student-token',
      },
    });
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(payload.plan.subjects[0].action).toBe('diagnose');
    expect(fetchStudentMathDailyPlanMock).toHaveBeenCalledWith(
      requestSupabase,
      'student-1',
      { date: '2026-04-27' },
    );
  });

  it('returns the logged-in student homeschool ELA plan', async () => {
    const { server, url } = await startTestServer();
    const response = await fetch(`${url}/api/v1/student/homeschool/ela-plan?date=2026-04-27`, {
      headers: {
        Authorization: 'Bearer student-token',
      },
    });
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(payload.plan.subjects[0].subject).toBe('ela');
    expect(fetchStudentElaDailyPlanMock).toHaveBeenCalledWith(
      requestSupabase,
      'student-1',
      { date: '2026-04-27' },
    );
  });

  it('returns authored ELA block content for the logged-in student', async () => {
    const blockId = 'ela-practice-6-english-language-arts-reading-informational-science-tech-articles-open-licensed';
    const { server, url } = await startTestServer();
    const response = await fetch(
      `${url}/api/v1/student/homeschool/ela-block-content?blockId=${encodeURIComponent(blockId)}&date=2026-04-27`,
      {
        headers: {
          Authorization: 'Bearer student-token',
        },
      },
    );
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(payload.content.sourceType).toBe('authored_lesson');
    expect(fetchStudentElaBlockContentMock).toHaveBeenCalledWith(
      requestSupabase,
      'student-1',
      blockId,
      { date: '2026-04-27' },
    );
  });

  it('rejects ELA block content requests for blocks outside the daily plan', async () => {
    fetchStudentElaBlockContentMock.mockResolvedValueOnce(null);
    const { server, url } = await startTestServer();
    const response = await fetch(`${url}/api/v1/student/homeschool/ela-block-content?blockId=missing-block`, {
      headers: {
        Authorization: 'Bearer student-token',
      },
    });
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('not_found');
  });

  it('returns inspectable math subject state for the logged-in student', async () => {
    const { server, url } = await startTestServer();
    const response = await fetch(`${url}/api/v1/student/homeschool/math-state`, {
      headers: {
        Authorization: 'Bearer student-token',
      },
    });
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(payload.state.lastAdaptiveVariantResult.reasonCode).toBe('mastery_advance');
    expect(fetchStudentMathSubjectStateMock).toHaveBeenCalledWith(requestSupabase, 'student-1');
  });

  it('lets a parent read inspectable math subject state for a managed learner', async () => {
    requestSupabase.setResponses({
      'rpc:is_guardian': {
        maybeSingle: async () => ({ data: true, error: null }),
      },
    });

    const { server, url } = await startTestServer();
    const response = await fetch(`${url}/api/v1/student/homeschool/math-state?studentId=student-1`, {
      headers: {
        Authorization: 'Bearer parent-token',
      },
    });
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(payload.state.currentModuleSlug).toBe(
      '3-mathematics-number-and-operations-multiplication-division',
    );
    expect(fetchStudentMathSubjectStateMock).toHaveBeenCalledWith(requestSupabase, 'student-1');
  });

  it('lets a parent read inspectable ELA subject state for a managed learner', async () => {
    requestSupabase.setResponses({
      'rpc:is_guardian': {
        maybeSingle: async () => ({ data: true, error: null }),
      },
    });

    const { server, url } = await startTestServer();
    const response = await fetch(`${url}/api/v1/student/homeschool/ela-state?studentId=student-1`, {
      headers: {
        Authorization: 'Bearer parent-token',
      },
    });
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(payload.state.currentStrand).toBe('reading_informational');
    expect(fetchStudentElaSubjectStateMock).toHaveBeenCalledWith(requestSupabase, 'student-1');
  });

  it('lets a parent read the weekly math strand preference for a managed learner', async () => {
    requestSupabase.setResponses({
      'rpc:is_guardian': {
        maybeSingle: async () => ({ data: true, error: null }),
      },
    });

    const { server, url } = await startTestServer();
    const response = await fetch(`${url}/api/v1/parent/homeschool/math-preference?studentId=student-1`, {
      headers: {
        Authorization: 'Bearer parent-token',
      },
    });
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(payload.preference.preferredStrand).toBe('geometry_measurement');
    expect(fetchStudentMathParentPreferenceMock).toHaveBeenCalledWith(requestSupabase, 'student-1');
  });

  it('lets a parent read the weekly math record for a managed learner', async () => {
    requestSupabase.setResponses({
      'rpc:is_guardian': {
        maybeSingle: async () => ({ data: true, error: null }),
      },
    });

    const { server, url } = await startTestServer();
    const response = await fetch(
      `${url}/api/v1/parent/homeschool/math-weekly-record?studentId=student-1&weekStart=2026-04-27`,
      {
        headers: {
          Authorization: 'Bearer parent-token',
        },
      },
    );
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(payload.record.estimatedMinutes).toBe(25);
    expect(payload.record.masteredModuleSlugs).toContain(
      '3-mathematics-number-and-operations-place-value-thousands-millions',
    );
    expect(fetchStudentMathWeeklyRecordMock).toHaveBeenCalledWith(requestSupabase, 'student-1', {
      weekStart: '2026-04-27',
    });
  });

  it('lets a parent read the weekly ELA record for a managed learner', async () => {
    requestSupabase.setResponses({
      'rpc:is_guardian': {
        maybeSingle: async () => ({ data: true, error: null }),
      },
    });

    const { server, url } = await startTestServer();
    const response = await fetch(
      `${url}/api/v1/parent/homeschool/ela-weekly-record?studentId=student-1&weekStart=2026-04-27`,
      {
        headers: {
          Authorization: 'Bearer parent-token',
        },
      },
    );
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(payload.record.completedModuleCount).toBe(1);
    expect(payload.record.latestChangeSummary).toContain('ELA changed');
    expect(fetchStudentElaWeeklyRecordMock).toHaveBeenCalledWith(requestSupabase, 'student-1', {
      weekStart: '2026-04-27',
    });
  });

  it('lets a parent update the weekly math strand preference for a managed learner', async () => {
    requestSupabase.setResponses({
      'rpc:is_guardian': {
        maybeSingle: async () => ({ data: true, error: null }),
      },
    });

    const { server, url } = await startTestServer();
    const response = await fetch(`${url}/api/v1/parent/homeschool/math-preference`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer parent-token',
      },
      body: JSON.stringify({
        studentId: 'student-1',
        preferredStrand: 'fractions_decimals',
      }),
    });
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(payload.preference.preferredStrand).toBe('fractions_decimals');
    expect(updateStudentMathParentPreferenceMock).toHaveBeenCalledWith(
      serviceSupabase,
      'student-1',
      'parent-1',
      'fractions_decimals',
    );
  });

  it('returns a logged-in student math adaptive variant', async () => {
    const variantId = '5-mathematics-number-and-operations-fractions-concepts-equivalence::repair_lesson';
    const { server, url } = await startTestServer();
    const response = await fetch(
      `${url}/api/v1/student/homeschool/math-variant?id=${encodeURIComponent(variantId)}`,
      {
        headers: {
          Authorization: 'Bearer student-token',
        },
      },
    );
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(payload.variant.id).toBe(variantId);
    expect(fetchMathAdaptiveVariantMock).toHaveBeenCalledWith(variantId);
  });

  it('returns not found for an unknown math adaptive variant', async () => {
    fetchMathAdaptiveVariantMock.mockReturnValueOnce(null);

    const { server, url } = await startTestServer();
    const response = await fetch(`${url}/api/v1/student/homeschool/math-variant?id=missing`, {
      headers: {
        Authorization: 'Bearer student-token',
      },
    });
    const payload = await response.json();
    server.close();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('not_found');
  });
});
