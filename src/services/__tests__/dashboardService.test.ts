import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildParentDownloadableReport,
  calculateChildGoalProgress,
  injectMixInsIntoPlan,
  selectElectiveSuggestion,
  deriveSubjectTrends,
  summarizeWeeklyChanges,
  fetchStudentDashboardData,
} from '../dashboardService';
import type {
  DashboardLesson,
  LearningPreferences,
  Parent,
  ParentChildSnapshot,
  ParentWeeklyReport,
  Student,
  SubjectMastery,
} from '../../types';
import { defaultLearningPreferences } from '../../types';

vi.mock('../../lib/supabaseClient', async () => {
  const { createSupabaseClientMock } = await import('../../test/supabaseMock');
  return { __esModule: true, default: createSupabaseClientMock() };
});

import supabaseMock from '../../lib/supabaseClient';

const mockParent: Parent = {
  id: 'parent-1',
  email: 'parent@example.com',
  name: 'Jordan Taylor',
  role: 'parent',
  subscriptionTier: 'premium',
  notifications: {
    weeklyReports: true,
    missedSessions: true,
    lowScores: true,
    majorProgress: true,
  },
  children: [],
};

const mockReport: ParentWeeklyReport = {
  weekStart: '2024-08-05T00:00:00.000Z',
  summary: 'Your family completed 6 lessons and 180 minutes of learning for 420 XP.',
  highlights: ['Avery unlocked the Math Momentum badge.'],
  recommendations: ['Schedule a weekend celebration for Avery’s progress.'],
  aiGenerated: true,
};

const mockChildren: ParentChildSnapshot[] = [
  {
    id: 'child-1',
    name: 'Avery',
    grade: 6,
    level: 5,
    xp: 1400,
    streakDays: 9,
    strengths: ['Fractions'],
    focusAreas: ['Geometry'],
    lessonsCompletedWeek: 4,
    practiceMinutesWeek: 120,
    xpEarnedWeek: 220,
    masteryBySubject: [
      { subject: 'math', mastery: 78, trend: 'up', goal: 85, cohortAverage: 72, delta: 6 },
    ],
    recentActivity: [],
    goalProgress: 95,
    cohortComparison: 6,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.setResponses({});
});

describe('buildParentDownloadableReport', () => {
  it('creates a shareable weekly summary containing key details', () => {
    const report = buildParentDownloadableReport(mockParent, mockReport, mockChildren);

    expect(report).toContain('Jordan Taylor');
    expect(report).toContain('Week of');
    expect(report).toContain('Avery');
    expect(report.toLowerCase()).toContain('lessons');
    expect(report).toContain('Recommended Next Steps');
  });
});

describe('deriveSubjectTrends', () => {
  it('computes per-subject accuracy and time deltas with directions', () => {
    const mastery: SubjectMastery[] = [
      { subject: 'math', mastery: 70, trend: 'steady' },
      { subject: 'ela', mastery: 80, trend: 'steady' },
    ];
    const accuracyWindow = new Map([
      ['math', { current: [80, 90], prior: [70, 80] }],
      ['ela', { current: [65], prior: [70] }],
    ] as const);
    const lessonWindow = {
      current: new Map([
        ['math', 4],
        ['ela', 2],
      ] as const),
      prior: new Map([
        ['math', 2],
        ['ela', 2],
      ] as const),
    };

    const trends = deriveSubjectTrends(mastery, accuracyWindow as any, lessonWindow as any, {
      current: 120,
      prior: 100,
    });

    const mathTrend = trends.find((trend) => trend.subject === 'math');
    const elaTrend = trends.find((trend) => trend.subject === 'ela');

    expect(mathTrend?.accuracyDelta).toBeCloseTo(10, 1);
    expect(mathTrend?.timeMinutes).toBe(80);
    expect(mathTrend?.timeDelta).toBe(30);
    expect(mathTrend?.direction).toBe('up');

    expect(elaTrend?.accuracyDelta).toBeCloseTo(-5, 1);
    expect(elaTrend?.timeMinutes).toBe(40);
    expect(elaTrend?.timeDelta).toBe(-10);
    expect(elaTrend?.direction).toBe('down');
  });
});

describe('summarizeWeeklyChanges', () => {
  it('returns ranked top improvements and risks', () => {
    const child: ParentChildSnapshot = {
      ...mockChildren[0],
      subjectTrends: [
        { subject: 'math', accuracyDelta: 1.2, timeDelta: null, timeMinutes: 80, direction: 'up' },
        { subject: 'math', accuracyDelta: null, timeDelta: -12, timeMinutes: 60, direction: 'down' },
      ],
      weeklyChange: {
        lessons: 4,
        minutes: 120,
        xp: 220,
        deltaLessons: 3,
        deltaMinutes: 20,
        deltaXp: 50,
      },
    };

    const changes = summarizeWeeklyChanges([child]);

    expect(changes.improvements).toHaveLength(3);
    expect(changes.improvements[0]).toContain('+3 lessons');
    expect(changes.improvements[1]).toContain('+20 min vs prior week');
    expect(changes.improvements[2]).toContain('Math accuracy +1.2 pts');
    expect(changes.risks[0]).toContain('-12 min on Math');
  });
});

describe('injectMixInsIntoPlan', () => {
  const makeLesson = (partial: Partial<DashboardLesson> & Pick<DashboardLesson, 'id' | 'subject' | 'title'>): DashboardLesson => ({
    id: partial.id,
    subject: partial.subject,
    title: partial.title,
    status: partial.status ?? 'not_started',
    difficulty: partial.difficulty ?? 'easy',
    xpReward: partial.xpReward ?? 10,
    moduleSlug: partial.moduleSlug ?? null,
    suggestionReason: partial.suggestionReason ?? null,
    isMixIn: partial.isMixIn,
    isElective: partial.isElective,
  });

  it('uses cross-pool subjects for thin plans and avoids opted-out picks', () => {
    const coreLessons: DashboardLesson[] = [
      makeLesson({ id: 'core-math-1', subject: 'math', title: 'Math Core 1' }),
      makeLesson({ id: 'core-math-2', subject: 'math', title: 'Math Core 2' }),
    ];
    const crossPool: DashboardLesson[] = [
      makeLesson({ id: 'science-1', subject: 'science', title: 'Science Mix 1' }),
      makeLesson({ id: 'study-1', subject: 'study_skills', title: 'Study Mix 1' }),
      makeLesson({ id: 'science-2', subject: 'science', title: 'Science Mix 2' }),
    ];
    const prefs: LearningPreferences = {
      ...defaultLearningPreferences,
      mixInMode: 'auto',
      weeklyPlanIntensity: 'light',
      weeklyPlanFocus: 'math',
      focusSubject: 'math',
    };
    const result = injectMixInsIntoPlan(
      coreLessons,
      prefs,
      { lessons: 5, minutes: 60 },
      { lessons: 0, minutes: 0 },
      new Set(['science-1']),
      crossPool,
    );

    const mixIns = result.filter((lesson) => lesson.isMixIn);
    expect(mixIns.map((lesson) => lesson.id).sort()).toEqual(['science-2', 'study-1'].sort());
  });
});

describe('selectElectiveSuggestion', () => {
  const makeLesson = (partial: Partial<DashboardLesson> & Pick<DashboardLesson, 'id' | 'subject' | 'title'>): DashboardLesson => ({
    id: partial.id,
    subject: partial.subject,
    title: partial.title,
    status: partial.status ?? 'not_started',
    difficulty: partial.difficulty ?? 'easy',
    xpReward: partial.xpReward ?? 10,
    moduleSlug: partial.moduleSlug ?? null,
    suggestionReason: partial.suggestionReason ?? null,
    isMixIn: partial.isMixIn,
    isElective: partial.isElective,
  });

  const computeWeekIndex = (dateIso: string) =>
    Math.floor(new Date(dateIso).getTime() / (1000 * 60 * 60 * 24 * 7));

  it('rotates electives by allowed subjects week-to-week', () => {
    vi.useFakeTimers();
    const lessons: DashboardLesson[] = [
      makeLesson({ id: 'core-math', subject: 'math', title: 'Core Math' }),
      makeLesson({ id: 'elec-sci', subject: 'science', title: 'Elective Science' }),
      makeLesson({ id: 'elec-arts', subject: 'arts_music', title: 'Elective Arts' }),
    ];
    const prefs: LearningPreferences = {
      ...defaultLearningPreferences,
      electiveEmphasis: 'on',
      allowedElectiveSubjects: ['science', 'arts_music'],
      weeklyPlanFocus: 'balanced',
      focusSubject: 'balanced',
    };

    const date1 = '2025-01-06T12:00:00.000Z';
    vi.setSystemTime(new Date(date1));
    const weekSeed1 = date1.slice(0, 10);
    const expected1 = prefs.allowedElectiveSubjects![computeWeekIndex(weekSeed1) % prefs.allowedElectiveSubjects!.length];
    const result1 = selectElectiveSuggestion(
      lessons,
      prefs,
      { lessons: 0, minutes: 0 },
      { lessons: 0, minutes: 0 },
      null,
      new Set(),
    );
    expect(result1.elective?.subject).toBe(expected1);

    const date2 = '2025-01-13T12:00:00.000Z';
    vi.setSystemTime(new Date(date2));
    const weekSeed2 = date2.slice(0, 10);
    const expected2 = prefs.allowedElectiveSubjects![computeWeekIndex(weekSeed2) % prefs.allowedElectiveSubjects!.length];
    const result2 = selectElectiveSuggestion(
      lessons,
      prefs,
      { lessons: 0, minutes: 0 },
      { lessons: 0, minutes: 0 },
      null,
      new Set(),
    );
    expect(result2.elective?.subject).toBe(expected2);
    expect(result2.elective?.subject).not.toBe(result1.elective?.subject);
    vi.useRealTimers();
  });
});

describe('calculateChildGoalProgress', () => {
  it('blends lesson, practice, and mastery targets into a single progress indicator', () => {
    const progress = calculateChildGoalProgress({
      ...mockChildren[0],
      lessonsCompletedWeek: 3,
      practiceMinutesWeek: 100,
      goals: {
        weeklyLessons: 6,
        practiceMinutes: 200,
        masteryTargets: { math: 80 },
      },
      masteryBySubject: [
        { subject: 'math', mastery: 60, trend: 'steady', goal: 80 },
      ],
    });

    expect(progress).toBeCloseTo(58.3, 1);
  });

  it('returns undefined when no goal anchors are provided', () => {
    const progress = calculateChildGoalProgress({
      ...mockChildren[0],
      goals: {
        weeklyLessons: null,
        practiceMinutes: null,
        masteryTargets: {},
      },
      masteryBySubject: [{ subject: 'math', mastery: 72, trend: 'steady' }],
    });

    expect(progress).toBeUndefined();
  });
});

describe('fetchStudentDashboardData', () => {
  it('returns synthetic dashboard data when Supabase lookups fail', async () => {
    vi.stubEnv('VITE_ALLOW_FAKE_DASHBOARD_DATA', 'true');

    supabaseMock.setResponses({
      student_profiles: { single: async () => ({ data: null, error: new Error('boom') }) },
      student_daily_activity: { query: async () => ({ data: [], error: new Error('boom') }) },
      student_assessment_attempts: {
        maybeSingle: async () => ({ data: null, error: new Error('missing') }),
      },
      student_mastery_by_subject: { query: async () => ({ data: [], error: new Error('fail') }) },
      xp_events: { query: async () => ({ data: [], error: new Error('fail') }) },
      student_assignments: { query: async () => ({ data: [], error: new Error('fail') }) },
      student_progress: { query: async () => ({ data: [], error: new Error('fail') }) },
      'rpc:suggest_next_lessons': {
        maybeSingle: async () => ({ data: [], error: new Error('fail') }),
      },
    });

    const student: Student = {
      id: 'student-1',
      email: 'student@example.com',
      name: 'Sky',
      role: 'student',
      grade: 6,
      xp: 0,
      level: 1,
      badges: [],
      streakDays: 0,
      strengths: [],
      weaknesses: [],
      learningPath: [],
      learningPreferences: defaultLearningPreferences,
      assessmentCompleted: false,
    };

    const dashboard = await fetchStudentDashboardData(student);

    expect(dashboard.todaysPlan.length).toBeGreaterThan(0);
    expect(dashboard.subjectMastery.length).toBeGreaterThan(0);
    expect(dashboard.aiRecommendations.length).toBeGreaterThan(0);
    expect(dashboard.activeLessonId).not.toBeNull();
    vi.unstubAllEnvs();
  });
});
