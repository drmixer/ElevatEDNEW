import { HttpError } from './httpError.js';

export type PlacementQuestionOption = {
  id: number;
  text: string;
  isCorrect: boolean;
  feedback?: string | null;
};

export type PlacementQuestion = {
  bankQuestionId: number;
  prompt: string;
  type: string;
  options: PlacementQuestionOption[];
};

type InvalidReason = { bankQuestionId: number; reason: string };

export type PlacementValidationResult = {
  questions: PlacementQuestion[];
  invalidReasons: InvalidReason[];
  filteredOutCount: number;
};

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[().,:;!?'"[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const isPlaceholderOptionText = (value: string): boolean => {
  const normalized = normalizeText(value);
  if (!normalized) return true;
  const exact = new Set([
    'common misconception',
    'partially correct idea',
    'off topic choice',
    'off-topic choice',
    'mostly correct',
    'correct grade level',
  ]);
  if (exact.has(normalized)) return true;
  if (normalized.startsWith('correct answer')) return true;
  return false;
};

export const validatePlacementQuestions = (
  questions: PlacementQuestion[],
  options?: { assessmentId?: number },
): PlacementValidationResult => {
  const supportedTypes = new Set(['multiple_choice', 'true_false']);
  const invalidReasons: InvalidReason[] = [];

  const validated = (questions ?? [])
    .map((question) => {
      if (!question.prompt || !question.prompt.trim().length) {
        invalidReasons.push({ bankQuestionId: question.bankQuestionId, reason: 'empty_prompt' });
        return null;
      }

      const normalizedType = question.type?.toLowerCase().trim();
      if (!normalizedType || !supportedTypes.has(normalizedType)) {
        invalidReasons.push({ bankQuestionId: question.bankQuestionId, reason: 'unsupported_type' });
        return null;
      }

      const rawOptions = Array.isArray(question.options) ? question.options : [];
      const trimmedOptions = rawOptions
        .map((option) => ({
          ...option,
          text: typeof option.text === 'string' ? option.text.trim() : '',
        }))
        .filter((option) => option.text.length > 0);

      if (trimmedOptions.some((option) => isPlaceholderOptionText(option.text))) {
        invalidReasons.push({ bankQuestionId: question.bankQuestionId, reason: 'placeholder_options' });
        return null;
      }

      const deduped: PlacementQuestionOption[] = [];
      const seen = new Set<string>();
      for (const option of trimmedOptions) {
        const key = normalizeText(option.text);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(option);
      }

      const capped = deduped.slice(0, 6);
      if (capped.length < 2) {
        invalidReasons.push({ bankQuestionId: question.bankQuestionId, reason: 'insufficient_options' });
        return null;
      }

      const correctCount = capped.filter((option) => option.isCorrect).length;
      if (correctCount < 1 || correctCount >= capped.length) {
        invalidReasons.push({ bankQuestionId: question.bankQuestionId, reason: 'invalid_correctness' });
        return null;
      }

      return { ...question, type: normalizedType, options: capped } satisfies PlacementQuestion;
    })
    .filter((question): question is PlacementQuestion => Boolean(question));

  const filteredOutCount = Math.max(0, (questions?.length ?? 0) - validated.length);

  if (!validated.length) {
    throw new HttpError(409, 'Placement assessment content is incomplete.', 'placement_content_invalid', {
      assessmentId: options?.assessmentId ?? null,
      invalidCount: invalidReasons.length,
      reasons: invalidReasons.slice(0, 20),
    });
  }

  return { questions: validated, invalidReasons, filteredOutCount };
};

