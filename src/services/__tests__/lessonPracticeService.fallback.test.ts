import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSupabaseClientMock } from '../../test/supabaseMock';

const supabaseMock = createSupabaseClientMock();
const reliabilityMock = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  __esModule: true,
  default: supabaseMock,
}));

vi.mock('../../lib/reliability', () => ({
  __esModule: true,
  default: reliabilityMock,
}));

describe('fetchLessonCheckQuestions', () => {
  beforeEach(() => {
    supabaseMock.setResponses({});
    reliabilityMock.mockReset();
  });

  it('adds a deterministic non-math fallback when bank items are blocked as generic', async () => {
    supabaseMock.setResponses({
      lesson_skills: {
        query: async () => ({ data: [{ skill_id: 10 }], error: null }),
      },
      question_skills: {
        query: async () => ({
          data: [
            { question_id: 101, skill_id: 10 },
            { question_id: 102, skill_id: 10 },
          ],
          error: null,
        }),
      },
      question_bank: {
        query: async () => ({
          data: [
            {
              id: 101,
              prompt: 'What is the scientific method used when studying chemistry?',
              question_type: 'multiple_choice',
              solution_explanation: null,
              question_options: [
                { id: 1, option_order: 1, content: 'A process for testing ideas', is_correct: true, feedback: null },
                { id: 2, option_order: 2, content: 'A random guess', is_correct: false, feedback: null },
              ],
              question_skills: [],
            },
            {
              id: 102,
              prompt: 'Why is studying atoms important to learn?',
              question_type: 'multiple_choice',
              solution_explanation: null,
              question_options: [
                { id: 3, option_order: 1, content: 'Because it helps explain matter', is_correct: true, feedback: null },
                { id: 4, option_order: 2, content: 'It has no practical applications', is_correct: false, feedback: null },
              ],
              question_skills: [],
            },
          ],
          error: null,
        }),
      },
    });

    const { fetchLessonCheckQuestions } = await import('../lessonPracticeService');
    const questions = await fetchLessonCheckQuestions(
      290,
      'science',
      {
        gradeBand: '6',
        lessonTitle: 'Launch Lesson: Physical Science Chemistry Atoms Bonding Reactions',
        lessonContent: 'Students use observations and data to support testable claims about atoms and reactions.',
      },
      4,
    );

    expect(questions).toHaveLength(1);
    expect(questions[0]?.prompt).toMatch(/scientific reasoning/i);
    expect(questions[0]?.options.some((option) => option.isCorrect)).toBe(true);
    expect(reliabilityMock).toHaveBeenCalledWith(
      'lesson_playback',
      'warning',
      expect.objectContaining({
        phase: 'practice_question_fallback',
        lessonId: 290,
      }),
    );
  });

  it('adds a deterministic secondary math fallback for grades 6+ when bank items are blocked', async () => {
    supabaseMock.setResponses({
      lesson_skills: {
        query: async () => ({ data: [{ skill_id: 20 }], error: null }),
      },
      question_skills: {
        query: async () => ({
          data: [{ question_id: 201, skill_id: 20 }],
          error: null,
        }),
      },
      question_bank: {
        query: async () => ({
          data: [
            {
              id: 201,
              prompt: 'What is the scientific method used when studying functions?',
              question_type: 'multiple_choice',
              solution_explanation: null,
              question_options: [
                { id: 1, option_order: 1, content: 'Use a process', is_correct: true, feedback: null },
                { id: 2, option_order: 2, content: 'Guess randomly', is_correct: false, feedback: null },
              ],
              question_skills: [],
            },
          ],
          error: null,
        }),
      },
    });

    const { fetchLessonCheckQuestions } = await import('../lessonPracticeService');
    const questions = await fetchLessonCheckQuestions(
      210,
      'math',
      {
        gradeBand: '6',
        lessonTitle: 'Functions (intro)',
        lessonContent: 'A function table maps each input to exactly one output. Use y = 2x + 3.',
      },
      4,
    );

    expect(questions).toHaveLength(1);
    expect(questions[0]?.prompt).toMatch(/function/i);
    expect(questions[0]?.prompt).toMatch(/2x \+ 3/i);
    expect(questions[0]?.options.some((option) => option.isCorrect)).toBe(true);
  });
});
