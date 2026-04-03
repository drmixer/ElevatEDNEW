import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OnboardingFlow from './OnboardingFlow';

const {
  refreshUserSpy,
  fetchPreferencesSpy,
  listAvatarsSpy,
  listTutorPersonasSpy,
  fetchStudentPathsSpy,
  updatePreferencesSpy,
  startPlacementSpy,
  savePlacementProgressSpy,
  submitPlacementSpy,
} = vi.hoisted(() => ({
  refreshUserSpy: vi.fn(),
  fetchPreferencesSpy: vi.fn(),
  listAvatarsSpy: vi.fn(),
  listTutorPersonasSpy: vi.fn(),
  fetchStudentPathsSpy: vi.fn(),
  updatePreferencesSpy: vi.fn(),
  startPlacementSpy: vi.fn(),
  savePlacementProgressSpy: vi.fn(),
  submitPlacementSpy: vi.fn(),
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
  fetchStudentPaths: fetchStudentPathsSpy,
  updatePreferences: updatePreferencesSpy,
  startPlacement: startPlacementSpy,
  savePlacementProgress: savePlacementProgressSpy,
  submitPlacement: submitPlacementSpy,
}));

describe('OnboardingFlow', () => {
  beforeEach(() => {
    refreshUserSpy.mockReset();
    refreshUserSpy.mockResolvedValue(undefined);
    updatePreferencesSpy.mockReset();
    startPlacementSpy.mockReset();
    savePlacementProgressSpy.mockReset();
    submitPlacementSpy.mockReset();
    fetchPreferencesSpy.mockResolvedValue({
      opt_in_ai: true,
      avatar_id: 'avatar-starter',
      tutor_persona_id: null,
    });
    listTutorPersonasSpy.mockResolvedValue([{ id: 'persona-1', name: 'Coach', tone: 'supportive' }]);
    fetchStudentPathsSpy.mockResolvedValue([]);
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
    updatePreferencesSpy.mockResolvedValue({
      opt_in_ai: true,
      avatar_id: 'avatar-starter',
      tutor_persona_id: null,
    });
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

  it('runs one mixed assessment flow while keeping separate subject placement sessions', async () => {
    startPlacementSpy.mockImplementation(async ({ subject }: { subject?: string | null }) => {
      if (subject === 'math') {
        return {
          assessmentId: 101,
          attemptId: 201,
          attemptNumber: 1,
          gradeBand: '6-8',
          subject: 'math',
          expectedLevel: 6,
          resumeToken: 'math-token',
          items: [
            {
              id: 'math-q1',
              bankQuestionId: 1001,
              prompt: 'Math question',
              type: 'multiple_choice',
              options: [
                { id: 1, text: '4', isCorrect: true },
                { id: 2, text: '5', isCorrect: false },
              ],
              weight: 1,
              difficulty: 6,
              strand: 'numbers',
              targetStandards: [],
              metadata: null,
            },
          ],
          existingResponses: [],
        };
      }

      return {
        assessmentId: 102,
        attemptId: 202,
        attemptNumber: 1,
        gradeBand: '6-8',
        subject: 'english',
        expectedLevel: 6,
        resumeToken: 'ela-token',
        items: [
          {
            id: 'ela-q1',
            bankQuestionId: 2001,
            prompt: 'ELA question',
            type: 'multiple_choice',
            options: [
              { id: 3, text: 'Main idea', isCorrect: true },
              { id: 4, text: 'Setting', isCorrect: false },
            ],
            weight: 1,
            difficulty: 6,
            strand: 'reading',
            targetStandards: [],
            metadata: null,
          },
        ],
        existingResponses: [],
      };
    });
    savePlacementProgressSpy.mockResolvedValue({ isCorrect: true });
    submitPlacementSpy.mockImplementation(async ({ subject }: { subject?: string | null }) => ({
      pathId: subject === 'math' ? 301 : 302,
      entries: [],
      strandEstimates: [],
      score: 100,
      masteryPct: 100,
      subject,
      expectedLevel: 6,
      workingLevel: subject === 'math' ? 5 : 7,
      levelConfidence: 0.9,
      subjectState: null,
    }));

    render(<OnboardingFlow onComplete={() => {}} />);

    await screen.findByText("Let's personalize your learning path");
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Choose an avatar');
    fireEvent.click(screen.getByRole('button', { name: /Continue to check-in/i }));
    await screen.findByText('Start mixed assessment');

    fireEvent.click(screen.getByRole('button', { name: /Start mixed assessment/i }));

    expect(await screen.findByText('Math question')).toBeInTheDocument();
    expect(startPlacementSpy).toHaveBeenCalledTimes(2);
    expect(startPlacementSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ subject: 'math' }));
    expect(startPlacementSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ subject: 'english' }));

    fireEvent.click(screen.getByRole('button', { name: '4' }));

    expect(await screen.findByText('ELA question')).toBeInTheDocument();
    expect(savePlacementProgressSpy).toHaveBeenCalledWith(
      expect.objectContaining({ assessmentId: 101, attemptId: 201, bankQuestionId: 1001 }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Main idea' }));

    await waitFor(() => {
      expect(submitPlacementSpy).toHaveBeenCalledWith(expect.objectContaining({ subject: 'math', assessmentId: 101 }));
      expect(submitPlacementSpy).toHaveBeenCalledWith(expect.objectContaining({ subject: 'english', assessmentId: 102 }));
    });
  });
});
