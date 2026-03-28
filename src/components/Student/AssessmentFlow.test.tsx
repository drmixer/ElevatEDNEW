import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AssessmentFlow from './AssessmentFlow';

const {
  trackEventSpy,
  loadDiagnosticAssessmentSpy,
  recordAssessmentResponseSpy,
  finalizeAssessmentAttemptSpy,
} = vi.hoisted(() => ({
  trackEventSpy: vi.fn(),
  loadDiagnosticAssessmentSpy: vi.fn(),
  recordAssessmentResponseSpy: vi.fn(),
  finalizeAssessmentAttemptSpy: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'student-1', name: 'Student Tester', grade: 7 },
  }),
}));

vi.mock('../../lib/analytics', () => ({
  default: trackEventSpy,
}));

vi.mock('../../services/assessmentService', () => ({
  loadDiagnosticAssessment: loadDiagnosticAssessmentSpy,
  recordAssessmentResponse: recordAssessmentResponseSpy,
  finalizeAssessmentAttempt: finalizeAssessmentAttemptSpy,
}));

vi.mock('framer-motion', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const sanitizeProps = <T extends Record<string, unknown>>(props: T) => {
    const { whileHover, whileTap, initial, animate, exit, transition, ...rest } = props;
    void whileHover;
    void whileTap;
    void initial;
    void animate;
    void exit;
    void transition;
    return rest;
  };
  const passthrough = ReactModule.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
    ({ children, ...props }, ref) => ReactModule.createElement('div', { ...sanitizeProps(props), ref }, children),
  );
  const button = ReactModule.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, ...props }, ref) => ReactModule.createElement('button', { ...sanitizeProps(props), ref }, children),
  );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: passthrough,
      h1: passthrough,
      p: passthrough,
      button,
    },
  };
});

describe('AssessmentFlow telemetry', () => {
  beforeEach(() => {
    trackEventSpy.mockReset();
    loadDiagnosticAssessmentSpy.mockReset();
    recordAssessmentResponseSpy.mockReset();
    finalizeAssessmentAttemptSpy.mockReset();

    loadDiagnosticAssessmentSpy.mockResolvedValue({
      assessmentId: 101,
      attemptId: 202,
      attemptNumber: 1,
      title: 'Diagnostic',
      description: null,
      subject: 'math',
      estimatedDurationMinutes: 15,
      metadata: null,
      questions: [
        {
          id: 'q1',
          bankQuestionId: 501,
          prompt: 'What is 2 + 2?',
          type: 'multiple_choice',
          options: [
            { id: 1, text: '4', isCorrect: true },
            { id: 2, text: '5', isCorrect: false },
          ],
          weight: 1,
          difficulty: 1,
          concept: 'addition',
          skillIds: [301],
          subjectId: 1,
          topicId: 1,
        },
      ],
      existingResponses: new Map(),
    });
    recordAssessmentResponseSpy.mockResolvedValue({ isCorrect: true });
    finalizeAssessmentAttemptSpy.mockResolvedValue({
      score: 100,
      correct: 1,
      total: 1,
      strengths: ['addition'],
      weaknesses: [],
      planMessages: ['Start with addition review.'],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tracks diagnostic eligibility when the assessment successfully loads', async () => {
    render(<AssessmentFlow onComplete={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /let's get started!/i }));

    expect(await screen.findByText('Finding Your Starting Point')).toBeInTheDocument();
    expect(trackEventSpy).toHaveBeenCalledWith(
      'success_diagnostic_eligible',
      expect.objectContaining({
        studentId: 'student-1',
        assessmentId: 101,
        attemptId: 202,
        subject: 'math',
        gradeBand: 7,
        questionCount: 1,
        source: 'assessment_flow',
      }),
    );
  });

  it('tracks diagnostic completion from the assessment flow and finalizes with the latest answer', async () => {
    render(<AssessmentFlow onComplete={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /let's get started!/i }));
    expect(await screen.findByText('What is 2 + 2?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /4/i }));

    expect(await screen.findByText(/you did it!/i)).toBeInTheDocument();
    expect(finalizeAssessmentAttemptSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'student-1',
        answers: [
          expect.objectContaining({
            bankQuestionId: 501,
            optionId: 1,
            isCorrect: true,
          }),
        ],
      }),
    );
    expect(trackEventSpy).toHaveBeenCalledWith(
      'success_diagnostic_completed',
      expect.objectContaining({
        studentId: 'student-1',
        assessmentId: 101,
        attemptId: 202,
        score: 100,
        correct: 1,
        total: 1,
        subject: 'math',
        gradeBand: 7,
        source: 'assessment_flow',
      }),
    );
  });
});
