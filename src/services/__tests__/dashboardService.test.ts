import { describe, expect, it } from 'vitest';
import { buildParentDownloadableReport, calculateChildGoalProgress } from '../dashboardService';
import type { Parent, ParentChildSnapshot, ParentWeeklyReport } from '../../types';

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
