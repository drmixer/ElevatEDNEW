import { describe, expect, it } from 'vitest';

import { createSupabaseClientMock } from '../../src/test/supabaseMock';
import { getTutorUsefulnessSummary } from '../tutorReports';

describe('getTutorUsefulnessSummary', () => {
  it('aggregates persisted tutor usefulness events', async () => {
    const supabase = createSupabaseClientMock({
      student_events: {
        query: async () => ({
          data: [
            {
              event_type: 'tutor_answered_in_lesson',
              payload: { delivery_mode: 'ai_direct', grounded_to_problem: true },
              created_at: '2026-04-04T00:00:00.000Z',
            },
            {
              event_type: 'tutor_answered_in_lesson',
              payload: { delivery_mode: 'deterministic_fallback', grounded_to_problem: false },
              created_at: '2026-04-04T00:05:00.000Z',
            },
            {
              event_type: 'tutor_retried_after_hint',
              payload: { help_mode: 'hint' },
              created_at: '2026-04-04T00:06:00.000Z',
            },
            {
              event_type: 'tutor_answer_reported',
              payload: { reason: 'incorrect' },
              created_at: '2026-04-04T00:07:00.000Z',
            },
          ],
          error: null,
        }),
      },
    });

    const summary = await getTutorUsefulnessSummary(supabase as never, { windowDays: 30 });

    expect(summary.answeredInLesson).toBe(2);
    expect(summary.retriedAfterHint).toBe(1);
    expect(summary.answersReported).toBe(1);
    expect(summary.aiDirectAnswers).toBe(1);
    expect(summary.fallbackAnswers).toBe(1);
    expect(summary.problemGroundedAnswers).toBe(1);
    expect(summary.retryRatePct).toBe(50);
  });
});

