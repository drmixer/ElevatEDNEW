import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';

const useAuthSpy = vi.fn();

vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => useAuthSpy(),
}));

vi.mock('./contexts/EntitlementsContext', () => ({
  EntitlementsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./components/Layout/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('./components/Landing/LandingPage', () => ({
  default: () => <div>Landing</div>,
}));

vi.mock('./components/Auth/AuthModal', () => ({
  default: () => <div>Auth Modal</div>,
}));

vi.mock('./components/Layout/DashboardRouteSkeleton', () => ({
  default: () => <div>Loading route…</div>,
}));

vi.mock('./components/Student/StudentDashboardSimplified', () => ({
  default: () => <div>Student Dashboard Simplified</div>,
}));

vi.mock('./components/Student/StudentDashboard', () => ({
  default: () => <div>Student Dashboard</div>,
}));

vi.mock('./components/Student/OnboardingFlow', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => (
    <div>
      <div>Student Onboarding Flow</div>
      <button type="button" onClick={onComplete}>
        Finish onboarding
      </button>
    </div>
  ),
}));

vi.mock('./components/Parent/ParentDashboardSimplified', () => ({
  default: () => <div>Parent Dashboard Simplified</div>,
}));

vi.mock('./components/Parent/ParentDashboard', () => ({
  default: () => <div>Parent Dashboard</div>,
}));

vi.mock('./components/Admin/AdminDashboard', () => ({
  default: () => <div>Admin Dashboard</div>,
}));

vi.mock('./pages/CatalogPage', () => ({
  default: () => <div>Catalog</div>,
}));

vi.mock('./pages/ModulePage', () => ({
  default: () => <div>Module</div>,
}));

vi.mock('./pages/AdminImportPage', () => ({
  default: () => <div>Admin Import</div>,
}));

vi.mock('./pages/LessonPlayerPage', () => ({
  default: () => <div>Lesson Player</div>,
}));

vi.mock('./pages/PrivacyPolicyPage', () => ({
  default: () => <div>Privacy Policy</div>,
}));

vi.mock('./pages/TermsPage', () => ({
  default: () => <div>Terms</div>,
}));

vi.mock('./pages/AccountSettingsPage', () => ({
  default: () => <div>Settings</div>,
}));

vi.mock('./pages/AuthCallbackPage', () => ({
  default: () => <div>Auth Callback</div>,
}));

vi.mock('./pages/AuthResetPage', () => ({
  default: () => <div>Auth Reset</div>,
}));

describe('App routing', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    useAuthSpy.mockReturnValue({
      user: { id: 'student-1', role: 'student', name: 'Student Tester' },
      loading: false,
    });
  });

  it('renders the student onboarding route and returns to /student on completion', async () => {
    window.history.replaceState({}, '', '/student/onboarding');

    render(<App />);

    expect(await screen.findByText('Student Onboarding Flow')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Finish onboarding' }));

    expect(await screen.findByText('Student Dashboard Simplified')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/student');
  });
});
