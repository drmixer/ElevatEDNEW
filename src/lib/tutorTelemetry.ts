import type { TutorAnsweredEventDetail } from '../../shared/tutor';

const RETRY_AFTER_HINT_WINDOW_MS = 10 * 60 * 1000;

export const shouldTrackTutorRetryAfterHint = (
  signal: TutorAnsweredEventDetail | null | undefined,
  input: {
    lessonId?: number | string | null;
    questionStem?: string | null;
    now?: number;
  },
): boolean => {
  if (!signal) return false;
  if (signal.phase !== 'practice') return false;
  if (!['hint', 'break_down', 'another_way', 'check_thinking'].includes(signal.helpMode)) return false;
  if (signal.lessonId == null || input.lessonId == null || `${signal.lessonId}` !== `${input.lessonId}`) return false;
  if ((input.now ?? Date.now()) - signal.timestamp > RETRY_AFTER_HINT_WINDOW_MS) return false;

  const signalStem = signal.questionStem?.trim().toLowerCase() ?? '';
  const inputStem = input.questionStem?.trim().toLowerCase() ?? '';
  if (signalStem && inputStem && signalStem !== inputStem) return false;

  return true;
};

