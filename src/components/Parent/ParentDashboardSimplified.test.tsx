import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ParentDashboardSimplified from './ParentDashboardSimplified';

const { fetchParentDashboardDataSpy, fetchParentOverviewSpy, createLearnerForParentSpy, refreshUserSpy } = vi.hoisted(() => ({
  fetchParentDashboardDataSpy: vi.fn(),
  fetchParentOverviewSpy: vi.fn(),
  createLearnerForParentSpy: vi.fn(),
  refreshUserSpy: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'parent-1', role: 'parent', name: 'Pat Parent', children: [] },
    refreshUser: refreshUserSpy,
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

vi.mock('../../services/parentService', () => ({
  createLearnerForParent: createLearnerForParentSpy,
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
    createLearnerForParentSpy.mockReset();
    refreshUserSpy.mockReset();
    refreshUserSpy.mockResolvedValue(undefined);
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

    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    } else {
      vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined);
    }
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

    expect(await screen.findByText('Current learning pace')).toBeInTheDocument();
    expect(screen.getByText('Math')).toBeInTheDocument();
    expect(screen.getAllByText('pace 7').length).toBeGreaterThan(0);
    expect(screen.getAllByText('school grade signal 7').length).toBe(2);
  });

  it('opens the add learner modal from the empty state instead of navigating to a dead route', async () => {
    fetchParentDashboardDataSpy.mockResolvedValue({
      alerts: [],
      children: [],
      activitySeries: [],
    });

    fetchParentOverviewSpy.mockResolvedValue({
      children: [],
    });

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

    fireEvent.click(await screen.findByRole('button', { name: 'Add a Learner' }));

    expect(await screen.findByText('Create and link a learner')).toBeInTheDocument();
  });

  it('refreshes the auth profile after creating a learner so the header count can update', async () => {
    createLearnerForParentSpy.mockResolvedValue({
      studentId: 'student-2',
      email: 'newlearner@example.com',
      familyLinkCode: 'ABCD1234',
      temporaryPassword: 'temp-pass',
      inviteSent: true,
    });

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

    fireEvent.click(await screen.findByRole('button', { name: /add learner/i }));

    fireEvent.change(await screen.findByPlaceholderText('Alex Rivera'), {
      target: { value: 'New Learner' },
    });
    fireEvent.change(screen.getByPlaceholderText('learner@example.com'), {
      target: { value: 'newlearner@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create learner' }));

    await waitFor(() => expect(createLearnerForParentSpy).toHaveBeenCalled());
    await waitFor(() => expect(refreshUserSpy).toHaveBeenCalled());
  });

  it('renders anchor targets for the parent header goals and insights links', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{ pathname: '/parent', hash: '#goal-planner' }]}>
          <ParentDashboardSimplified />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText('Quick Actions');
    expect(document.getElementById('goal-planner')).toBeTruthy();
    expect(document.getElementById('learning-insights')).toBeTruthy();
  });
});
