import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import {
  applyStudentEventResponse,
  elaDailyPlanQueryKey,
  elaSubjectStateQueryKey,
  elaWeeklyRecordQueryKey,
  mathWeeklyRecordQueryKey,
} from './useStudentData';
import type { StudentEventInput, StudentEventResponse } from '../services/studentEventService';

const response: StudentEventResponse = {
  event: {
    pointsAwarded: 10,
    xpTotal: 100,
    streakDays: 2,
    eventId: 1,
    eventCreatedAt: '2026-04-28T10:00:00.000Z',
  },
};

describe('applyStudentEventResponse', () => {
  it('invalidates the parent weekly math record after a scored adaptive variant completion', () => {
    const queryClient = new QueryClient();
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation(() => Promise.resolve());
    const event: StudentEventInput = {
      eventType: 'lesson_completed',
      score: 91,
      payload: {
        subject: 'math',
        adaptive_variant_id: 'math-module::exit_ticket',
        module_slug: 'math-module',
      },
    };

    applyStudentEventResponse(queryClient, 'student-1', response, event);

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: mathWeeklyRecordQueryKey('student-1'),
    });
  });

  it('does not invalidate the parent weekly math record for unrelated events', () => {
    const queryClient = new QueryClient();
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation(() => Promise.resolve());

    applyStudentEventResponse(queryClient, 'student-1', response, {
      eventType: 'lesson_started',
      payload: { subject: 'math' },
    });

    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: mathWeeklyRecordQueryKey('student-1'),
    });
  });

  it('invalidates ELA daily plan, state, and weekly record for explicit ELA events', () => {
    const queryClient = new QueryClient();
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation(() => Promise.resolve());

    applyStudentEventResponse(queryClient, 'student-1', response, {
      eventType: 'lesson_completed',
      score: 88,
      payload: {
        subject: 'ela',
        module_slug: '3-english-language-arts-reading-informational-main-idea',
      },
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: elaDailyPlanQueryKey('student-1'),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: elaSubjectStateQueryKey('student-1'),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: elaWeeklyRecordQueryKey('student-1'),
    });
  });

  it('invalidates ELA daily plan and state when module metadata indicates English language arts', () => {
    const queryClient = new QueryClient();
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation(() => Promise.resolve());

    applyStudentEventResponse(queryClient, 'student-1', response, {
      eventType: 'lesson_completed',
      payload: {
        module: {
          subject: 'English Language Arts',
        },
      },
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: elaDailyPlanQueryKey('student-1'),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: elaSubjectStateQueryKey('student-1'),
    });
  });

  it('invalidates ELA daily plan and state when only the module slug is ELA-shaped', () => {
    const queryClient = new QueryClient();
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation(() => Promise.resolve());

    applyStudentEventResponse(queryClient, 'student-1', response, {
      eventType: 'lesson_completed',
      payload: {
        module_slug: '3-english-language-arts-reading-informational-main-idea',
      },
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: elaDailyPlanQueryKey('student-1'),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: elaSubjectStateQueryKey('student-1'),
    });
  });
});
