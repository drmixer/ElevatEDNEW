import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchUserProfile } from '../profileService';

vi.mock('../../lib/supabaseClient', async () => {
  const { createSupabaseClientMock } = await import('../../test/supabaseMock');
  return { __esModule: true, default: createSupabaseClientMock() };
});

import supabaseMock from '../../lib/supabaseClient';

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.setResponses({});
});

describe('fetchUserProfile', () => {
  it('normalizes student profiles and parses badge metadata', async () => {
    supabaseMock.setResponses({
      profiles: {
        single: async () => ({
          data: {
            id: 'student-1',
            email: 'student@example.com',
            full_name: 'Sky Learner',
            role: 'student',
            avatar_url: 'https://example.com/avatar.png',
            student_profiles: [
              {
                grade: 4,
                xp: 120,
                level: 3,
                badges: [{ name: 'Starter', earnedAt: '2024-01-01T00:00:00.000Z' }],
                streak_days: 7,
                strengths: ['Reading'],
                weaknesses: ['Fractions'],
                learning_path: [{ id: 'lp-1', subject: 'math', topic: 'Fractions', status: 'not_started' }],
                assessment_completed: true,
              },
            ],
          },
          error: null,
        }),
      },
    });

    const profile = await fetchUserProfile('student-1');

    expect(profile.role).toBe('student');
    expect(profile.xp).toBe(120);
    expect(profile.badges[0].name).toBe('Starter');
    expect(profile.badges[0].earnedAt).toBeInstanceOf(Date);
    expect(profile.strengths).toContain('Reading');
  });

  it('hydrates parent dashboards with mastery targets and reports', async () => {
    supabaseMock.setResponses({
      profiles: {
        single: async () => ({
          data: {
            id: 'parent-1',
            email: 'parent@example.com',
            full_name: 'Pat Parent',
            role: 'parent',
            avatar_url: null,
            parent_profiles: [
              {
                subscription_tier: 'premium',
                notifications: { weeklyReports: false, assignments: false },
              },
            ],
          },
          error: null,
        }),
      },
      parent_dashboard_children: {
        query: async () => ({
          data: [
            {
              student_id: 'child-1',
              first_name: 'Alex',
              last_name: 'Rivera',
              grade: 6,
              level: 5,
              xp: 500,
              streak_days: 3,
              strengths: ['Math'],
              weaknesses: ['Writing'],
              lessons_completed_week: 4,
              practice_minutes_week: 120,
              xp_earned_week: 200,
              mastery_breakdown: [
                { subject: 'math', mastery: 70, goal: 80, cohortAverage: 65 },
                { subject: 'english', mastery: 60, goal: 70, cohortAverage: 62 },
              ],
              mastery_targets: { math: '82', english: 68 },
            },
          ],
          error: null,
        }),
      },
      parent_weekly_reports: {
        maybeSingle: async () => ({
          data: {
            week_start: '2024-07-01',
            summary: 'Weekly recap',
            highlights: ['Win'],
            recommendations: ['Focus on writing'],
            ai_generated: true,
          },
          error: null,
        }),
      },
    });

    const profile = await fetchUserProfile('parent-1');

    expect(profile.role).toBe('parent');
    expect(profile.subscriptionTier).toBe('premium');
    expect(profile.notifications.assignments).toBe(false);
    expect(profile.children).toHaveLength(1);
    expect(profile.children[0].goals?.masteryTargets?.math).toBe(82);
    expect(profile.children[0].goalProgress).toBeCloseTo(75);
    expect(profile.children[0].cohortComparison).toBeCloseTo(63.5);
    expect(profile.weeklyReport?.highlights[0]).toBe('Win');
  });
});
