import type { TutorHelpMode, TutorLessonContext } from '../../shared/tutor';

type TutorFallbackInput = {
  userMessage: string;
  helpMode: TutorHelpMode;
  lessonContext?: TutorLessonContext | null;
  studentXp: number;
  studentStreakDays: number;
  studentStrengths: string[];
  studentWeaknesses: string[];
};

const quote = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? `"${trimmed}"` : null;
};

const formatChoices = (choices?: string[]): string | null => {
  if (!choices?.length) return null;
  return choices.map((choice, index) => `${String.fromCharCode(65 + index)}. ${choice}`).join(' ');
};

export const buildTutorDeterministicFallback = ({
  userMessage,
  helpMode,
  lessonContext,
  studentXp,
  studentStreakDays,
  studentStrengths,
  studentWeaknesses,
}: TutorFallbackInput): string => {
  const subject = lessonContext?.subject?.toLowerCase() ?? '';
  const lessonLabel = quote(lessonContext?.lessonTitle ?? lessonContext?.sectionTitle ?? null);
  const questionStem = quote(lessonContext?.questionStem ?? null);
  const answerChoices = formatChoices(lessonContext?.answerChoices);
  const learnerAnswer = Array.isArray(lessonContext?.learnerAnswer)
    ? lessonContext?.learnerAnswer.join(', ')
    : lessonContext?.learnerAnswer ?? null;

  if (lessonContext?.phase === 'practice' && questionStem && subject.includes('math')) {
    if (helpMode === 'break_down') {
      return [
        `Let's break down ${questionStem}.`,
        '1. Say what the question is asking you to find.',
        '2. Pull out the numbers or facts you need.',
        '3. Do one operation or one comparison at a time.',
        answerChoices ? `4. Compare your result to these choices: ${answerChoices}` : '4. Check whether your result matches what the question asked for.',
      ].join(' ');
    }

    if (helpMode === 'another_way') {
      return [
        `Try ${questionStem} another way.`,
        'Instead of jumping to the answer, explain the problem out loud in your own words.',
        answerChoices ? `Then test each choice against your work: ${answerChoices}` : 'Then check whether your work matches the quantity the problem asks for.',
      ].join(' ');
    }

    if (helpMode === 'check_thinking' && learnerAnswer) {
      return [
        `Let's check your thinking on ${questionStem}.`,
        `You chose ${quote(learnerAnswer) ?? 'an answer'}.`,
        'Tell me the step or operation that led you there, and check whether it matches every number or clue in the question.',
      ].join(' ');
    }

    return [
      `Let's focus on ${questionStem}.`,
      'First, identify exactly what the problem wants you to find.',
      'Next, use the numbers or clues to do one step.',
      answerChoices ? `Then compare that step to the choices: ${answerChoices}` : 'Then check whether your step matches the question.',
      'Show me your first step and I can help from there.',
    ].join(' ');
  }

  if (lessonContext?.phase === 'learn' && lessonContext.visibleText?.trim()) {
      return [
        lessonLabel ? `Let's stay with ${lessonLabel}.` : "Let's stay with this part of the lesson.",
        studentStrengths[0] ? `Use the same steady thinking you use in ${studentStrengths[0]}.` : null,
        'Read one sentence at a time and ask yourself what the most important idea is.',
        'Then tell me which word, step, or example feels confusing, and I will explain just that part.',
      ]
        .filter(Boolean)
        .join(' ');
  }

  const message = userMessage.toLowerCase();
  if (message.includes('help') || message.includes('stuck')) {
    return `I can help. Start with the exact step that feels confusing, and I’ll give you one small next move instead of the whole answer.`;
  }

  if (message.includes('motivation') || message.includes('tired') || message.includes('give up')) {
    return `You've already earned ${studentXp} XP and built a ${studentStreakDays}-day streak. Take one small step, then come back and tell me where you got stuck.`;
  }

  if (message.includes('study tip') || message.includes('how to study')) {
    return `Try this: explain ${studentWeaknesses[0] || 'the hard part'} in simple words like you're teaching a friend. That usually shows the next gap to fix.`;
  }

  return `Tell me the exact question or step you want help with. I can be most useful when we stay on one specific problem instead of the whole lesson.`;
};
