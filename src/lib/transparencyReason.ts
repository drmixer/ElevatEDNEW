type Tone = 'info' | 'support' | 'challenge';

export type TransparencyCard = {
  title: string;
  detail: string;
  tone: Tone;
};

const normalize = (value: string | null | undefined): string => (value ?? '').toString().trim();

const cleanReason = (value: string): string => {
  const trimmed = normalize(value);
  if (!trimmed) return '';
  return trimmed.replace(/\s+/g, ' ').replace(/\.+$/, '');
};

export const buildLessonNextReasonCard = (input: {
  suggestionReason?: string | null;
  subject?: string | null;
  moduleTitle?: string | null;
  lessonTitle?: string | null;
  gradeBand?: string | null;
}): TransparencyCard => {
  const suggestionReason = cleanReason(input.suggestionReason ?? '');
  const subject = normalize(input.subject).replace(/_/g, ' ');
  const moduleTitle = normalize(input.moduleTitle);

  if (suggestionReason) {
    return {
      title: 'Why this lesson now',
      detail: suggestionReason.endsWith('.') ? suggestionReason : `${suggestionReason}.`,
      tone: /stretch|challenge|ahead|advanced/i.test(suggestionReason) ? 'challenge' : 'info',
    };
  }

  const subjectLabel = subject ? `${subject}` : 'this subject';
  const moduleLabel = moduleTitle ? ` in ${moduleTitle}` : '';
  return {
    title: 'Why this lesson now',
    detail: `This lesson was selected to build your ${subjectLabel} skills${moduleLabel} before the next step.`,
    tone: 'info',
  };
};

export const buildSupportReasonCard = (input: {
  mode: 'hint' | 'quick_review' | 'challenge' | 'trend';
  topic?: string | null;
  recommendation?: 'review' | 'steady' | 'accelerate' | null;
  trigger?: string | null;
  accuracyPct?: number | null;
  hintRatePct?: number | null;
}): TransparencyCard => {
  const topic = normalize(input.topic).replace(/_/g, ' ');
  const topicSuffix = topic ? ` on ${topic}` : '';
  const accuracyText =
    typeof input.accuracyPct === 'number' && Number.isFinite(input.accuracyPct)
      ? ` Current accuracy is ${Math.max(0, Math.min(100, Math.round(input.accuracyPct)))}%.`
      : '';
  const hintText =
    typeof input.hintRatePct === 'number' && Number.isFinite(input.hintRatePct)
      ? ` Hint use is ${Math.max(0, Math.min(100, Math.round(input.hintRatePct)))}%.`
      : '';

  if (input.mode === 'hint') {
    return {
      title: "Why you're seeing this hint",
      detail: `You asked for support${topicSuffix}, so we showed a small next-step hint before giving a full answer.`,
      tone: 'support',
    };
  }

  if (input.mode === 'quick_review') {
    return {
      title: "Why you're seeing a quick review",
      detail: `Recent answers suggest a quick recheck${topicSuffix}.${accuracyText}${hintText}`.trim(),
      tone: 'support',
    };
  }

  if (input.mode === 'challenge') {
    return {
      title: "Why you're seeing a challenge",
      detail: `Your recent answers show strong understanding${topicSuffix}, so we offered a stretch question.`,
      tone: 'challenge',
    };
  }

  if (input.recommendation === 'review') {
    return {
      title: 'How we are adapting right now',
      detail: `We are prioritizing review${topicSuffix} to strengthen the foundation before moving ahead.${accuracyText}`.trim(),
      tone: 'support',
    };
  }
  if (input.recommendation === 'accelerate') {
    return {
      title: 'How we are adapting right now',
      detail: `You are trending toward mastery${topicSuffix}, so we are preparing acceleration and optional challenge work.${accuracyText}`.trim(),
      tone: 'challenge',
    };
  }

  return {
    title: 'How we are adapting right now',
    detail: `We are keeping practice steady${topicSuffix} while tracking your next few answers.`,
    tone: 'info',
  };
};
