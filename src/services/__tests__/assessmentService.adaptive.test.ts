import { describe, expect, it, beforeEach } from 'vitest';
import { persistAdaptiveFlash, type AdaptiveFlash } from '../assessmentService';
import type { StudentEventResponse, StudentEventInput } from '../studentEventService';
import { consumeAdaptiveFlash } from '../../hooks/useStudentData';

const mockResponse = (overrides: Partial<StudentEventResponse> = {}): StudentEventResponse => ({
  event: {
    pointsAwarded: 0,
    xpTotal: 0,
    streakDays: 0,
    eventId: 1,
    eventCreatedAt: new Date().toISOString(),
  },
  adaptive: {
    targetDifficulty: 4,
    misconceptions: ['math.geo_1'],
    recentAttempts: [
      { standards: ['math.geo_1'], correct: true, difficulty: 4, source: 'quiz' },
    ],
  },
  next: {
    id: 99,
    type: 'lesson',
    status: 'not_started',
    position: 1,
    lesson_id: 123,
    module_id: 321,
    metadata: { reason: 'stretch', lesson_title: 'Triangles', module_title: 'Geometry' },
    target_standard_codes: ['math.geo_1'],
  },
  ...overrides,
});

const eventInput: StudentEventInput = {
  eventType: 'quiz_submitted',
  status: 'completed',
  score: 85,
  timeSpentSeconds: 120,
  payload: { standards: ['math.geo_1'], assessment_id: 55 },
};

describe('persistAdaptiveFlash', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('persists adaptive flash for quiz events and consume clears it', () => {
    const response = mockResponse();
    persistAdaptiveFlash('student-1', response, eventInput);

    const stored = sessionStorage.getItem('adaptive-flash:student-1');
    expect(stored).toBeTruthy();

    const flash = consumeAdaptiveFlash('student-1') as AdaptiveFlash | null;
    expect(flash?.eventType).toBe('quiz_submitted');
    expect(flash?.targetDifficulty).toBe(4);
    expect(flash?.misconceptions).toEqual(['math.geo_1']);
    expect(flash?.nextReason).toBe('stretch');
    // One-time read
    expect(sessionStorage.getItem('adaptive-flash:student-1')).toBeNull();
  });
});
