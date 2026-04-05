import { describe, expect, it } from 'vitest';

import { buildMessages, buildTutorContext, formatLessonContextForPrompt } from '../ai';

describe('tutor grounding', () => {
  it('formats structured lesson context for prompt grounding', () => {
    const grounded = formatLessonContextForPrompt({
      phase: 'practice',
      subject: 'Math',
      lessonTitle: 'Perimeter Basics',
      sectionTitle: 'Practice question 1',
      questionStem: 'What is the perimeter of a square with side length 3?',
      answerChoices: ['6', '9', '12'],
      correctAnswer: '12',
      rubric: 'Add all four sides.',
    });

    expect(grounded).toContain('Current question');
    expect(grounded).toContain('What is the perimeter');
    expect(grounded).toContain('Internal correct answer');
    expect(grounded).toContain('Add all four sides.');
  });

  it('builds learning messages from structured lesson context and turns', () => {
    const context = buildTutorContext({
      mode: 'learning',
      systemPrompt: 'Base tutor prompt',
      helpMode: 'hint',
      lessonContext: {
        phase: 'practice',
        subject: 'Math',
        lessonTitle: 'Perimeter Basics',
        questionStem: 'What is the perimeter of a square with side length 3?',
        answerChoices: ['6', '9', '12'],
        correctAnswer: '12',
      },
      messages: [
        { role: 'assistant', content: 'What step feels tricky?' },
        { role: 'user', content: 'I do not know how to start.' },
      ],
    });

    const messages = buildMessages(context);
    const systemMessages = messages.filter((entry) => entry.role === 'system').map((entry) => entry.content);

    expect(systemMessages.some((entry) => entry.includes('Active lesson context'))).toBe(true);
    expect(systemMessages.some((entry) => entry.includes('Help mode: hint'))).toBe(true);
    expect(messages.at(-2)).toEqual({ role: 'assistant', content: 'What step feels tricky?' });
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'I do not know how to start.' });
  });

  it('prefers the last user turn over fallback prompt text', () => {
    const context = buildTutorContext({
      mode: 'learning',
      prompt: 'Decorated prompt that should not be used',
      messages: [
        { role: 'assistant', content: 'Show me your work so far.' },
        { role: 'user', content: 'I multiplied instead of adding.' },
      ],
    });

    expect(context.prompt).toBe('I multiplied instead of adding.');
    expect(context.messages?.at(-1)?.content).toBe('I multiplied instead of adding.');
  });

  it('adds subject-aware another_way instructions without mutating the learner message', () => {
    const context = buildTutorContext({
      mode: 'learning',
      helpMode: 'another_way',
      lessonContext: {
        phase: 'practice',
        subject: 'Math',
        questionStem: 'What is the perimeter of a square with side length 3?',
      },
      messages: [{ role: 'user', content: 'Can you explain this another way?' }],
    });

    const messages = buildMessages(context);
    const systemMessages = messages.filter((entry) => entry.role === 'system').map((entry) => entry.content);

    expect(systemMessages.some((entry) => entry.includes('different concrete representation'))).toBe(true);
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'Can you explain this another way?' });
  });
});
