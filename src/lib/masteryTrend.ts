export type MasteryTrendDirection = 'up' | 'down' | 'steady';
export type MasteryTrendRecommendation = 'review' | 'steady' | 'accelerate';

export type MasteryTrendAttempt = {
  isCorrect: boolean;
  usedHint?: boolean;
};

export type MasteryTrendResult = {
  direction: MasteryTrendDirection;
  recommendation: MasteryTrendRecommendation;
  score: number;
  answered: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  recentAccuracy: number;
  hintRate: number;
  shouldTriggerQuickReview: boolean;
  shouldOfferChallenge: boolean;
};

const clampRatio = (numerator: number, denominator: number): number => {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.max(0, Math.min(1, numerator / denominator));
};

const computeAccuracy = (attempts: MasteryTrendAttempt[]): number => {
  if (!attempts.length) return 0;
  const correct = attempts.filter((attempt) => attempt.isCorrect).length;
  return clampRatio(correct, attempts.length);
};

export const evaluateMasteryTrend = (input: {
  attempts: MasteryTrendAttempt[];
  questionCount: number;
  quickReviewShown?: boolean;
  quickReviewCorrect?: boolean | null;
}): MasteryTrendResult => {
  const attempts = Array.isArray(input.attempts) ? input.attempts : [];
  const answered = attempts.length;
  const correct = attempts.filter((attempt) => attempt.isCorrect).length;
  const incorrect = Math.max(0, answered - correct);
  const accuracy = clampRatio(correct, answered);
  const hintsUsed = attempts.filter((attempt) => attempt.usedHint).length;
  const hintRate = clampRatio(hintsUsed, answered);

  const recentWindow = attempts.slice(-Math.min(3, answered));
  const recentAccuracy = computeAccuracy(recentWindow);

  let score = 0;
  if (accuracy >= 0.9) score += 2;
  else if (accuracy >= 0.75) score += 1;
  else if (accuracy <= 0.5) score -= 2;

  if (recentAccuracy >= 0.8) score += 1;
  else if (recentAccuracy <= 0.34) score -= 1;

  const lastTwo = attempts.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every((attempt) => attempt.isCorrect)) score += 1;
  if (lastTwo.length === 2 && lastTwo.every((attempt) => !attempt.isCorrect)) score -= 1;

  if (answered >= 5 && accuracy >= 0.8) score += 1;

  if (hintRate >= 0.5) score -= 1;

  if (input.quickReviewShown) {
    if (input.quickReviewCorrect === true) score += 1;
    if (input.quickReviewCorrect === false) score -= 1;
  }

  const delta = recentAccuracy - accuracy;
  const direction: MasteryTrendDirection = delta >= 0.1 ? 'up' : delta <= -0.1 ? 'down' : 'steady';

  let recommendation: MasteryTrendRecommendation = 'steady';
  if (answered >= 2) {
    if (score >= 2 && accuracy >= 0.75 && hintRate <= 0.4) {
      recommendation = 'accelerate';
    } else if (score <= -1 || accuracy < 0.55 || (hintRate >= 0.6 && accuracy < 0.75)) {
      recommendation = 'review';
    }
  }

  const requiredForChallenge = Math.max(2, Math.min(3, input.questionCount || 0));
  const shouldOfferChallenge =
    recommendation === 'accelerate' &&
    answered >= requiredForChallenge &&
    incorrect <= 1 &&
    input.quickReviewCorrect !== false;

  const shouldTriggerQuickReview =
    recommendation === 'review' &&
    answered >= 2 &&
    !(input.quickReviewShown && input.quickReviewCorrect === true);

  return {
    direction,
    recommendation,
    score,
    answered,
    correct,
    incorrect,
    accuracy,
    recentAccuracy,
    hintRate,
    shouldTriggerQuickReview,
    shouldOfferChallenge,
  };
};
