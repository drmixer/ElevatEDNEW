import type { LessonPracticeQuestion, Subject } from '../types';
import { getDeterministicK5MathChallengeQuestion } from './k5MathAdaptation';
import { getDeterministicSecondaryMathPracticeQuestion } from './deterministicSecondaryMathPractice';
import { getDeterministicNonMathChallengeQuestion } from './nonMathRemediation';

type PracticeFallbackInput = {
  lessonId: number;
  subject?: Subject | string | null;
  gradeBand?: string | null;
  lessonTitle?: string | null;
  lessonContent?: string | null;
};

const parseGrade = (gradeBand: string | null | undefined): number | null => {
  const match = (gradeBand ?? '').match(/\d+/);
  if (!match) return null;
  const value = Number.parseInt(match[0] ?? '', 10);
  return Number.isFinite(value) ? value : null;
};

export const getDeterministicPracticeFallbackQuestion = (
  input: PracticeFallbackInput,
): LessonPracticeQuestion | null => {
  const grade = parseGrade(input.gradeBand);
  const subject = (input.subject ?? '').toString().toLowerCase();

  if (subject.includes('math') && grade != null && grade <= 5) {
    const mathFallback = getDeterministicK5MathChallengeQuestion({
      lessonId: input.lessonId,
      subject: input.subject,
      gradeBand: input.gradeBand ?? null,
      lessonTitle: input.lessonTitle ?? null,
      lessonContent: input.lessonContent ?? null,
    });
    if (mathFallback) {
      return mathFallback;
    }
  }

  if (subject.includes('math') && grade != null && grade >= 6) {
    return getDeterministicSecondaryMathPracticeQuestion({
      lessonId: input.lessonId,
      lessonTitle: input.lessonTitle ?? null,
      lessonContent: input.lessonContent ?? null,
    });
  }

  return getDeterministicNonMathChallengeQuestion({
    lessonId: input.lessonId,
    subject: input.subject,
    lessonTitle: input.lessonTitle ?? null,
    lessonContent: input.lessonContent ?? null,
  });
};
