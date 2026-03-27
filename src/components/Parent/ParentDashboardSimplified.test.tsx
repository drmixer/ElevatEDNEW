import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ParentDashboardSimplified from './ParentDashboardSimplified';

const { fetchParentDashboardDataSpy, fetchParentOverviewSpy } = vi.hoisted(() => ({
  fetchParentDashboardDataSpy: vi.fn(),
  fetchParentOverviewSpy: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'parent-1', role: 'parent', name: 'Pat Parent', children: [] },
  }),
}));

vi.mock('../../services/dashboardService', () => ({
  fetchParentDashboardData: fetchParentDashboardDataSpy,
}));

vi.mock('../../services/statsService', () => ({
  fetchParentOverview: fetchParentOverviewSpy,
}));

vi.mock('../../services/profileService', () => ({
  updateLearningPreferences: vi.fn(),
}));

vi.mock('./SubjectStatusCards', () => ({ default: () => <div>Subject status cards</div> }));
vi.mock('./WeeklyCoachingSuggestions', () => ({ default: () => <div>Weekly coaching suggestions</div> }));
vi.mock('./ParentTutorControls', () => ({ default: () => <div>Parent tutor controls</div> }));
vi.mock('./SafetyTransparencySection', () => ({ default: () => <div>Safety transparency</div> }));
vi.mock('./ParentOnboardingTour', () => ({ default: () => null }));
vi.mock('../../lib/parentOnboardingHelpers', () => ({
  shouldShowParentOnboarding: () => false,
  markParentOnboardingDone: vi.fn(),
}));

describe('ParentDashboardSimplified', () => {
  beforeEach(() => {
    fetchParentDashboardDataSpy.mockResolvedValue({
      alerts: [],
      children: [
        {
          id: 'student-1',
          name: 'Codex Smoke Student',
          grade: 6,
          level: 1,
          xp: 0,
          streakDays: 0,
          strengths: [],
          focusAreas: [],
          lessonsCompletedWeek: 0,
          practiceMinutesWeek: 0,
          xpEarnedWeek: 0,
          masteryBySubject: [],
          recentActivity: [],
        },
      ],
      activitySeries: [],
    });

    fetchParentOverviewSpy.mockResolvedValue({
      children: [
        {
          id: 'student-1',
          name: 'Codex Smoke Student',
          grade_band: '6-8',
          xp_total: 0,
          streak_days: 0,
          recent_events: [],
          progress_pct: 0,
          latest_quiz_score: null,
          weekly_time_minutes: 0,
          alerts: [],
          struggle: false,
          subject_placements: [
            {
              subject: 'math',
              expected_level: 7,
              working_level: 7,
              level_confidence: 0.85,
              diagnostic_completed_at: '2026-03-27T02:29:06.456+00:00',
            },
            {
              subject: 'english',
              expected_level: 7,
              working_level: 7,
              level_confidence: 0.85,
              diagnostic_completed_at: '2026-03-27T02:30:57.340+00:00',
            },
          ],
        },
      ],
    });
  });

  it('shows subject placement chips from the live overview endpoint', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ParentDashboardSimplified />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Placement')).toBeInTheDocument();
    expect(screen.getByText('Math')).toBeInTheDocument();
    expect(screen.getAllByText('L7').length).toBeGreaterThan(0);
    expect(screen.getAllByText('from 7').length).toBe(2);
  });
});
