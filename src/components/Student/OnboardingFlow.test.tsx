import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OnboardingFlow from './OnboardingFlow';

const { refreshUserSpy, fetchPreferencesSpy, listAvatarsSpy, listTutorPersonasSpy, fetchStudentPathSpy } = vi.hoisted(() => ({
  refreshUserSpy: vi.fn(),
  fetchPreferencesSpy: vi.fn(),
  listAvatarsSpy: vi.fn(),
  listTutorPersonasSpy: vi.fn(),
  fetchStudentPathSpy: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'student-1', name: 'Student Tester', grade: 7 },
    refreshUser: refreshUserSpy,
  }),
}));

vi.mock('../../lib/analytics', () => ({
  default: vi.fn(),
}));

vi.mock('../../services/onboardingService', () => ({
  fetchPreferences: fetchPreferencesSpy,
  listAvatars: listAvatarsSpy,
  listTutorPersonas: listTutorPersonasSpy,
  fetchStudentPath: fetchStudentPathSpy,
  updatePreferences: vi.fn(),
  startPlacement: vi.fn(),
  savePlacementProgress: vi.fn(),
  submitPlacement: vi.fn(),
}));

describe('OnboardingFlow', () => {
  beforeEach(() => {
    refreshUserSpy.mockReset();
    fetchPreferencesSpy.mockResolvedValue({
      opt_in_ai: true,
      avatar_id: 'avatar-starter',
      tutor_persona_id: null,
    });
    listTutorPersonasSpy.mockResolvedValue([{ id: 'persona-1', name: 'Coach', tone: 'supportive' }]);
    fetchStudentPathSpy.mockResolvedValue({ path: null, entries: [], next: null });
    listAvatarsSpy.mockResolvedValue([
      { id: 'avatar-cat', name: 'Cat', image_url: 'https://example.com/cat.png', category: 'student', is_default: true, metadata: {} },
      {
        id: 'avatar-star',
        name: 'Star',
        image_url: null,
        category: 'student',
        is_default: false,
        metadata: { icon: '🌟', description: 'Sparkle' },
      },
    ]);
  });

  it('renders an avatar image preview when image_url is present and falls back to icon when missing', async () => {
    render(<OnboardingFlow onComplete={() => {}} />);

    await screen.findByText("Let's personalize your learning path");

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByText('Choose an avatar');

    expect(await screen.findByAltText('Cat avatar')).toBeInTheDocument();
    expect(screen.getByText('🌟')).toBeInTheDocument();
    expect(screen.getByText('Sparkle')).toBeInTheDocument();
  });
});
