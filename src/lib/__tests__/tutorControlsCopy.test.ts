import { describe, expect, it } from 'vitest';

import { tutorControlsCopy } from '../tutorControlsCopy';

describe('tutorControlsCopy', () => {
  it('keeps parent control labels aligned', () => {
    expect(tutorControlsCopy.allowLabel).toBe('Allow AI tutor chats');
    expect(tutorControlsCopy.lessonOnlyLabel).toBe('Limit to lesson context only');
    expect(tutorControlsCopy.capLabel).toBe('Max tutor chats per day');
  });

  it('keeps student messaging aligned', () => {
    expect(tutorControlsCopy.studentDisabledMessage).toContain('turned off tutor chats');
    expect(tutorControlsCopy.studentLessonOnlyMessage).toContain('lesson-only');
  });
});
